import { type Response } from "express";
import {
  freeLlmCallsPerDay,
  revenueCatEntitlementId,
  subscriberLlmCallsPerDay,
  unlimitedLlmSupabaseUserIds
} from "../config.js";
import { pool, withTransaction } from "../db.js";

export type LlmQuotaTier = "free" | "subscriber" | "unlimited";

export type LlmQuotaExceeded = {
  allowed: false;
  tier: Exclude<LlmQuotaTier, "unlimited">;
  limit: number;
  used: number;
};

export type LlmQuotaReserved = {
  allowed: true;
  tier: LlmQuotaTier;
  limit: number | null;
  used: number | null;
};

export type LlmQuotaResult = LlmQuotaReserved | LlmQuotaExceeded;

type EntitlementRow = {
  is_active: boolean;
};

function utcUsageDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function resolveQuotaTier(supabaseUserId: string): Promise<{
  tier: LlmQuotaTier;
  limit: number | null;
}> {
  if (unlimitedLlmSupabaseUserIds.has(supabaseUserId)) {
    return { tier: "unlimited", limit: null };
  }

  const entitlement = await pool.query<EntitlementRow>(
    `
      SELECT is_active
      FROM subscription_entitlements
      WHERE supabase_user_id = $1
        AND entitlement_identifier = $2
        AND is_active = TRUE
        AND (expires_at IS NULL OR expires_at > now())
      LIMIT 1
    `,
    [supabaseUserId, revenueCatEntitlementId]
  );

  if (entitlement.rowCount && entitlement.rowCount > 0) {
    return { tier: "subscriber", limit: subscriberLlmCallsPerDay };
  }

  return { tier: "free", limit: freeLlmCallsPerDay };
}

export async function reserveLlmQuota(params: {
  userId: string;
  supabaseUserId: string;
}): Promise<LlmQuotaResult> {
  const quota = await resolveQuotaTier(params.supabaseUserId);
  if (quota.tier === "unlimited") {
    return {
      allowed: true,
      tier: quota.tier,
      limit: null,
      used: null
    };
  }

  const limit = quota.limit ?? 0;
  const tier = quota.tier;
  const usageDate = utcUsageDate();

  return withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO llm_usage_daily (user_id, usage_date, call_count)
        VALUES ($1, $2::date, 0)
        ON CONFLICT (user_id, usage_date) DO NOTHING
      `,
      [params.userId, usageDate]
    );

    const usage = await client.query<{ call_count: number }>(
      `
        SELECT call_count
        FROM llm_usage_daily
        WHERE user_id = $1
          AND usage_date = $2::date
        FOR UPDATE
      `,
      [params.userId, usageDate]
    );
    const used = usage.rows[0]?.call_count ?? 0;

    if (used >= limit) {
      return {
        allowed: false,
        tier,
        limit,
        used
      };
    }

    const updated = await client.query<{ call_count: number }>(
      `
        UPDATE llm_usage_daily
        SET call_count = call_count + 1,
            updated_at = now()
        WHERE user_id = $1
          AND usage_date = $2::date
        RETURNING call_count
      `,
      [params.userId, usageDate]
    );

    return {
      allowed: true,
      tier,
      limit,
      used: updated.rows[0]?.call_count ?? used + 1
    };
  });
}

export async function getLlmQuotaStatus(params: {
  userId: string;
  supabaseUserId: string;
}): Promise<{
  tier: LlmQuotaTier;
  limit: number | null;
  used: number;
}> {
  const quota = await resolveQuotaTier(params.supabaseUserId);
  if (quota.tier === "unlimited") {
    return { tier: quota.tier, limit: null, used: 0 };
  }

  const usageDate = utcUsageDate();
  const usage = await pool.query<{ call_count: number }>(
    `
      SELECT call_count
      FROM llm_usage_daily
      WHERE user_id = $1
        AND usage_date = $2::date
      LIMIT 1
    `,
    [params.userId, usageDate]
  );

  return {
    tier: quota.tier,
    limit: quota.limit,
    used: usage.rows[0]?.call_count ?? 0
  };
}

export function sendLlmQuotaExceeded(res: Response, result: LlmQuotaExceeded): Response {
  return res.status(429).json({
    error: "llm_quota_exceeded",
    reason: result.tier,
    limit: result.limit,
    used: result.used
  });
}
