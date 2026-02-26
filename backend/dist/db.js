import dotenv from "dotenv";
import { Pool } from "pg";
dotenv.config();
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL in backend environment.");
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
