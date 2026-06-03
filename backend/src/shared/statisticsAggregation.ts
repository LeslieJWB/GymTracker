/**
 * Buckets daily statistics rows and aggregates with correct handling of missing days:
 * averages use only days that have data in the bucket (not calendar length).
 */

export type Granularity = "day" | "week" | "month" | "year";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toYmdUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Start of calendar period containing `ymd` (UTC), used as bucket id and sort key. */
export function bucketStartDate(ymd: string, g: Granularity): string {
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

type BodyWeightDaily = {
  date: string;
  weightKg: number;
  bodyFatPercentage: number | null;
};

export function aggregateBodyWeightHistory(
  rows: BodyWeightDaily[],
  g: Granularity
): BodyWeightDaily[] {
  if (g === "day") {
    return rows;
  }
  const groups = new Map<
    string,
    { weights: number[]; bodyFats: number[] }
  >();
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
  const out: BodyWeightDaily[] = [];
  for (const [bucketStart, bucket] of groups) {
    const n = bucket.weights.length;
    if (n === 0) continue;
    const avgW = bucket.weights.reduce((a, b) => a + b, 0) / n;
    const avgBf =
      bucket.bodyFats.length > 0
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

type NutritionDaily = {
  date: string;
  totalCaloriesKcal: number;
  totalProteinG: number;
  totalFatG: number;
};

export function aggregateNutritionHistory(
  rows: NutritionDaily[],
  g: Granularity
): NutritionDaily[] {
  if (g === "day") {
    return rows;
  }
  const groups = new Map<
    string,
    { calSum: number; calN: number; protSum: number; protN: number; fatSum: number; fatN: number }
  >();
  for (const row of rows) {
    const key = bucketStartDate(row.date, g);
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = { calSum: 0, calN: 0, protSum: 0, protN: 0, fatSum: 0, fatN: 0 };
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
    if (row.totalFatG > 0) {
      bucket.fatSum += row.totalFatG;
      bucket.fatN += 1;
    }
  }
  const out: NutritionDaily[] = [];
  for (const [bucketStart, bucket] of groups) {
    out.push({
      date: bucketStart,
      totalCaloriesKcal: bucket.calN > 0 ? bucket.calSum / bucket.calN : 0,
      totalProteinG: bucket.protN > 0 ? bucket.protSum / bucket.protN : 0,
      totalFatG: bucket.fatN > 0 ? bucket.fatSum / bucket.fatN : 0
    });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

type ExerciseDaily = {
  date: string;
  dailyVolume: number;
  topSetWeight: number;
  topSetVolume: number;
};

export function aggregateExerciseHistory(
  rows: ExerciseDaily[],
  g: Granularity
): ExerciseDaily[] {
  if (g === "day") {
    return rows;
  }
  const groups = new Map<
    string,
    {
      volumes: number[];
      topWeights: number[];
      topVolumes: number[];
    }
  >();
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
  const out: ExerciseDaily[] = [];
  for (const [bucketStart, bucket] of groups) {
    const n = bucket.volumes.length;
    if (n === 0) continue;
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

type CardioDaily = {
  date: string;
  dailyDurationSeconds: number;
  dailyDistanceKm: number;
  longestSessionSeconds: number;
};

export function aggregateCardioHistory(rows: CardioDaily[], g: Granularity): CardioDaily[] {
  if (g === "day") {
    return rows;
  }
  const groups = new Map<
    string,
    {
      durations: number[];
      distances: number[];
      longestSessions: number[];
    }
  >();
  for (const row of rows) {
    const key = bucketStartDate(row.date, g);
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = { durations: [], distances: [], longestSessions: [] };
      groups.set(key, bucket);
    }
    bucket.durations.push(row.dailyDurationSeconds);
    bucket.distances.push(row.dailyDistanceKm);
    bucket.longestSessions.push(row.longestSessionSeconds);
  }
  const out: CardioDaily[] = [];
  for (const [bucketStart, bucket] of groups) {
    const n = bucket.durations.length;
    if (n === 0) continue;
    out.push({
      date: bucketStart,
      dailyDurationSeconds: bucket.durations.reduce((a, b) => a + b, 0) / n,
      dailyDistanceKm: bucket.distances.reduce((a, b) => a + b, 0) / n,
      longestSessionSeconds: Math.max(...bucket.longestSessions)
    });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}
