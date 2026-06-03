import { createClient } from "@supabase/supabase-js";
import type { PoolClient } from "pg";
import { supabaseServiceRoleKey, supabaseUrl } from "../config.js";
import { withTransaction } from "../db.js";

async function deleteUserData(client: PoolClient, userId: string, supabaseUserId: string): Promise<void> {
  // Deleting records cascades to exercises, exercise_sets, food_consumptions, and cardio_sessions.
  await client.query("DELETE FROM records WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM subscription_entitlements WHERE supabase_user_id = $1", [supabaseUserId]);
  await client.query("DELETE FROM users WHERE id = $1", [userId]);
}

async function deleteSupabaseAuthUser(supabaseUserId: string): Promise<void> {
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL must be configured for account deletion.");
  }
  if (!supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must be configured for account deletion.");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { error } = await supabase.auth.admin.deleteUser(supabaseUserId);
  if (error) {
    throw new Error(`Failed to delete Supabase auth user: ${error.message}`);
  }
}

export async function deleteAccount(userId: string, supabaseUserId: string): Promise<void> {
  await withTransaction(async (client) => {
    await deleteUserData(client, userId, supabaseUserId);
  });

  await deleteSupabaseAuthUser(supabaseUserId);
}
