import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";
import { syncExerciseDb } from "./scripts/syncExerciseDb.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../migrations");
async function ensureMigrationsTable() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}
async function run() {
    await ensureMigrationsTable();
    const files = (await readdir(migrationsDir))
        .filter((name) => name.endsWith(".sql"))
        .sort((a, b) => a.localeCompare(b));
    for (const filename of files) {
        const alreadyApplied = await pool.query("SELECT filename FROM schema_migrations WHERE filename = $1", [filename]);
        if (alreadyApplied.rowCount && alreadyApplied.rowCount > 0) {
            continue;
        }
        const sql = await readFile(path.join(migrationsDir, filename), "utf8");
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            await client.query(sql);
            await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
            await client.query("COMMIT");
            console.log(`Applied migration: ${filename}`);
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            client.release();
        }
    }
    const exerciseItemsStats = await pool.query(`
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE source_id IS NOT NULL)::text AS seeded
    FROM exercise_items
  `);
    const stats = exerciseItemsStats.rows[0];
    const total = Number(stats?.total ?? "0");
    const seeded = Number(stats?.seeded ?? "0");
    if (total < 700 || seeded < 700) {
        const result = await syncExerciseDb({ preferCache: true, downloadImages: false });
        console.log(`Synced exercise DB dataset: ${result.totalRows} rows, ${result.downloadedImages} images downloaded`);
    }
    console.log("Migrations complete.");
}
run()
    .catch((error) => {
    const errorData = error && typeof error === "object" ?
        {
            name: "name" in error ? String(error.name) : null,
            message: "message" in error ? String(error.message) : String(error),
            code: "code" in error ? String(error.code) : null,
            errno: "errno" in error ? Number(error.errno) : null,
            syscall: "syscall" in error ? String(error.syscall) : null,
            address: "address" in error ? String(error.address) : null,
            port: "port" in error ? Number(error.port) : null
        }
        : { value: String(error) };
    console.error("Migration failed:", error);
    process.exit(1);
})
    .finally(async () => {
    await pool.end();
});
