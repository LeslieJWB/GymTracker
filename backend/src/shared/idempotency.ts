import type { Request } from "express";
import { pool } from "../db.js";

export function idempotencyHeader(req: Request): string | null {
  const key = req.header("Idempotency-Key");
  if (!key) {
    return null;
  }
  const trimmed = key.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function findIdempotentResponse(
  userId: string,
  endpoint: string,
  key: string
): Promise<{ status: number; body: unknown } | null> {
  const result = await pool.query<{
    response_status: number;
    response_body: unknown;
  }>(
    `
      SELECT response_status, response_body
      FROM idempotency_keys
      WHERE user_id = $1
        AND endpoint = $2
        AND idempotency_key = $3
      LIMIT 1
    `,
    [userId, endpoint, key]
  );
  if (result.rowCount === 0) {
    return null;
  }
  const row = result.rows[0];
  return { status: row.response_status, body: row.response_body };
}

export async function saveIdempotentResponse(
  userId: string,
  endpoint: string,
  key: string,
  status: number,
  body: unknown
): Promise<void> {
  await pool.query(
    `
      INSERT INTO idempotency_keys
        (user_id, endpoint, idempotency_key, response_status, response_body)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      ON CONFLICT (user_id, endpoint, idempotency_key)
      DO NOTHING
    `,
    [userId, endpoint, key, status, JSON.stringify(body)]
  );
}
