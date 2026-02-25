import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../db.js";
const SOURCE_DATA_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const SOURCE_IMAGE_BASE_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";
const BENCH_PRESS_ID = "20000000-0000-0000-0000-000000000001";
const SQUAT_ID = "20000000-0000-0000-0000-000000000003";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "../..");
const cacheDataPath = path.join(backendRoot, "data", "free-exercise-db-items.json");
const publicExercisesDir = path.join(backendRoot, "public", "exercises");
function toDeterministicUuid(input) {
    const hex = createHash("sha1").update(input).digest("hex").slice(0, 32);
    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        `5${hex.slice(13, 16)}`,
        `a${hex.slice(17, 20)}`,
        hex.slice(20, 32)
    ].join("-");
}
function mapRows(sourceRows) {
    return sourceRows.map((row) => {
        const imagePath = row.images?.[0] ? `/exercises/${row.images[0]}` : null;
        const muscleGroup = row.primaryMuscles?.[0] ?? null;
        let id = toDeterministicUuid(`free-exercise-db:${row.id}`);
        if (row.name === "Bench Press") {
            id = BENCH_PRESS_ID;
        }
        else if (row.name === "Squat") {
            id = SQUAT_ID;
        }
        return {
            id,
            sourceId: row.id,
            name: row.name,
            muscleGroup,
            imagePath
        };
    });
}
async function fetchSourceRows() {
    const response = await fetch(SOURCE_DATA_URL, {
        signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch exercise DB (${response.status})`);
    }
    const payload = (await response.json());
    return payload;
}
async function readCachedRows() {
    try {
        const content = await readFile(cacheDataPath, "utf8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
async function writeCache(rows) {
    await mkdir(path.dirname(cacheDataPath), { recursive: true });
    await writeFile(cacheDataPath, JSON.stringify(rows, null, 2), "utf8");
}
async function downloadImageIfNeeded(imagePath) {
    const relativePath = imagePath.replace(/^\/exercises\//, "");
    const localPath = path.join(publicExercisesDir, relativePath);
    try {
        await readFile(localPath);
        return false;
    }
    catch {
        // File doesn't exist, continue downloading.
    }
    try {
        await mkdir(path.dirname(localPath), { recursive: true });
        const sourceUrl = `${SOURCE_IMAGE_BASE_URL}/${relativePath}`;
        const response = await fetch(sourceUrl, {
            signal: AbortSignal.timeout(15_000)
        });
        if (!response.ok) {
            return false;
        }
        const arrayBuffer = await response.arrayBuffer();
        await writeFile(localPath, Buffer.from(arrayBuffer));
        return true;
    }
    catch {
        // A few source images are missing upstream; keep sync resilient.
        return false;
    }
}
export async function syncExerciseDb(options) {
    const preferCache = options?.preferCache ?? true;
    const shouldDownloadImages = options?.downloadImages ?? false;
    const imageLimit = options?.imageLimit ?? Number.POSITIVE_INFINITY;
    const cached = preferCache ? await readCachedRows() : null;
    const rows = cached && cached.length > 0 ? cached : mapRows(await fetchSourceRows());
    if (!cached || cached.length === 0) {
        await writeCache(rows);
    }
    await pool.query(`
    ALTER TABLE exercise_items
      ALTER COLUMN name TYPE VARCHAR(255),
      ADD COLUMN IF NOT EXISTS source_id VARCHAR(150),
      ADD COLUMN IF NOT EXISTS image_path VARCHAR(255)
  `);
    await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS exercise_items_source_id_unique
      ON exercise_items (source_id)
      WHERE source_id IS NOT NULL
  `);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("DROP TABLE IF EXISTS _incoming_exercise_items");
        await client.query(`
      CREATE TEMP TABLE _incoming_exercise_items (
        id UUID PRIMARY KEY,
        source_id VARCHAR(150) NOT NULL,
        name VARCHAR(255) NOT NULL,
        muscle_group VARCHAR(60),
        image_path VARCHAR(255)
      ) ON COMMIT DROP
    `);
        for (const row of rows) {
            await client.query(`
          INSERT INTO _incoming_exercise_items (id, source_id, name, muscle_group, image_path)
          VALUES ($1::uuid, $2, $3, $4, $5)
        `, [row.id, row.sourceId, row.name, row.muscleGroup, row.imagePath]);
        }
        await client.query(`
      INSERT INTO exercise_items (id, source_id, name, muscle_group, image_path)
      SELECT id, source_id, name, muscle_group, image_path
      FROM _incoming_exercise_items
      ON CONFLICT (id) DO UPDATE
      SET
        source_id = EXCLUDED.source_id,
        name = EXCLUDED.name,
        muscle_group = EXCLUDED.muscle_group,
        image_path = EXCLUDED.image_path,
        updated_at = now()
    `);
        await client.query(`
      UPDATE exercises e
      SET exercise_item_id = incoming.id
      FROM exercise_items legacy
      JOIN _incoming_exercise_items incoming
        ON lower(incoming.name) = lower(legacy.name)
        OR (
          lower(legacy.name) = 'barbell row'
          AND lower(incoming.name) = 'bent over barbell row'
        )
      WHERE e.exercise_item_id = legacy.id
        AND legacy.id <> incoming.id
    `);
        await client.query(`
      DELETE FROM exercise_items i
      WHERE NOT EXISTS (
        SELECT 1 FROM _incoming_exercise_items incoming WHERE incoming.id = i.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM exercises e WHERE e.exercise_item_id = i.id
      )
    `);
        await client.query("COMMIT");
    }
    catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
    finally {
        client.release();
    }
    let downloadedImages = 0;
    if (shouldDownloadImages) {
        for (const row of rows) {
            if (!row.imagePath || downloadedImages >= imageLimit) {
                continue;
            }
            const didDownload = await downloadImageIfNeeded(row.imagePath);
            if (didDownload) {
                downloadedImages += 1;
            }
        }
    }
    return { totalRows: rows.length, downloadedImages };
}
async function runCli() {
    const shouldDownloadImages = process.argv.includes("--download-images");
    const noCache = process.argv.includes("--no-cache");
    const imageLimitArg = process.argv.find((arg) => arg.startsWith("--image-limit="));
    const imageLimit = imageLimitArg ? Number(imageLimitArg.split("=")[1]) : undefined;
    const result = await syncExerciseDb({
        preferCache: !noCache,
        downloadImages: shouldDownloadImages,
        imageLimit: Number.isFinite(imageLimit) ? imageLimit : undefined
    });
    console.log(`Exercise DB synced. Rows: ${result.totalRows}. Downloaded images: ${result.downloadedImages}.`);
}
if (import.meta.url === `file://${process.argv[1]}`) {
    runCli()
        .catch((error) => {
        console.error("Exercise DB sync failed:", error);
        process.exit(1);
    })
        .finally(async () => {
        await pool.end();
    });
}
