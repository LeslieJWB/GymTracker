import { randomUUID } from "node:crypto";
import { pool } from "../db.js";

type AuthIdentity = {
  supabaseUserId: string;
  email: string | null;
  provider: string | null;
};

export type AppUser = {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  authProvider: string | null;
};

function normalizeDisplayName(email: string | null): string | null {
  if (!email) {
    return null;
  }
  const local = email.split("@")[0]?.trim();
  if (!local) {
    return null;
  }
  return local.slice(0, 100);
}

function usernameFromSupabaseId(supabaseUserId: string): string {
  const compact = supabaseUserId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `u_${compact}`.slice(0, 50);
}

export async function upsertUserFromAuth(identity: AuthIdentity): Promise<AppUser> {
  const baseUsername = usernameFromSupabaseId(identity.supabaseUserId);
  const displayName = normalizeDisplayName(identity.email);

  async function runUpsert(username: string) {
    return pool.query<{
      id: string;
      username: string;
      display_name: string | null;
      email: string | null;
      auth_provider: string | null;
    }>(
      `
        INSERT INTO users (id, username, display_name, supabase_user_id, email, auth_provider)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (supabase_user_id) WHERE supabase_user_id IS NOT NULL
        DO UPDATE SET
          email = EXCLUDED.email,
          auth_provider = EXCLUDED.auth_provider,
          display_name = COALESCE(users.display_name, EXCLUDED.display_name),
          updated_at = now()
        RETURNING id, username, display_name, email, auth_provider
      `,
      [
        randomUUID(),
        username,
        displayName,
        identity.supabaseUserId,
        identity.email,
        identity.provider
      ]
    );
  }

  let result;
  try {
    result = await runUpsert(baseUsername);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("users_username_key")) {
      const suffix = randomUUID().replace(/-/g, "").slice(0, 8);
      const fallbackUsername = `${baseUsername.slice(0, Math.max(1, 50 - (suffix.length + 1)))}_${suffix}`;
      result = await runUpsert(fallbackUsername);
    } else {
      throw error;
    }
  }

  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    authProvider: row.auth_provider
  };
}

export type PromptProfile = {
  age: number | null;
  defaultBodyWeightKg: number | null;
  heightCm: number | null;
  gender: string | null;
  globalLlmPrompt: string | null;
};

function calculateAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) {
    return null;
  }
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export async function getPromptProfile(userId: string): Promise<PromptProfile> {
  const result = await pool.query<{
    date_of_birth: string | null;
    default_body_weight_kg: string | null;
    height_cm: string | null;
    gender: string | null;
    global_llm_prompt: string | null;
  }>(
    `
      SELECT
        date_of_birth::text,
        default_body_weight_kg::text,
        height_cm::text,
        gender,
        global_llm_prompt
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );
  const row = result.rows[0];
  if (!row) {
    return {
      age: null,
      defaultBodyWeightKg: null,
      heightCm: null,
      gender: null,
      globalLlmPrompt: null
    };
  }

  return {
    age: calculateAge(row.date_of_birth),
    defaultBodyWeightKg: row.default_body_weight_kg ? Number(row.default_body_weight_kg) : null,
    heightCm: row.height_cm ? Number(row.height_cm) : null,
    gender: row.gender,
    globalLlmPrompt: row.global_llm_prompt
  };
}

