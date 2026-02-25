import dotenv from "dotenv";
import { lookup } from "node:dns/promises";
import { Pool } from "pg";
dotenv.config();
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL in backend environment.");
}
const parsedDatabaseUrl = (() => {
    try {
        return new URL(databaseUrl);
    }
    catch {
        return null;
    }
})();
const databaseHost = parsedDatabaseUrl?.hostname ?? null;
const databasePort = parsedDatabaseUrl?.port ? Number(parsedDatabaseUrl.port) : null;
const sslmode = parsedDatabaseUrl?.searchParams.get("sslmode") ?? null;
// #region agent log
fetch("http://127.0.0.1:7242/ingest/2dcdadeb-a66d-4c0e-a93d-8cc544bdbbcb", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "98d7c6" }, body: JSON.stringify({ sessionId: "98d7c6", runId: "initial", hypothesisId: "H1_H2_H4", location: "src/db.ts:init", message: "Database URL parsed", data: { hasDatabaseUrl: Boolean(databaseUrl), protocol: parsedDatabaseUrl?.protocol ?? null, host: databaseHost, port: databasePort, sslmode, nodeEnv: process.env.NODE_ENV ?? null }, timestamp: Date.now() }) }).catch(() => { });
// #endregion
if (databaseHost) {
    void lookup(databaseHost, { all: true })
        .then((addresses) => {
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/2dcdadeb-a66d-4c0e-a93d-8cc544bdbbcb", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "98d7c6" }, body: JSON.stringify({ sessionId: "98d7c6", runId: "initial", hypothesisId: "H1_H3", location: "src/db.ts:dns", message: "Database host DNS lookup success", data: { host: databaseHost, addresses: addresses.map((entry) => ({ address: entry.address, family: entry.family })) }, timestamp: Date.now() }) }).catch(() => { });
        // #endregion
    })
        .catch((error) => {
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/2dcdadeb-a66d-4c0e-a93d-8cc544bdbbcb", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "98d7c6" }, body: JSON.stringify({ sessionId: "98d7c6", runId: "initial", hypothesisId: "H1_H3", location: "src/db.ts:dns", message: "Database host DNS lookup failed", data: { host: databaseHost, error: error instanceof Error ? error.message : String(error) }, timestamp: Date.now() }) }).catch(() => { });
        // #endregion
    });
}
export const pool = new Pool({
    connectionString: databaseUrl
});
export async function withTransaction(run) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await run(client);
        await client.query("COMMIT");
        return result;
    }
    catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
    finally {
        client.release();
    }
}
