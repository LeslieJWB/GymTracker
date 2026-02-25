import { useEffect } from "react";
import { Dispatch, SetStateAction } from "react";
import { ExerciseDetail, SetDrafts } from "../types/workout";

type SetDraftsByExerciseId = Record<string, SetDrafts>;
type SavingSetIdsByExerciseId = Record<string, Record<string, boolean>>;
type ExerciseNotesDraftById = Record<string, string>;
type SavingExerciseNotesById = Record<string, boolean>;

type UseRecordEffectsParams = {
  exerciseDetailsById: Record<string, ExerciseDetail>;
  expandedExerciseIds: string[];
  setDraftsByExerciseId: SetDraftsByExerciseId;
  savingSetIdsByExerciseId: SavingSetIdsByExerciseId;
  exerciseNotesDraftById: ExerciseNotesDraftById;
  savingExerciseNotesById: SavingExerciseNotesById;
  loading: boolean;
  setSetDraftsByExerciseId: Dispatch<SetStateAction<SetDraftsByExerciseId>>;
  saveExerciseNotes: (exerciseId: string) => Promise<void>;
  saveSet: (exerciseId: string, setId: string) => Promise<void>;
};

export function useRecordEffects({
  exerciseDetailsById,
  expandedExerciseIds,
  setDraftsByExerciseId,
  savingSetIdsByExerciseId,
  exerciseNotesDraftById,
  savingExerciseNotesById,
  loading,
  setSetDraftsByExerciseId,
  saveExerciseNotes,
  saveSet
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

  useEffect(() => {
    if (loading) {
      return;
    }
    let dirtyTarget: { exerciseId: string; setId: string } | null = null;
    for (const exerciseId of expandedExerciseIds) {
      const detail = exerciseDetailsById[exerciseId];
      const drafts = setDraftsByExerciseId[exerciseId] ?? {};
      if (!detail) {
        continue;
      }
      const dirtySet = detail.sets.find((setItem) => {
        const draft = drafts[setItem.id];
        if (!draft || savingSetIdsByExerciseId[exerciseId]?.[setItem.id]) {
          return false;
        }
        const reps = Number(draft.reps);
        const weight = Number(draft.weight);
        if (!Number.isInteger(reps) || reps <= 0 || !Number.isFinite(weight) || weight < 0) {
          return false;
        }
        return (
          String(setItem.reps) !== draft.reps ||
          String(setItem.weight) !== draft.weight
        );
      });
      if (dirtySet) {
        dirtyTarget = { exerciseId, setId: dirtySet.id };
        break;
      }
    }
    if (!dirtyTarget) {
      return;
    }
    const timeoutId = setTimeout(() => {
      saveSet(dirtyTarget.exerciseId, dirtyTarget.setId).catch(() => {});
    }, 550);
    return () => clearTimeout(timeoutId);
  }, [
    expandedExerciseIds,
    exerciseDetailsById,
    setDraftsByExerciseId,
    savingSetIdsByExerciseId,
    loading,
    saveSet
  ]);
}
