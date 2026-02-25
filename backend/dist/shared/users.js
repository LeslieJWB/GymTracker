import { pool } from "../db.js";
export async function ensureDefaultUser() {
    const defaultId = "11111111-1111-1111-1111-111111111111";
    const defaultUsername = "default_user";
    const defaultDisplayName = "Default User";
    await pool.query(`
      INSERT INTO users (id, username, display_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (username) DO NOTHING
    `, [defaultId, defaultUsername, defaultDisplayName]);
    const result = await pool.query(`
      SELECT id, username, display_name
      FROM users
      WHERE username = $1
      LIMIT 1
    `, [defaultUsername]);
    const row = result.rows[0];
    return { id: row.id, username: row.username, displayName: row.display_name };
}
