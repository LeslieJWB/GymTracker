import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import {
  ExerciseDetail,
  ExerciseItem,
  RecordDetail,
  RecordSummary,
  Screen,
  SetDrafts,
  User
} from "../types/workout";
import { DATE_PATTERN, daysAgo, todayDate } from "../utils/date";
import { requestKey } from "../utils/request";

const DEFAULT_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export function useGymTracker() {
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [screen, setScreen] = useState<Screen>("record");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const [historyFrom, setHistoryFrom] = useState(daysAgo(60));
  const [historyTo, setHistoryTo] = useState(todayDate());
  const [recordSummaries, setRecordSummaries] = useState<RecordSummary[]>([]);

  const [selectedDate, setSelectedDate] = useState(todayDate());
  const [recordDetail, setRecordDetail] = useState<RecordDetail | null>(null);
  const [exerciseItems, setExerciseItems] = useState<ExerciseItem[]>([]);
  const [selectedExerciseItemId, setSelectedExerciseItemId] = useState<string>("");
  const [newExerciseNotes, setNewExerciseNotes] = useState("");
  const [initialSetReps, setInitialSetReps] = useState("");
  const [initialSetWeight, setInitialSetWeight] = useState("");

  const [exerciseDetail, setExerciseDetail] = useState<ExerciseDetail | null>(null);
  const [exerciseNotesDraft, setExerciseNotesDraft] = useState("");
  const [newSetReps, setNewSetReps] = useState("");
  const [newSetWeight, setNewSetWeight] = useState("");
  const [setDrafts, setSetDrafts] = useState<SetDrafts>({});

  const normalizedUrl = useMemo(() => backendUrl.trim().replace(/\/$/, ""), [backendUrl]);

  async function apiJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${normalizedUrl}${path}`, init);
    const raw = await response.text();
    if (!response.ok) {
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/2dcdadeb-a66d-4c0e-a93d-8cc544bdbbcb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: "initial",
          hypothesisId: "H3",
          location: "mobile/src/hooks/useGymTracker.ts:49",
          message: "apiJson non-OK response",
          data: {
            normalizedUrl,
            path,
            status: response.status,
            responseBody: raw.slice(0, 300)
          },
          timestamp: Date.now()
        })
      }).catch(() => {});
      // #endregion
      throw new Error(raw || `HTTP ${response.status}`);
    }
    if (!raw) {
      return undefined as T;
    }
    return JSON.parse(raw) as T;
  }

  async function bootstrap(): Promise<void> {
    setLoading(true);
    try {
      const [bootUser, items] = await Promise.all([
        apiJson<User>("/users/bootstrap"),
        apiJson<ExerciseItem[]>("/exercise-items")
      ]);
      setUser(bootUser);
      setExerciseItems(items);
      if (items.length > 0) {
        setSelectedExerciseItemId(items[0].id);
      }
    } catch (error) {
      Alert.alert("Failed to bootstrap", String(error));
    } finally {
      setLoading(false);
    }
  }

  async function loadHomeHistory(): Promise<void> {
    if (!user) {
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/2dcdadeb-a66d-4c0e-a93d-8cc544bdbbcb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: "initial",
          hypothesisId: "H2",
          location: "mobile/src/hooks/useGymTracker.ts:99",
          message: "loadHomeHistory skipped because user is null",
          data: { hasUser: false },
          timestamp: Date.now()
        })
      }).catch(() => {});
      // #endregion
      return;
    }
    const fromValue = historyFrom.trim();
    const toValue = historyTo.trim();
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/2dcdadeb-a66d-4c0e-a93d-8cc544bdbbcb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "initial",
        hypothesisId: "H1",
        location: "mobile/src/hooks/useGymTracker.ts:117",
        message: "loadHomeHistory input values",
        data: {
          userId: user.id,
          historyFrom,
          historyTo,
          fromValue,
          toValue,
          fromPatternOk: DATE_PATTERN.test(fromValue),
          toPatternOk: DATE_PATTERN.test(toValue)
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion
    if (!DATE_PATTERN.test(fromValue) || !DATE_PATTERN.test(toValue)) {
      const fallbackFrom = daysAgo(60);
      const fallbackTo = todayDate();
      setHistoryFrom(fallbackFrom);
      setHistoryTo(fallbackTo);
      Alert.alert(
        "Invalid date range",
        "Reset date range to the last 60 days. Use YYYY-MM-DD for from/to."
      );
      return;
    }
    if (fromValue > toValue) {
      Alert.alert("Invalid range", "'from' date cannot be after 'to' date.");
      return;
    }
    setLoading(true);
    try {
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/2dcdadeb-a66d-4c0e-a93d-8cc544bdbbcb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: "initial",
          hypothesisId: "H3",
          location: "mobile/src/hooks/useGymTracker.ts:155",
          message: "Calling records endpoint",
          data: {
            normalizedUrl,
            userId: user.id,
            fromValue,
            toValue
          },
          timestamp: Date.now()
        })
      }).catch(() => {});
      // #endregion
      const rows = await apiJson<RecordSummary[]>(
        `/records?userId=${encodeURIComponent(user.id)}&from=${encodeURIComponent(
          fromValue
        )}&to=${encodeURIComponent(toValue)}`
      );
      setRecordSummaries(rows);
    } catch (error) {
      Alert.alert("Failed to load history", String(error));
    } finally {
      setLoading(false);
    }
  }

  async function openDate(date: string): Promise<void> {
    if (!user) {
      return;
    }
    setSelectedDate(date);
    setLoading(true);
    try {
      const detail = await apiJson<Omit<RecordDetail, "foodConsumptions" | "totalCaloriesKcal" | "totalProteinG"> | null>(
        `/records/by-date?userId=${encodeURIComponent(user.id)}&date=${encodeURIComponent(date)}`
      );
      if (detail) {
        setRecordDetail({
          ...detail,
          foodConsumptions: [],
          totalCaloriesKcal: 0,
          totalProteinG: 0
        });
      } else {
        setRecordDetail({
          recordId: "",
          date,
          userId: user.id,
          theme: null,
          exercises: [],
          foodConsumptions: [],
          totalCaloriesKcal: 0,
          totalProteinG: 0
        });
      }
      setScreen("record");
    } catch (error) {
      Alert.alert("Failed to open record", String(error));
    } finally {
      setLoading(false);
    }
  }

  async function addExercise(): Promise<void> {
    if (!user) {
      return;
    }
    if (!DATE_PATTERN.test(selectedDate)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD.");
      return;
    }
    if (!selectedExerciseItemId) {
      Alert.alert("Missing exercise", "Select an exercise item first.");
      return;
    }

    const reps = Number(initialSetReps);
    const weight = Number(initialSetWeight);
    const includeInitialSet =
      initialSetReps.trim().length > 0 || initialSetWeight.trim().length > 0;

    if (includeInitialSet) {
      if (!Number.isInteger(reps) || reps <= 0 || !Number.isFinite(weight) || weight < 0) {
        Alert.alert("Invalid set", "Initial set needs reps > 0 and weight >= 0.");
        return;
      }
    }

    setLoading(true);
    try {
      await apiJson<{ recordId: string; exercise: { id: string } }>(
        "/records/by-date/exercises",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": requestKey()
          },
          body: JSON.stringify({
            userId: user.id,
            date: selectedDate,
            exerciseItemId: selectedExerciseItemId,
            notes: newExerciseNotes.trim() || undefined,
            initialSets: includeInitialSet ? [{ reps, weight, setOrder: 0 }] : []
          })
        }
      );
      setNewExerciseNotes("");
      setInitialSetReps("");
      setInitialSetWeight("");
      await openDate(selectedDate);
      await loadHomeHistory();
    } catch (error) {
      Alert.alert("Failed to add exercise", String(error));
    } finally {
      setLoading(false);
    }
  }

  async function openExercise(exerciseId: string): Promise<void> {
    setLoading(true);
    try {
      const detail = await apiJson<ExerciseDetail>(`/exercises/${exerciseId}`);
      setExerciseDetail(detail);
      setExerciseNotesDraft(detail.notes ?? "");
      const drafts: SetDrafts = {};
      for (const setItem of detail.sets) {
        drafts[setItem.id] = {
          reps: String(setItem.reps),
          weight: String(setItem.weight),
          notes: setItem.notes ?? ""
        };
      }
      setSetDrafts(drafts);
      setScreen("record");
    } catch (error) {
      Alert.alert("Failed to open exercise", String(error));
    } finally {
      setLoading(false);
    }
  }

  async function saveExerciseNotes(): Promise<void> {
    if (!exerciseDetail) {
      return;
    }
    setLoading(true);
    try {
      await apiJson(`/exercises/${exerciseDetail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: exerciseNotesDraft.trim() || null
        })
      });
      await openExercise(exerciseDetail.id);
    } catch (error) {
      Alert.alert("Failed to save notes", String(error));
    } finally {
      setLoading(false);
    }
  }

  async function addSet(): Promise<void> {
    if (!exerciseDetail || !user) {
      return;
    }
    const reps = Number(newSetReps);
    const weight = Number(newSetWeight);
    if (!Number.isInteger(reps) || reps <= 0 || !Number.isFinite(weight) || weight < 0) {
      Alert.alert("Invalid set", "Reps must be positive integer and weight >= 0.");
      return;
    }
    setLoading(true);
    try {
      await apiJson(`/exercises/${exerciseDetail.id}/sets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestKey()
        },
        body: JSON.stringify({
          userId: user.id,
          reps,
          weight,
          setOrder: exerciseDetail.sets.length
        })
      });
      setNewSetReps("");
      setNewSetWeight("");
      await openExercise(exerciseDetail.id);
      await openDate(selectedDate);
      await loadHomeHistory();
    } catch (error) {
      Alert.alert("Failed to add set", String(error));
    } finally {
      setLoading(false);
    }
  }

  async function saveSet(setId: string): Promise<void> {
    const draft = setDrafts[setId];
    if (!draft) {
      return;
    }
    const reps = Number(draft.reps);
    const weight = Number(draft.weight);
    if (!Number.isInteger(reps) || reps <= 0 || !Number.isFinite(weight) || weight < 0) {
      Alert.alert("Invalid set", "Reps must be positive integer and weight >= 0.");
      return;
    }
    setLoading(true);
    try {
      await apiJson(`/exercise-sets/${setId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reps, weight })
      });
      if (exerciseDetail) {
        await openExercise(exerciseDetail.id);
      }
      await openDate(selectedDate);
      await loadHomeHistory();
    } catch (error) {
      Alert.alert("Failed to update set", String(error));
    } finally {
      setLoading(false);
    }
  }

  async function deleteSet(setId: string): Promise<void> {
    setLoading(true);
    try {
      await apiJson(`/exercise-sets/${setId}`, { method: "DELETE" });
      if (exerciseDetail) {
        await openExercise(exerciseDetail.id);
      }
      await openDate(selectedDate);
      await loadHomeHistory();
    } catch (error) {
      Alert.alert("Failed to delete set", String(error));
    } finally {
      setLoading(false);
    }
  }

  async function deleteExercise(): Promise<void> {
    if (!exerciseDetail) {
      return;
    }
    setLoading(true);
    try {
      await apiJson(`/exercises/${exerciseDetail.id}`, { method: "DELETE" });
      setScreen("record");
      setExerciseDetail(null);
      await openDate(selectedDate);
      await loadHomeHistory();
    } catch (error) {
      Alert.alert("Failed to delete exercise", String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedUrl]);

  useEffect(() => {
    if (user) {
      loadHomeHistory().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return {
    screen,
    setScreen,
    loading,
    user,
    backendUrl,
    setBackendUrl,
    historyFrom,
    setHistoryFrom,
    historyTo,
    setHistoryTo,
    recordSummaries,
    selectedDate,
    recordDetail,
    exerciseItems,
    selectedExerciseItemId,
    setSelectedExerciseItemId,
    newExerciseNotes,
    setNewExerciseNotes,
    initialSetReps,
    setInitialSetReps,
    initialSetWeight,
    setInitialSetWeight,
    exerciseDetail,
    exerciseNotesDraft,
    setExerciseNotesDraft,
    newSetReps,
    setNewSetReps,
    newSetWeight,
    setNewSetWeight,
    setDrafts,
    setSetDrafts,
    loadHomeHistory,
    openDate,
    addExercise,
    openExercise,
    saveExerciseNotes,
    addSet,
    saveSet,
    deleteSet,
    deleteExercise
  };
}
