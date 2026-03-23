/**
 * Buckets daily statistics rows and aggregates with correct handling of missing days:
 * averages use only days that have data in the bucket (not calendar length).
 */
function pad2(n) {
    return String(n).padStart(2, "0");
}
function toYmdUtc(d) {
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
function parseYmd(ymd) {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}
/** Start of calendar period containing `ymd` (UTC), used as bucket id and sort key. */
export function bucketStartDate(ymd, g) {
    if (g === "day") {
        return ymd;
    }
    const d = parseYmd(ymd);
    if (g === "week") {
        const wd = d.getUTCDay();
        const mondayOffset = wd === 0 ? -6 : 1 - wd;
        const mon = new Date(d);
        mon.setUTCDate(d.getUTCDate() + mondayOffset);
        return toYmdUtc(mon);
    }
    if (g === "month") {
        return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-01`;
    }
    return `${d.getUTCFullYear()}-01-01`;
}
export function aggregateBodyWeightHistory(rows, g) {
    if (g === "day") {
        return rows;
    }
    const groups = new Map();
    for (const row of rows) {
        const key = bucketStartDate(row.date, g);
        let bucket = groups.get(key);
        if (!bucket) {
            bucket = { weights: [], bodyFats: [] };
            groups.set(key, bucket);
        }
        bucket.weights.push(row.weightKg);
        if (row.bodyFatPercentage !== null) {
            bucket.bodyFats.push(row.bodyFatPercentage);
        }
    }
    const out = [];
    for (const [bucketStart, bucket] of groups) {
        const n = bucket.weights.length;
        if (n === 0)
            continue;
        const avgW = bucket.weights.reduce((a, b) => a + b, 0) / n;
        const avgBf = bucket.bodyFats.length > 0
            ? bucket.bodyFats.reduce((a, b) => a + b, 0) / bucket.bodyFats.length
            : null;
        out.push({
            date: bucketStart,
            weightKg: avgW,
            bodyFatPercentage: avgBf
        });
    }
    out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return out;
}
export function aggregateNutritionHistory(rows, g) {
    if (g === "day") {
        return rows;
    }
    const groups = new Map();
    for (const row of rows) {
        const key = bucketStartDate(row.date, g);
        let bucket = groups.get(key);
        if (!bucket) {
            bucket = { calSum: 0, calN: 0, protSum: 0, protN: 0 };
            groups.set(key, bucket);
        }
        if (row.totalCaloriesKcal > 0) {
            bucket.calSum += row.totalCaloriesKcal;
            bucket.calN += 1;
        }
        if (row.totalProteinG > 0) {
            bucket.protSum += row.totalProteinG;
            bucket.protN += 1;
        }
    }
    const out = [];
    for (const [bucketStart, bucket] of groups) {
        out.push({
            date: bucketStart,
            totalCaloriesKcal: bucket.calN > 0 ? bucket.calSum / bucket.calN : 0,
            totalProteinG: bucket.protN > 0 ? bucket.protSum / bucket.protN : 0
        });
    }
    out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return out;
}
export function aggregateExerciseHistory(rows, g) {
    if (g === "day") {
        return rows;
    }
    const groups = new Map();
    for (const row of rows) {
        const key = bucketStartDate(row.date, g);
        let bucket = groups.get(key);
        if (!bucket) {
            bucket = { volumes: [], topWeights: [], topVolumes: [] };
            groups.set(key, bucket);
        }
        bucket.volumes.push(row.dailyVolume);
        bucket.topWeights.push(row.topSetWeight);
        bucket.topVolumes.push(row.topSetVolume);
    }
    const out = [];
    for (const [bucketStart, bucket] of groups) {
        const n = bucket.volumes.length;
        if (n === 0)
            continue;
        const avgVol = bucket.volumes.reduce((a, b) => a + b, 0) / n;
        const maxTw = Math.max(...bucket.topWeights);
        const maxTv = Math.max(...bucket.topVolumes);
        out.push({
            date: bucketStart,
            dailyVolume: avgVol,
            topSetWeight: maxTw,
            topSetVolume: maxTv
        });
    }
    out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return out;
}
