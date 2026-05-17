import { nodeEnv, revenueCatEntitlementId, revenueCatSecretApiKey } from "../config.js";
import { upsertSubscriptionEntitlement } from "./subscriptionEntitlements.js";

export type ClientSubscriptionReport = {
  isActive: boolean;
  expiresAt: string | null;
  productIdentifier: string | null;
};

type RevenueCatSubscriberResponse = {
  subscriber?: {
    entitlements?: Record<
      string,
      {
        expires_date: string | null;
        product_identifier?: string | null;
      }
    >;
  };
};

function isEntitlementActive(expiresAt: Date | null): boolean {
  return expiresAt === null || expiresAt.getTime() > Date.now();
}

async function syncFromRevenueCatApi(supabaseUserId: string): Promise<{ isActive: boolean }> {
  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(supabaseUserId)}`,
    {
      headers: {
        Authorization: `Bearer ${revenueCatSecretApiKey}`,
        "Content-Type": "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`RevenueCat API responded with ${response.status}`);
  }

  const payload = (await response.json()) as RevenueCatSubscriberResponse;
  const entitlement = payload.subscriber?.entitlements?.[revenueCatEntitlementId];
  const expiresAt =
    entitlement?.expires_date && entitlement.expires_date.length > 0
      ? new Date(entitlement.expires_date)
      : null;
  const isActive = Boolean(entitlement) && isEntitlementActive(expiresAt);

  await upsertSubscriptionEntitlement({
    supabaseUserId,
    isActive,
    productIdentifier: entitlement?.product_identifier ?? null,
    entitlementIdentifier: revenueCatEntitlementId,
    expiresAt,
    rawPayload: payload
  });

  return { isActive };
}

async function syncFromClientReport(
  supabaseUserId: string,
  report: ClientSubscriptionReport
): Promise<{ isActive: boolean }> {
  const expiresAt = report.expiresAt ? new Date(report.expiresAt) : null;
  const isActive = report.isActive && isEntitlementActive(expiresAt);

  await upsertSubscriptionEntitlement({
    supabaseUserId,
    isActive,
    productIdentifier: report.productIdentifier,
    entitlementIdentifier: revenueCatEntitlementId,
    expiresAt,
    rawPayload: { source: "client_sync", report }
  });

  return { isActive };
}

export async function syncSubscriberFromRevenueCat(
  supabaseUserId: string,
  clientReport?: ClientSubscriptionReport
): Promise<{ synced: boolean; isActive: boolean; source: "api" | "client" | null }> {
  if (revenueCatSecretApiKey) {
    const result = await syncFromRevenueCatApi(supabaseUserId);
    return { synced: true, isActive: result.isActive, source: "api" };
  }

  if (nodeEnv !== "production" && clientReport) {
    const result = await syncFromClientReport(supabaseUserId, clientReport);
    return { synced: true, isActive: result.isActive, source: "client" };
  }

  return { synced: false, isActive: false, source: null };
}
