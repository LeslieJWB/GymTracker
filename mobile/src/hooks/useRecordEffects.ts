import { useEffect } from "react";
import { Dispatch, SetStateAction } from "react";
import { ExerciseDetail, SetDrafts } from "../types/workout";

type SetDraftsByExerciseId = Record<string, SetDrafts>;

type UseRecordEffectsParams = {
  exerciseDetailsById: Record<string, ExerciseDetail>;
  setSetDraftsByExerciseId: Dispatch<SetStateAction<SetDraftsByExerciseId>>;
};

export function useRecordEffects({
  exerciseDetailsById,
  setSetDraftsByExerciseId
}: UseRecordEffectsParams): void {
  useEffect(() => {
    setSetDraftsByExerciseId((current) => {
      const next: SetDraftsByExerciseId = { ...current };
      for (const [exerciseId, detail] of Object.entries(exerciseDetailsById)) {
        const existing = current[exerciseId] ?? {};
        const bySetId: SetDrafts = {};
        for (const setItem of detail.sets) {
          bySetId[setItem.id] = existing[setItem.id] ?? {
            reps: String(setItem.reps),
            weight: String(setItem.weight),
            notes: setItem.notes ?? ""
          };
        }
        next[exerciseId] = bySetId;
      }
      return next;
    });
  }, [exerciseDetailsById, setSetDraftsByExerciseId]);
}
