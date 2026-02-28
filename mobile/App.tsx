import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { AuthScreen } from "./src/components/AuthScreen";
import { CalendarScreen } from "./src/components/CalendarScreen";
import { NewExerciseDraft, NewExerciseSetDraft, RecordScreen } from "./src/components/RecordScreen.tsx";
import { ProfileScreen } from "./src/components/ProfileScreen";
import { StatisticsScreen } from "./src/components/StatisticsScreen";
import { useAppLifecycleEffects } from "./src/hooks/useAppLifecycleEffects";
import { useAuthSession } from "./src/hooks/useAuthSession";
import { useRecordEffects } from "./src/hooks/useRecordEffects";
import { appStyles } from "./src/styles/appStyles";
import {
  AdviceReviewResult,
  BodyWeightRecord,
  ExerciseDailyMetricsPoint,
  ExerciseDetail,
  ExerciseItem,
  FoodConsumption,
  NutritionDailyPoint,
  RecordDetail,
  RecordSummary,
  Screen,
  SetDraft,
  SetDrafts,
  User,
  UserProfile
} from "./src/types/workout";
import { DATE_PATTERN, daysAgo, todayDate } from "./src/utils/date";
import { requestKey } from "./src/utils/request";

const DEFAULT_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

type ExerciseDetailsById = Record<string, ExerciseDetail>;
type SetDraftsByExerciseId = Record<string, SetDrafts>;
type SavingSetIdsByExerciseId = Record<string, Record<string, boolean>>;
type ExerciseNotesDraftById = Record<string, string>;
type SavingExerciseNotesById = Record<string, boolean>;
type DeletingFoodIds = Record<string, boolean>;

type FoodImagePayload = {
  mimeType: string;
  dataBase64: string;
};

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthRange(monthCursor: Date): { from: string; to: string } {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  return {
    from: toDateString(monthStart),
    to: toDateString(monthEnd)
  };
}

