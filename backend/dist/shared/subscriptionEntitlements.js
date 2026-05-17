import { pool } from "../db.js";
export async function upsertSubscriptionEntitlement(params) {
    await pool.query(`
      INSERT INTO subscription_entitlements (
        supabase_user_id,
        is_active,
        product_identifier,
        entitlement_identifier,
        expires_at,
        raw_payload
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (supabase_user_id)
      DO UPDATE SET
        is_active = EXCLUDED.is_active,
        product_identifier = EXCLUDED.product_identifier,
        entitlement_identifier = EXCLUDED.entitlement_identifier,
        expires_at = EXCLUDED.expires_at,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = now()
    `, [
        params.supabaseUserId,
        params.isActive,
        params.productIdentifier,
        params.entitlementIdentifier,
        params.expiresAt,
        params.rawPayload
    ]);
}
