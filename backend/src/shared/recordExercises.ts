import { toExerciseImageUrl } from "./exerciseImageUrl.js";

export type RecordExerciseRow = {
  exercise_id: string;
  exercise_item_id: string;
  exercise_item_name: string;
  exercise_item_category: string | null;
  exercise_item_image_path: string | null;
  notes: string | null;
  sort_order: number;
  set_count: string;
  completed_volume: number;
  session_count: string;
  completed_duration_seconds: number;
  completed_distance_km: number;
  updated_at: string;
};

export const RECORD_EXERCISE_DETAIL_SQL = `
  SELECT
    e.id AS exercise_id,
    e.exercise_item_id,
    ei.name AS exercise_item_name,
    ei.category AS exercise_item_category,
    ei.image_path AS exercise_item_image_path,
    e.notes,
    e.sort_order,
    COUNT(es.id) FILTER (WHERE es.is_completed)::text AS set_count,
    COALESCE(SUM(CASE WHEN es.is_completed THEN es.reps * es.weight ELSE 0 END), 0)::double precision AS completed_volume,
    COUNT(cs.id) FILTER (WHERE cs.is_completed)::text AS session_count,
    COALESCE(SUM(CASE WHEN cs.is_completed THEN cs.duration_seconds ELSE 0 END), 0)::double precision AS completed_duration_seconds,
    COALESCE(SUM(CASE WHEN cs.is_completed AND cs.distance_km IS NOT NULL THEN cs.distance_km ELSE 0 END), 0)::double precision AS completed_distance_km,
    e.updated_at::text
  FROM exercises e
  JOIN exercise_items ei ON ei.id = e.exercise_item_id
  LEFT JOIN exercise_sets es ON es.exercise_id = e.id
  LEFT JOIN cardio_sessions cs ON cs.exercise_id = e.id
  WHERE e.record_id = $1
  GROUP BY
    e.id,
    e.exercise_item_id,
    ei.name,
    ei.category,
    ei.image_path,
    e.notes,
    e.sort_order,
    e.updated_at
  ORDER BY e.sort_order ASC, e.created_at ASC
`;

export function mapRecordExerciseRow(row: RecordExerciseRow) {
  return {
    id: row.exercise_id,
    exerciseItemId: row.exercise_item_id,
    exerciseItemName: row.exercise_item_name,
    exerciseItemCategory: row.exercise_item_category,
    exerciseItemImageUrl: toExerciseImageUrl(row.exercise_item_image_path),
    notes: row.notes,
    sortOrder: row.sort_order,
    setCount: Number(row.set_count),
    completedVolume: Number(row.completed_volume),
    sessionCount: Number(row.session_count),
    completedDurationSeconds: Number(row.completed_duration_seconds),
    completedDistanceKm: Number(row.completed_distance_km),
    updatedAt: row.updated_at
  };
}