export default function App() {
  const { session, checkingSession, authError, signInWithProvider, signOut } = useAuthSession();
  const [screen, setScreen] = useState<Screen>("record");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [recordSummaries, setRecordSummaries] = useState<RecordSummary[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [calendarSummaries, setCalendarSummaries] = useState<RecordSummary[]>([]);

  const [selectedDate, setSelectedDate] = useState(todayDate());
  const [recordDetail, setRecordDetail] = useState<RecordDetail | null>(null);
  const [recordThemeDraft, setRecordThemeDraft] = useState("");
  const [savingRecordTheme, setSavingRecordTheme] = useState(false);
  const [exerciseItems, setExerciseItems] = useState<ExerciseItem[]>([]);

  const [expandedExerciseIds, setExpandedExerciseIds] = useState<string[]>([]);
  const [exerciseDetailsById, setExerciseDetailsById] = useState<ExerciseDetailsById>({});
  const [exerciseNotesDraftById, setExerciseNotesDraftById] = useState<ExerciseNotesDraftById>({});
  const [savingExerciseNotesById, setSavingExerciseNotesById] = useState<SavingExerciseNotesById>({});
  const [setDraftsByExerciseId, setSetDraftsByExerciseId] = useState<SetDraftsByExerciseId>({});
  const [savingSetIdsByExerciseId, setSavingSetIdsByExerciseId] = useState<SavingSetIdsByExerciseId>({});
  const [savingFoodConsumption, setSavingFoodConsumption] = useState(false);
  const [deletingFoodIds, setDeletingFoodIds] = useState<DeletingFoodIds>({});
  const [bodyWeightDraft, setBodyWeightDraft] = useState("");
  const [savedBodyWeightKg, setSavedBodyWeightKg] = useState<number | null>(null);
  const [savingBodyWeight, setSavingBodyWeight] = useState(false);
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [weightHistory, setWeightHistory] = useState<BodyWeightRecord[]>([]);
  const [nutritionHistory, setNutritionHistory] = useState<NutritionDailyPoint[]>([]);
  const [statisticsExerciseItemId, setStatisticsExerciseItemId] = useState<string | null>(null);
  const [exerciseMetricHistory, setExerciseMetricHistory] = useState<ExerciseDailyMetricsPoint[]>([]);

  const normalizedUrl = useMemo(() => DEFAULT_BACKEND_URL.trim().replace(/\/$/, ""), []);

  async function apiJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers ?? {});
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
    const response = await fetch(`${normalizedUrl}${path}`, { ...init, headers });
    const raw = await response.text();
    if (!response.ok) {
      if (response.status === 401) {
        signOut().catch(() => {});
      }
      throw new Error(raw || `HTTP ${response.status}`);
    }
    if (!raw) {
      return undefined as T;
    }
    return JSON.parse(raw) as T;
  }

  function resetExerciseState(): void {
    setExpandedExerciseIds([]);
    setExerciseDetailsById({});
    setExerciseNotesDraftById({});
    setSavingExerciseNotesById({});
    setSetDraftsByExerciseId({});
    setSavingSetIdsByExerciseId({});
  }

  function applyExerciseImageFallback(detail: RecordDetail, itemsSource: ExerciseItem[] = exerciseItems): RecordDetail {
    const imageByExerciseItemId = new Map(itemsSource.map((item) => [item.id, item.imageUrl ?? null]));
    return {
      ...detail,
      exercises: detail.exercises.map((exercise) => ({
        ...exercise,
        exerciseItemImageUrl: exercise.exerciseItemImageUrl ?? imageByExerciseItemId.get(exercise.exerciseItemId) ?? null
      }))
    };
  }

  async function loadFoodByDate(userId: string, date: string): Promise<{
    entries: FoodConsumption[];
    totalCaloriesKcal: number;
    totalProteinG: number;
  }> {
    return apiJson<{ entries: FoodConsumption[]; totalCaloriesKcal: number; totalProteinG: number }>(
      `/records/by-date/food?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`
    );
  }

  async function loadBodyWeightByDate(date: string): Promise<{ date: string; weightKg: number | null }> {
    return apiJson<{ date: string; weightKg: number | null }>(
      `/body-weight/by-date?date=${encodeURIComponent(date)}`
    );
  }

  async function bootstrap(): Promise<void> {
    if (!session?.access_token) {
      setUser(null);
      setProfile(null);
      setRecordDetail(null);
      setRecordSummaries([]);
      setCalendarSummaries([]);
      setBodyWeightDraft("");
      setSavedBodyWeightKg(null);
      setWeightHistory([]);
      setNutritionHistory([]);
      setStatisticsExerciseItemId(null);
      setExerciseMetricHistory([]);
      return;
    }
    setLoading(true);
    try {
      const [bootUser, profilePayload, items] = await Promise.all([
        apiJson<User>("/me"),
        apiJson<UserProfile>("/me/profile"),
        apiJson<ExerciseItem[]>("/exercise-items")
      ]);
      setUser(bootUser);
      setProfile(profilePayload);
      setExerciseItems(items);
      const today = todayDate();
      setSelectedDate(today);
      setScreen("record");
      resetExerciseState();
      const [detail, food, weightPayload] = await Promise.all([
        apiJson<Omit<RecordDetail, "foodConsumptions" | "totalCaloriesKcal" | "totalProteinG"> | null>(
          `/records/by-date?userId=${encodeURIComponent(bootUser.id)}&date=${encodeURIComponent(today)}`
        ),
        loadFoodByDate(bootUser.id, today),
        loadBodyWeightByDate(today)
      ]);
      const weight = weightPayload.weightKg;
      if (detail) {
        setRecordDetail(
          applyExerciseImageFallback({
            ...detail,
            foodConsumptions: food.entries,
            totalCaloriesKcal: food.totalCaloriesKcal,
            totalProteinG: food.totalProteinG
          }, items)
        );
        setRecordThemeDraft(detail.theme ?? "");
      } else {
        setRecordDetail({
          recordId: "",
          date: today,
          userId: bootUser.id,
          theme: null,
          exercises: [],
          foodConsumptions: food.entries,
          totalCaloriesKcal: food.totalCaloriesKcal,
          totalProteinG: food.totalProteinG
        });
        setRecordThemeDraft("");
      }
      setSavedBodyWeightKg(weight);
      setBodyWeightDraft(weight === null ? "" : String(weight));
    } catch (error) {
      Alert.alert("Failed to bootstrap", String(error));
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(payload: {
    heightCm: number | null;
    gender: string | null;
    defaultBodyWeightKg: number | null;
    dateOfBirth: string | null;
    globalLlmPrompt: string | null;
  }): Promise<void> {
    setSavingProfile(true);
    try {
      const next = await apiJson<UserProfile>("/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      setProfile(next);
      setUser({
        id: next.id,
        username: next.username,
        displayName: next.displayName,
        email: next.email,
        authProvider: next.authProvider
      });
      Alert.alert("Profile saved");
    } catch (error) {
      Alert.alert("Failed to save profile", String(error));
    } finally {
      setSavingProfile(false);
    }
  }

  async function loadHomeHistory(from: string, to: string): Promise<void> {
    if (!user) {
      return;
    }
    if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to) || from > to) {
      return;
    }
    setLoading(true);
    try {
      const rows = await apiJson<RecordSummary[]>(
        `/records?userId=${encodeURIComponent(user.id)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );
      setRecordSummaries(rows);
    } catch (error) {
      Alert.alert("Failed to load history", String(error));
    } finally {
      setLoading(false);
    }
  }

  async function refreshHomeHistory(): Promise<void> {
    const oldestLoadedDate = daysAgo(29);
    await loadHomeHistory(oldestLoadedDate, todayDate());
  }

  async function loadCalendarHistory(monthCursor: Date): Promise<void> {
    if (!user) {
      return;
    }
    const { from, to } = monthRange(monthCursor);
    setLoading(true);
    try {
      const rows = await apiJson<RecordSummary[]>(
        `/records?userId=${encodeURIComponent(user.id)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );
      setCalendarSummaries(rows);
    } catch (error) {
      Alert.alert("Failed to load calendar", String(error));
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
    resetExerciseState();
    try {
      const [detail, food, weight] = await Promise.all([
        apiJson<Omit<RecordDetail, "foodConsumptions" | "totalCaloriesKcal" | "totalProteinG"> | null>(
          `/records/by-date?userId=${encodeURIComponent(user.id)}&date=${encodeURIComponent(date)}`
        ),
        loadFoodByDate(user.id, date),
        loadBodyWeightByDate(date)
      ]);
      if (detail) {
        setRecordDetail(
          applyExerciseImageFallback({
            ...detail,
            foodConsumptions: food.entries,
            totalCaloriesKcal: food.totalCaloriesKcal,
            totalProteinG: food.totalProteinG
          })
        );
        setRecordThemeDraft(detail.theme ?? "");
      } else {
        setRecordDetail({
          recordId: "",
          date,
          userId: user.id,
          theme: null,
          exercises: [],
          foodConsumptions: food.entries,
          totalCaloriesKcal: food.totalCaloriesKcal,
          totalProteinG: food.totalProteinG
        });
        setRecordThemeDraft("");
      }
      setSavedBodyWeightKg(weight.weightKg);
      setBodyWeightDraft(weight.weightKg === null ? "" : String(weight.weightKg));
      setScreen("record");
    } catch (error) {
      Alert.alert("Failed to open record", String(error));
    } finally {
      setLoading(false);
    }
  }

  async function ensureExerciseDetailLoaded(exerciseId: string): Promise<void> {
    if (exerciseDetailsById[exerciseId]) {
      return;
    }
    const detail = await apiJson<ExerciseDetail>(`/exercises/${exerciseId}`);
    const fallbackImageUrl =
      detail.exerciseItemImageUrl ?? exerciseItems.find((item) => item.id === detail.exerciseItemId)?.imageUrl ?? null;
    const detailWithImage: ExerciseDetail = {
      ...detail,
      exerciseItemImageUrl: fallbackImageUrl
    };
    const drafts: SetDrafts = {};
    for (const setItem of detailWithImage.sets) {
      drafts[setItem.id] = {
        reps: String(setItem.reps),
        weight: String(setItem.weight),
        notes: setItem.notes ?? ""
      };
    }
    setExerciseDetailsById((current) => ({ ...current, [exerciseId]: detailWithImage }));
    setExerciseNotesDraftById((current) => ({ ...current, [exerciseId]: detailWithImage.notes ?? "" }));
    setSetDraftsByExerciseId((current) => ({ ...current, [exerciseId]: drafts }));
    setSavingSetIdsByExerciseId((current) => ({
      ...current,
      [exerciseId]: current[exerciseId] ?? {}
    }));
  }

  async function toggleExerciseExpanded(exerciseId: string): Promise<void> {
    const isExpanded = expandedExerciseIds.includes(exerciseId);
    if (isExpanded) {
      setExpandedExerciseIds((current) => current.filter((id) => id !== exerciseId));
      return;
    }
    setExpandedExerciseIds((current) => [...current, exerciseId]);
    if (exerciseDetailsById[exerciseId]) {
      return;
    }
    try {
      setLoading(true);
      await ensureExerciseDetailLoaded(exerciseId);
    } catch (error) {
      setExpandedExerciseIds((current) => current.filter((id) => id !== exerciseId));
      Alert.alert("Failed to open exercise", String(error));
    } finally {
      setLoading(false);
    }
  }

  async function addExercise(draft: NewExerciseDraft): Promise<boolean> {
    if (!user) {
      return false;
    }
    if (!DATE_PATTERN.test(selectedDate)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD.");
      return false;
    }
    if (!draft.exerciseItemId) {
      Alert.alert("Missing exercise", "Select an exercise item first.");
      return false;
    }
    for (const setItem of draft.initialSets) {
      if (
        !Number.isInteger(setItem.reps) ||
        setItem.reps <= 0 ||
        !Number.isFinite(setItem.weight) ||
        setItem.weight < 0
      ) {
        Alert.alert("Invalid set", "Each set needs reps > 0 and weight >= 0.");
        return false;
      }
    }
    setLoading(true);
    try {
      const created = await apiJson<{ recordId: string; exercise: { id: string } }>(
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
            exerciseItemId: draft.exerciseItemId,
            notes: draft.notes?.trim() || undefined,
            initialSets: draft.initialSets.map((setItem: NewExerciseSetDraft, index: number) => ({
              reps: setItem.reps,
              weight: setItem.weight,
              setOrder: setItem.setOrder ?? index,
              notes: setItem.notes?.trim() || undefined
            }))
          })
        }
      );
      await openDate(selectedDate);
      await refreshHomeHistory();
      if (created.exercise.id) {
        setExpandedExerciseIds([created.exercise.id]);
        await ensureExerciseDetailLoaded(created.exercise.id);
      }
      return true;
    } catch (error) {
      Alert.alert("Failed to add exercise", String(error));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function saveRecordTheme(): Promise<void> {
    if (!user || !DATE_PATTERN.test(selectedDate) || savingRecordTheme || loading) {
      return;
    }
    setSavingRecordTheme(true);
    try {
      const trimmedTheme = recordThemeDraft.trim();
      const updatedRecord = await apiJson<{ recordId: string; date: string; userId: string; theme: string | null }>(
        "/records/by-date/theme",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            date: selectedDate,
            theme: trimmedTheme.length > 0 ? trimmedTheme : null
          })
        }
      );
      setRecordThemeDraft(updatedRecord.theme ?? "");
      setRecordDetail((current) => {
        if (!current || current.date !== selectedDate) {
          return current;
        }
        return {
          ...current,
          recordId: updatedRecord.recordId || current.recordId,
          theme: updatedRecord.theme
        };
      });
      setRecordSummaries((rows) =>
        rows.map((row) => (row.date === selectedDate ? { ...row, theme: updatedRecord.theme } : row))
      );
      setCalendarSummaries((rows) =>
        rows.map((row) => (row.date === selectedDate ? { ...row, theme: updatedRecord.theme } : row))
      );
    } catch (error) {
      Alert.alert("Failed to save theme", String(error));
    } finally {
      setSavingRecordTheme(false);
    }
  }

  function updateExerciseNotesDraft(exerciseId: string, value: string): void {
    setExerciseNotesDraftById((current) => ({ ...current, [exerciseId]: value }));
  }

  async function saveExerciseNotes(exerciseId: string): Promise<void> {
    const detail = exerciseDetailsById[exerciseId];
    if (!detail || loading || savingExerciseNotesById[exerciseId]) {
      return;
    }
    setSavingExerciseNotesById((current) => ({ ...current, [exerciseId]: true }));
    try {
      const notesDraft = exerciseNotesDraftById[exerciseId] ?? detail.notes ?? "";
      const normalizedNotes = notesDraft.trim();
      const updatedExercise = await apiJson<{ id: string; notes: string | null }>(`/exercises/${exerciseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: normalizedNotes.length > 0 ? normalizedNotes : null
        })
      });
      setExerciseNotesDraftById((current) => ({ ...current, [exerciseId]: updatedExercise.notes ?? "" }));
      setExerciseDetailsById((current) => ({
        ...current,
        [exerciseId]: {
          ...current[exerciseId],
          notes: updatedExercise.notes
        }
      }));
      setRecordDetail((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          exercises: current.exercises.map((item) =>
            item.id === exerciseId ? { ...item, notes: updatedExercise.notes } : item
          )
        };
      });
    } catch (error) {
      Alert.alert("Failed to save notes", String(error));
    } finally {
      setSavingExerciseNotesById((current) => ({ ...current, [exerciseId]: false }));
    }
  }

  function setSetDraft(exerciseId: string, setId: string, draft: SetDraft): void {
    setSetDraftsByExerciseId((current) => ({
      ...current,
      [exerciseId]: {
        ...(current[exerciseId] ?? {}),
        [setId]: draft
      }
    }));
  }

  async function addSet(exerciseId: string): Promise<boolean> {
    const detail = exerciseDetailsById[exerciseId];
    if (!detail || !user) {
      return false;
    }
    const previousSet = detail.sets[detail.sets.length - 1];
    const reps =
      previousSet && Number.isInteger(previousSet.reps) && previousSet.reps > 0
        ? previousSet.reps
        : 1;
    const weight =
      previousSet && Number.isFinite(previousSet.weight) && previousSet.weight >= 0
        ? previousSet.weight
        : 0;
    setLoading(true);
    try {
      const createdSet = await apiJson<{
        id: string;
        reps: number;
        weight: number;
        setOrder: number;
        notes: string | null;
        isCompleted: boolean;
      }>(`/exercises/${exerciseId}/sets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestKey()
        },
        body: JSON.stringify({
          userId: user.id,
          reps,
          weight,
          setOrder: detail.sets.length
        })
      });
      setExerciseDetailsById((current) => ({
        ...current,
        [exerciseId]: {
          ...current[exerciseId],
          sets: [...current[exerciseId].sets, createdSet].sort((a, b) => a.setOrder - b.setOrder)
        }
      }));
      setSetDraftsByExerciseId((current) => ({
        ...current,
        [exerciseId]: {
          ...(current[exerciseId] ?? {}),
          [createdSet.id]: {
            reps: String(createdSet.reps),
            weight: String(createdSet.weight),
            notes: createdSet.notes ?? ""
          }
        }
      }));
      setRecordDetail((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          exercises: current.exercises.map((item) =>
            item.id === exerciseId ? { ...item, setCount: item.setCount + 1 } : item
          )
        };
      });
      setRecordSummaries((rows) =>
        rows.map((row) =>
          row.date === selectedDate
            ? { ...row, setCount: row.setCount + 1, exerciseCount: Math.max(row.exerciseCount, 1) }
            : row
        )
      );
      setCalendarSummaries((rows) =>
        rows.map((row) =>
          row.date === selectedDate
            ? { ...row, setCount: row.setCount + 1, exerciseCount: Math.max(row.exerciseCount, 1) }
            : row
        )
      );
      return true;
    } catch (error) {
      Alert.alert("Failed to add set", String(error));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function fetchExercisePlan(
    userId: string,
    exerciseItemId: string,
    exerciseName: string,
    date: string
  ): Promise<{ sets: { reps: number; weight: number }[]; advice: string }> {
    const payload = await apiJson<{ sets: { reps: number; weight: number }[]; advice: string }>(
      "/advice/exercise-plan",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, exerciseItemId, exerciseName, date })
      }
    );
    return { sets: payload?.sets ?? [], advice: payload?.advice ?? "" };
  }

  async function addSetsFromPlan(
    exerciseId: string,
    sets: { reps: number; weight: number }[]
  ): Promise<boolean> {
    if (!user || sets.length === 0) return false;
    setLoading(true);
    try {
      const detail = exerciseDetailsById[exerciseId];
      const startOrder = detail ? detail.sets.length : 0;
      const created: { id: string; reps: number; weight: number; setOrder: number; notes: string | null; isCompleted: boolean }[] = [];
      for (let i = 0; i < sets.length; i++) {
        const set = sets[i];
        const createdSet = await apiJson<{
          id: string;
          reps: number;
          weight: number;
          setOrder: number;
          notes: string | null;
          isCompleted: boolean;
        }>(`/exercises/${exerciseId}/sets`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": requestKey()
          },
          body: JSON.stringify({
            userId: user.id,
            reps: set.reps,
            weight: set.weight,
            setOrder: startOrder + i,
            isCompleted: false
          })
        });
        created.push(createdSet);
      }
      const newSets = created.sort((a, b) => a.setOrder - b.setOrder);
      setExerciseDetailsById((current) => ({
        ...current,
        [exerciseId]: {
          ...current[exerciseId],
          sets: [...(current[exerciseId]?.sets ?? []), ...newSets].sort((a, b) => a.setOrder - b.setOrder)
        }
      }));
      setSetDraftsByExerciseId((current) => {
        const next: Record<string, SetDraft> = { ...(current[exerciseId] ?? {}) };
        for (const s of newSets) {
          next[s.id] = { reps: String(s.reps), weight: String(s.weight), notes: s.notes ?? "" };
        }
        return { ...current, [exerciseId]: next };
      });
      const addedCount = newSets.length;
      setRecordDetail((current) => {
        if (!current) return current;
        return {
          ...current,
          exercises: current.exercises.map((item) =>
            item.id === exerciseId ? { ...item, setCount: item.setCount + addedCount } : item
          )
        };
      });
      setRecordSummaries((rows) =>
        rows.map((row) =>
          row.date === selectedDate
            ? { ...row, setCount: row.setCount + addedCount, exerciseCount: Math.max(row.exerciseCount, 1) }
            : row
        )
      );
      setCalendarSummaries((rows) =>
        rows.map((row) =>
          row.date === selectedDate
            ? { ...row, setCount: row.setCount + addedCount, exerciseCount: Math.max(row.exerciseCount, 1) }
            : row
        )
      );
      return true;
    } catch (error) {
      Alert.alert("Failed to add suggested sets", String(error));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function saveSet(exerciseId: string, setId: string): Promise<void> {
    const draft = setDraftsByExerciseId[exerciseId]?.[setId];
    if (!draft || loading || savingSetIdsByExerciseId[exerciseId]?.[setId]) {
      return;
    }
    const reps = Number(draft.reps);
    const weight = Number(draft.weight);
    if (!Number.isInteger(reps) || reps <= 0 || !Number.isFinite(weight) || weight < 0) {
      return;
    }
    setSavingSetIdsByExerciseId((current) => ({
      ...current,
      [exerciseId]: {
        ...(current[exerciseId] ?? {}),
        [setId]: true
      }
    }));
    try {
      const normalizedNotes = draft.notes.trim();
      const updatedSet = await apiJson<{
        id: string;
        reps: number;
        weight: number;
        setOrder: number;
        notes: string | null;
        isCompleted: boolean;
      }>(`/exercise-sets/${setId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reps,
          weight,
          notes: normalizedNotes.length > 0 ? normalizedNotes : null
        })
      });
      setExerciseDetailsById((current) => ({
        ...current,
        [exerciseId]: {
          ...current[exerciseId],
          sets: current[exerciseId].sets.map((item) =>
            item.id === setId
              ? {
                  ...item,
                  reps: updatedSet.reps,
                  weight: updatedSet.weight,
                  setOrder: updatedSet.setOrder,
                  notes: updatedSet.notes,
                  isCompleted: updatedSet.isCompleted
                }
              : item
          )
        }
      }));
      setSetDraftsByExerciseId((current) => ({
        ...current,
        [exerciseId]: {
          ...(current[exerciseId] ?? {}),
          [setId]: {
            reps: String(updatedSet.reps),
            weight: String(updatedSet.weight),
            notes: updatedSet.notes ?? ""
          }
        }
      }));
    } catch (error) {
      Alert.alert("Failed to update set", String(error));
    } finally {
      setSavingSetIdsByExerciseId((current) => ({
        ...current,
        [exerciseId]: {
          ...(current[exerciseId] ?? {}),
          [setId]: false
        }
      }));
    }
  }

  async function toggleSetCompleted(exerciseId: string, setId: string): Promise<void> {
    if (loading || savingSetIdsByExerciseId[exerciseId]?.[setId]) {
      return;
    }
    const detail = exerciseDetailsById[exerciseId];
    const currentSet = detail?.sets.find((setItem) => setItem.id === setId);
    if (!currentSet) {
      return;
    }
    const nextIsCompleted = !currentSet.isCompleted;

    setExerciseDetailsById((current) => ({
      ...current,
      [exerciseId]: {
        ...current[exerciseId],
        sets: current[exerciseId].sets.map((setItem) =>
          setItem.id === setId ? { ...setItem, isCompleted: nextIsCompleted } : setItem
        )
      }
    }));
    setSavingSetIdsByExerciseId((current) => ({
      ...current,
      [exerciseId]: {
        ...(current[exerciseId] ?? {}),
        [setId]: true
      }
    }));

    try {
      const updatedSet = await apiJson<{
        id: string;
        reps: number;
        weight: number;
        setOrder: number;
        notes: string | null;
        isCompleted: boolean;
      }>(`/exercise-sets/${setId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: nextIsCompleted })
      });
      setExerciseDetailsById((current) => ({
        ...current,
        [exerciseId]: {
          ...current[exerciseId],
          sets: current[exerciseId].sets.map((setItem) =>
            setItem.id === setId
              ? {
                  ...setItem,
                  reps: updatedSet.reps,
                  weight: updatedSet.weight,
                  setOrder: updatedSet.setOrder,
                  notes: updatedSet.notes,
                  isCompleted: updatedSet.isCompleted
                }
              : setItem
          )
        }
      }));
      setSetDraftsByExerciseId((current) => ({
        ...current,
        [exerciseId]: {
          ...(current[exerciseId] ?? {}),
          [setId]: {
            reps: String(updatedSet.reps),
            weight: String(updatedSet.weight),
            notes: updatedSet.notes ?? ""
          }
        }
      }));
    } catch (error) {
      setExerciseDetailsById((current) => ({
        ...current,
        [exerciseId]: {
          ...current[exerciseId],
          sets: current[exerciseId].sets.map((setItem) =>
            setItem.id === setId ? { ...setItem, isCompleted: currentSet.isCompleted } : setItem
          )
        }
      }));
      Alert.alert("Failed to update set completion", String(error));
    } finally {
      setSavingSetIdsByExerciseId((current) => ({
        ...current,
        [exerciseId]: {
          ...(current[exerciseId] ?? {}),
          [setId]: false
        }
      }));
    }
  }

  async function deleteSet(exerciseId: string, setId: string): Promise<void> {
    setLoading(true);
    try {
      await apiJson(`/exercise-sets/${setId}`, { method: "DELETE" });
      setExerciseDetailsById((current) => {
        const currentDetail = current[exerciseId];
        if (!currentDetail) {
          return current;
        }
        return {
          ...current,
          [exerciseId]: {
            ...currentDetail,
            sets: currentDetail.sets
              .filter((item) => item.id !== setId)
              .map((item, index) => ({ ...item, setOrder: index }))
          }
        };
      });
      setSetDraftsByExerciseId((current) => {
        const currentDrafts = current[exerciseId] ?? {};
        const { [setId]: _removed, ...rest } = currentDrafts;
        return {
          ...current,
          [exerciseId]: rest
        };
      });
      setRecordDetail((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          exercises: current.exercises.map((item) =>
            item.id === exerciseId ? { ...item, setCount: Math.max(0, item.setCount - 1) } : item
          )
        };
      });
      setRecordSummaries((rows) =>
        rows.map((row) =>
          row.date === selectedDate ? { ...row, setCount: Math.max(0, row.setCount - 1) } : row
        )
      );
      setCalendarSummaries((rows) =>
        rows.map((row) =>
          row.date === selectedDate ? { ...row, setCount: Math.max(0, row.setCount - 1) } : row
        )
      );
    } catch (error) {
      Alert.alert("Failed to delete set", String(error));
    } finally {
      setLoading(false);
    }
  }

  async function deleteExerciseById(exerciseId: string): Promise<void> {
    if (loading) {
      return;
    }
    setLoading(true);
    try {
      await apiJson(`/exercises/${exerciseId}`, { method: "DELETE" });
      const removedSetCount = recordDetail?.exercises.find((item) => item.id === exerciseId)?.setCount ?? 0;
      const nextExerciseCount = Math.max(0, (recordDetail?.exercises.length ?? 0) - 1);
      setRecordDetail((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          exercises: current.exercises.filter((item) => item.id !== exerciseId)
        };
      });
      setRecordSummaries((rows) =>
        rows.map((row) =>
          row.date === selectedDate
            ? {
                ...row,
                exerciseCount: nextExerciseCount,
                setCount: Math.max(0, row.setCount - removedSetCount)
              }
            : row
        )
      );
      setCalendarSummaries((rows) =>
        rows.map((row) =>
          row.date === selectedDate
            ? {
                ...row,
                exerciseCount: nextExerciseCount,
                setCount: Math.max(0, row.setCount - removedSetCount)
              }
            : row
        )
      );
      setExpandedExerciseIds((current) => current.filter((id) => id !== exerciseId));
      setExerciseDetailsById((current) => {
        const { [exerciseId]: _removed, ...rest } = current;
        return rest;
      });
      setExerciseNotesDraftById((current) => {
        const { [exerciseId]: _removed, ...rest } = current;
        return rest;
      });
      setSavingExerciseNotesById((current) => {
        const { [exerciseId]: _removed, ...rest } = current;
        return rest;
      });
      setSetDraftsByExerciseId((current) => {
        const { [exerciseId]: _removed, ...rest } = current;
        return rest;
      });
      setSavingSetIdsByExerciseId((current) => {
        const { [exerciseId]: _removed, ...rest } = current;
        return rest;
      });
    } catch (error) {
      Alert.alert("Failed to delete exercise", String(error));
    } finally {
      setLoading(false);
    }
  }

  async function deleteExerciseFromRecord(exerciseId: string): Promise<void> {
    await deleteExerciseById(exerciseId);
  }

  async function addFoodConsumption(input: {
    text?: string;
    image?: FoodImagePayload;
  }): Promise<boolean> {
    if (!user) {
      return false;
    }
    const normalizedText = input.text?.trim();
    if (!normalizedText && !input.image) {
      Alert.alert("Missing input", "Provide a sentence, photo, or both.");
      return false;
    }
    setSavingFoodConsumption(true);
    try {
      const created = await apiJson<{
        recordId: string;
        entry: FoodConsumption;
        totalCaloriesKcal: number;
        totalProteinG: number;
      }>("/records/by-date/food", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestKey()
        },
        body: JSON.stringify({
          userId: user.id,
          date: selectedDate,
          text: normalizedText || undefined,
          image: input.image
        })
      });

      setRecordDetail((current) => {
        if (!current || current.date !== selectedDate) {
          return current;
        }
        const nextFood = [created.entry, ...current.foodConsumptions];
        return {
          ...current,
          recordId: current.recordId || created.recordId,
          foodConsumptions: nextFood,
          totalCaloriesKcal: created.totalCaloriesKcal,
          totalProteinG: created.totalProteinG
        };
      });
      return true;
    } catch (error) {
      Alert.alert("Failed to add food", String(error));
      return false;
    } finally {
      setSavingFoodConsumption(false);
    }
  }

  async function deleteFoodConsumption(foodConsumptionId: string): Promise<void> {
    if (!user) {
      return;
    }
    setDeletingFoodIds((current) => ({ ...current, [foodConsumptionId]: true }));
    try {
      const payload = await apiJson<{ totalCaloriesKcal: number; totalProteinG: number }>(
        `/food-consumptions/${foodConsumptionId}?userId=${encodeURIComponent(user.id)}`,
        { method: "DELETE" }
      );
      setRecordDetail((current) => {
        if (!current || current.date !== selectedDate) {
          return current;
        }
        return {
          ...current,
          foodConsumptions: current.foodConsumptions.filter((item) => item.id !== foodConsumptionId),
          totalCaloriesKcal: payload.totalCaloriesKcal,
          totalProteinG: payload.totalProteinG
        };
      });
    } catch (error) {
      Alert.alert("Failed to delete food", String(error));
    } finally {
      setDeletingFoodIds((current) => ({ ...current, [foodConsumptionId]: false }));
    }
  }

  async function saveBodyWeightByDate(date: string, draft: string): Promise<void> {
    const normalized = draft.trim();
    if (!normalized) {
      Alert.alert("Missing weight", "Please enter your body weight in kg.");
      return;
    }
    const numeric = Number(normalized.replace(",", "."));
    if (!Number.isFinite(numeric) || numeric < 20 || numeric > 400) {
      Alert.alert("Invalid weight", "Body weight must be between 20 and 400 kg.");
      return;
    }

    setSavingBodyWeight(true);
    try {
      const payload = await apiJson<{ date: string; weightKg: number }>(
        "/body-weight/by-date",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            weightKg: Number(numeric.toFixed(2))
          })
        }
      );
      setSavedBodyWeightKg(payload.weightKg);
      setBodyWeightDraft(String(payload.weightKg));
    } catch (error) {
      Alert.alert("Failed to save weight", String(error));
    } finally {
      setSavingBodyWeight(false);
    }
  }

  async function fetchDailySummary(date: string): Promise<AdviceReviewResult> {
    return apiJson<AdviceReviewResult>("/advice/daily-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date })
    });
  }

  async function fetchExerciseFeedback(input: {
    exerciseId: string;
    exerciseItemId: string;
    exerciseName: string;
    date: string;
  }): Promise<AdviceReviewResult> {
    return apiJson<AdviceReviewResult>("/advice/exercise-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
  }

  async function loadStatisticsBase(): Promise<void> {
    const from = daysAgo(365);
    const to = todayDate();
    setStatisticsLoading(true);
    try {
      const [weightPayload, nutritionPayload] = await Promise.all([
        apiJson<{ records: BodyWeightRecord[] }>(
          `/body-weight/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        ),
        apiJson<{ records: NutritionDailyPoint[] }>(
          `/statistics/nutrition-history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        )
      ]);
      setWeightHistory(weightPayload.records ?? []);
      setNutritionHistory(nutritionPayload.records ?? []);
    } catch (error) {
      Alert.alert("Failed to load statistics", String(error));
    } finally {
      setStatisticsLoading(false);
    }
  }

  async function loadExerciseMetrics(exerciseItemId: string): Promise<void> {
    const from = daysAgo(365);
    const to = todayDate();
    setStatisticsExerciseItemId(exerciseItemId);
    setStatisticsLoading(true);
    try {
      const payload = await apiJson<{ records: ExerciseDailyMetricsPoint[] }>(
        `/statistics/exercise-history?exerciseItemId=${encodeURIComponent(exerciseItemId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );
      setExerciseMetricHistory(payload.records ?? []);
    } catch (error) {
      Alert.alert("Failed to load exercise metrics", String(error));
    } finally {
      setStatisticsLoading(false);
    }
  }

  async function refreshStatistics(): Promise<void> {
    await loadStatisticsBase();
    if (statisticsExerciseItemId) {
      await loadExerciseMetrics(statisticsExerciseItemId);
    }
  }

  useRecordEffects({
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
  });

  useEffect(() => {
    if (!checkingSession) {
      bootstrap().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingSession, normalizedUrl, session?.access_token]);

  useAppLifecycleEffects({
    user,
    screen,
    calendarMonth,
    refreshHomeHistory,
    loadCalendarHistory
  });

  if (checkingSession) {
    return (
      <SafeAreaView style={appStyles.safeArea}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text>Checking session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={appStyles.safeArea}>
        <StatusBar style="dark" />
        <AuthScreen
          loading={authActionLoading}
          error={authError}
          onGoogle={() => {
            setAuthActionLoading(true);
            signInWithProvider("google")
              .catch(() => {})
              .finally(() => setAuthActionLoading(false));
          }}
          onApple={() => {
            setAuthActionLoading(true);
            signInWithProvider("apple")
              .catch(() => {})
              .finally(() => setAuthActionLoading(false));
          }}
        />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={appStyles.safeArea}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text>Loading your account...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={appStyles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={appStyles.flex}>
        {screen === "calendar" ? (
          <View style={appStyles.flex}>
            <CalendarScreen
              loading={loading}
              monthCursor={calendarMonth}
              recordSummaries={calendarSummaries}
              openDate={(date) => {
                openDate(date).catch(() => {});
              }}
              changeMonth={(offset) => {
                setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
              }}
            />
          </View>
        ) : null}
        {screen === "record" ? (
          <ScrollView contentContainerStyle={styles.recordScrollContent}>
            <RecordScreen
              loading={loading}
              savingRecordTheme={savingRecordTheme}
              selectedDate={selectedDate}
              recordDetail={recordDetail}
              recordThemeDraft={recordThemeDraft}
              setRecordThemeDraft={setRecordThemeDraft}
              saveRecordTheme={() => {
                saveRecordTheme().catch(() => {});
              }}
              exerciseItems={exerciseItems}
              addExercise={addExercise}
              deleteExerciseInRecord={(exerciseId: string) => {
                deleteExerciseFromRecord(exerciseId).catch(() => {});
              }}
              user={user}
              expandedExerciseIds={expandedExerciseIds}
              exerciseDetailsById={exerciseDetailsById}
              exerciseNotesDraftById={exerciseNotesDraftById}
              savingExerciseNotesById={savingExerciseNotesById}
              updateExerciseNotesDraft={updateExerciseNotesDraft}
              saveExerciseNotes={(exerciseId: string) => {
                saveExerciseNotes(exerciseId).catch(() => {});
              }}
              setDraftsByExerciseId={setDraftsByExerciseId}
              savingSetIdsByExerciseId={savingSetIdsByExerciseId}
              toggleExerciseExpanded={(exerciseId: string) => {
                toggleExerciseExpanded(exerciseId).catch(() => {});
              }}
              setSetDraft={setSetDraft}
              saveSet={(exerciseId: string, setId: string) => {
                saveSet(exerciseId, setId).catch(() => {});
              }}
              addSet={addSet}
              addSetsFromPlan={addSetsFromPlan}
              fetchExercisePlan={fetchExercisePlan}
              deleteSet={(exerciseId: string, setId: string) => {
                deleteSet(exerciseId, setId).catch(() => {});
              }}
              toggleSetCompleted={(exerciseId: string, setId: string) => {
                toggleSetCompleted(exerciseId, setId).catch(() => {});
              }}
              savingFoodConsumption={savingFoodConsumption}
              deletingFoodIds={deletingFoodIds}
              addFoodConsumption={addFoodConsumption}
              deleteFoodConsumption={(foodConsumptionId: string) => {
                deleteFoodConsumption(foodConsumptionId).catch(() => {});
              }}
              bodyWeightDraft={bodyWeightDraft}
              setBodyWeightDraft={setBodyWeightDraft}
              savedBodyWeightKg={savedBodyWeightKg}
              savingBodyWeight={savingBodyWeight}
              saveBodyWeight={() => {
                saveBodyWeightByDate(selectedDate, bodyWeightDraft).catch(() => {});
              }}
              fetchDailySummary={(date) => fetchDailySummary(date)}
              fetchExerciseFeedback={(input) => fetchExerciseFeedback(input)}
            />
          </ScrollView>
        ) : null}
        {screen === "profile" ? (
          <View style={appStyles.flex}>
            <ProfileScreen
              profile={profile}
              saving={savingProfile}
              onSave={saveProfile}
              onSignOut={() => {
                signOut().catch(() => {});
              }}
            />
          </View>
        ) : null}
        {screen === "statistics" ? (
          <View style={appStyles.flex}>
            <StatisticsScreen
              loading={statisticsLoading}
              exerciseItems={exerciseItems}
              weightRecords={weightHistory}
              nutritionRecords={nutritionHistory}
              selectedExerciseItemId={statisticsExerciseItemId}
              exerciseMetricRecords={exerciseMetricHistory}
              refreshStatistics={() => {
                refreshStatistics().catch(() => {});
              }}
              selectExerciseForMetrics={(exerciseItemId: string) => {
                loadExerciseMetrics(exerciseItemId).catch(() => {});
              }}
            />
          </View>
        ) : null}
        <View style={styles.bottomNav}>
          <Pressable
            style={[styles.bottomNavItem, screen === "record" ? styles.bottomNavItemActive : null]}
            onPress={() => {
              openDate(todayDate()).catch(() => {});
            }}
            disabled={loading || !user}
          >
            <Text style={styles.bottomNavLabel}>Home</Text>
          </Pressable>
          <Pressable
            style={[styles.bottomNavItem, screen === "calendar" ? styles.bottomNavItemActive : null]}
            onPress={() => {
              setScreen("calendar");
            }}
            disabled={loading || !user}
          >
            <Text style={styles.bottomNavLabel}>Calendar</Text>
          </Pressable>
          <Pressable
            style={[styles.bottomNavItem, screen === "statistics" ? styles.bottomNavItemActive : null]}
            onPress={() => {
              setScreen("statistics");
              if (weightHistory.length === 0 && nutritionHistory.length === 0) {
                loadStatisticsBase().catch(() => {});
              }
            }}
            disabled={loading || !user}
          >
            <Text style={styles.bottomNavLabel}>Statistics</Text>
          </Pressable>
          <Pressable
            style={[styles.bottomNavItem, screen === "profile" ? styles.bottomNavItemActive : null]}
            onPress={() => {
              setScreen("profile");
            }}
            disabled={loading || !user}
          >
            <Text style={styles.bottomNavLabel}>Profile</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  recordScrollContent: {
    ...appStyles.container,
    paddingBottom: 24
  },
  bottomNav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8
  },
  bottomNavItem: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  bottomNavItemActive: {
    backgroundColor: "#EFF6FF"
  },
  bottomNavLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155"
  }
});
