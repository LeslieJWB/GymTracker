import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Fraunces_600SemiBold, Fraunces_700Bold } from "@expo-google-fonts/fraunces";
import { Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold } from "@expo-google-fonts/nunito";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthScreen } from "./src/components/AuthScreen";
import { KeyboardDoneBar, DONE_BAR_ID } from "./src/components/KeyboardDoneBar";
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
  DailyNutritionTargets,
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
  UserProfile,
  WorkoutTemplateDetail,
  WorkoutTemplateSummary
} from "./src/types/workout";
import { DATE_PATTERN, daysAgo, todayDate } from "./src/utils/date";
import { requestKey } from "./src/utils/request";
import { organicShapes, palette, radius, shadows, textStyles, withPressScale } from "./src/styles/theme";

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

function sanitizeWeightInput(value: string): string {
  const normalized = value.replace(",", ".").replace(/[^0-9.]/g, "");
  const [whole, ...decimals] = normalized.split(".");
  if (decimals.length === 0) {
    return whole;
  }
  return `${whole}.${decimals.join("")}`;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function parseDateValue(value: string): Date | null {
  const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) {
    return null;
  }

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return null;
  }

  return parsed;
}

function parseApiErrorPayload(error: unknown): { message: string; code: string | null } {
  const raw = error instanceof Error ? error.message : String(error);
  try {
    const parsed = JSON.parse(raw) as { error?: string; code?: string };
    return {
      message: parsed.error ?? raw,
      code: parsed.code ?? null
    };
  } catch {
    return {
      message: raw,
      code: null
    };
  }
}

function fallbackNutritionTargetsFromWeight(weightKg: number | null): { calories: number; protein: number } {
  if (weightKg !== null && Number.isFinite(weightKg) && weightKg > 0) {
    return {
      calories: Math.round(weightKg * 42),
      protein: Math.round(weightKg * 2)
    };
  }
  return {
    calories: 2200,
    protein: 140
  };
}

export default function App() {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold
  });
  const { session, checkingSession, authError, signInWithProvider, signOut } = useAuthSession();
  const [screen, setScreen] = useState<Screen>("record");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
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
  const [dailyNutritionTargets, setDailyNutritionTargets] = useState<DailyNutritionTargets | null>(null);
  const [dailyTargetsDate, setDailyTargetsDate] = useState<string | null>(null);
  const [dailyCheckInThemeDraft, setDailyCheckInThemeDraft] = useState("");
  const [dailyCheckInWeightDraft, setDailyCheckInWeightDraft] = useState("");
  const [dailyCheckInSubmitting, setDailyCheckInSubmitting] = useState(false);
  const [onboardingGender, setOnboardingGender] = useState("");
  const [onboardingDefaultWeight, setOnboardingDefaultWeight] = useState("");
  const [onboardingHeight, setOnboardingHeight] = useState("");
  const [onboardingCalorieTarget, setOnboardingCalorieTarget] = useState("");
  const [onboardingProteinTarget, setOnboardingProteinTarget] = useState("");
  const [onboardingDateOfBirth, setOnboardingDateOfBirth] = useState("");
  const [showOnboardingDatePicker, setShowOnboardingDatePicker] = useState(false);
  const [onboardingPendingDate, setOnboardingPendingDate] = useState<Date>(new Date());
  const [onboardingLlmPrompt, setOnboardingLlmPrompt] = useState("");
  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const normalizedUrl = useMemo(() => DEFAULT_BACKEND_URL.trim().replace(/\/$/, ""), []);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event?.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  async function apiJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers ?? {});
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/2dcdadeb-a66d-4c0e-a93d-8cc544bdbbcb",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"c5f43b"},body:JSON.stringify({sessionId:"c5f43b",runId:"initial",hypothesisId:"H1",location:"mobile/App.tsx:apiJson:beforeFetch",message:"apiJson request start",data:{path,url:`${normalizedUrl}${path}`,method:init?.method ?? "GET",hasAuth:Boolean(session?.access_token)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const response = await fetch(`${normalizedUrl}${path}`, { ...init, headers });
    const raw = await response.text();
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/2dcdadeb-a66d-4c0e-a93d-8cc544bdbbcb",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"c5f43b"},body:JSON.stringify({sessionId:"c5f43b",runId:"initial",hypothesisId:"H1",location:"mobile/App.tsx:apiJson:afterFetch",message:"apiJson response received",data:{path,status:response.status,ok:response.ok,rawPreview:raw.slice(0,180)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
      setBootstrapError(null);
      setRecordDetail(null);
      setRecordSummaries([]);
      setCalendarSummaries([]);
      setBodyWeightDraft("");
      setSavedBodyWeightKg(null);
      setWeightHistory([]);
      setNutritionHistory([]);
      setStatisticsExerciseItemId(null);
      setExerciseMetricHistory([]);
      setDailyNutritionTargets(null);
      setDailyTargetsDate(null);
      setDailyCheckInThemeDraft("");
      setDailyCheckInWeightDraft("");
      setOnboardingGender("");
      setOnboardingDefaultWeight("");
      setOnboardingHeight("");
      setOnboardingDateOfBirth("");
      setOnboardingLlmPrompt("");
      return;
    }
    setLoading(true);
    setBootstrapError(null);
    try {
      const [profilePayload, items] = await Promise.all([
        apiJson<UserProfile>("/me/profile"),
        apiJson<ExerciseItem[]>("/exercise-items")
      ]);
      const bootUser: User = {
        id: profilePayload.id,
        username: profilePayload.username,
        displayName: profilePayload.displayName,
        email: profilePayload.email,
        authProvider: profilePayload.authProvider
      };
      setUser(bootUser);
      setProfile(profilePayload);
      setExerciseItems(items);
      if (!profilePayload.profileInitialized) {
        setRecordDetail(null);
        setRecordThemeDraft("");
        setSavedBodyWeightKg(null);
        setBodyWeightDraft("");
        setDailyNutritionTargets(null);
        setDailyTargetsDate(null);
        return;
      }
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
        if (detail.dailyCalorieTargetKcal !== null && detail.dailyProteinTargetG !== null) {
          setDailyNutritionTargets({
            source: detail.dailyTargetSource ?? "fallback",
            recommendedCaloriesKcal: detail.dailyCalorieTargetKcal,
            recommendedProteinG: detail.dailyProteinTargetG,
            comment: detail.dailyTargetComment
          });
          setDailyTargetsDate(today);
        } else {
          setDailyNutritionTargets(null);
          setDailyTargetsDate(null);
        }
      } else {
        setRecordDetail({
          recordId: "",
          date: today,
          userId: bootUser.id,
          theme: null,
          checkInInitialized: false,
          dailyCalorieTargetKcal: null,
          dailyProteinTargetG: null,
          dailyTargetComment: null,
          dailyTargetSource: null,
          exercises: [],
          foodConsumptions: food.entries,
          totalCaloriesKcal: food.totalCaloriesKcal,
          totalProteinG: food.totalProteinG
        });
        setRecordThemeDraft("");
        setDailyNutritionTargets(null);
        setDailyTargetsDate(null);
      }
      setSavedBodyWeightKg(weight);
      setBodyWeightDraft(weight === null ? "" : String(weight));
      setDailyCheckInThemeDraft(detail?.theme ?? "");
      setDailyCheckInWeightDraft(weight === null ? "" : String(weight));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBootstrapError(message);
      Alert.alert("Failed to bootstrap", message);
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(payload: {
    heightCm: number | null;
    gender: string | null;
    defaultBodyWeightKg: number | null;
    dailyCalorieTargetKcal: number | null;
    dailyProteinTargetG: number | null;
    dateOfBirth: string | null;
    globalLlmPrompt: string | null;
    profileInitialized?: boolean;
  }, options?: { showSuccessAlert?: boolean }): Promise<void> {
    const showSuccessAlert = options?.showSuccessAlert ?? true;
    setSavingProfile(true);
    try {
      if (
        payload.dailyCalorieTargetKcal !== null &&
        (!Number.isFinite(payload.dailyCalorieTargetKcal) ||
          payload.dailyCalorieTargetKcal < 800 ||
          payload.dailyCalorieTargetKcal > 6000)
      ) {
        Alert.alert("Invalid calorie target", "Daily calorie target must be between 800 and 6000 kcal.");
        return;
      }
      if (
        payload.dailyProteinTargetG !== null &&
        (!Number.isFinite(payload.dailyProteinTargetG) ||
          payload.dailyProteinTargetG < 30 ||
          payload.dailyProteinTargetG > 400)
      ) {
        Alert.alert("Invalid protein target", "Daily protein target must be between 30 and 400 g.");
        return;
      }
      const next = await apiJson<UserProfile>("/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const overrideChanged =
        profile?.dailyCalorieTargetKcal !== next.dailyCalorieTargetKcal ||
        profile?.dailyProteinTargetG !== next.dailyProteinTargetG;
      setProfile(next);
      setUser({
        id: next.id,
        username: next.username,
        displayName: next.displayName,
        email: next.email,
        authProvider: next.authProvider
      });
      if (overrideChanged) {
        setDailyNutritionTargets(null);
        setDailyTargetsDate(null);
        if (screen === "record" && selectedDate === todayDate()) {
          fetchDailyNutritionTargets(selectedDate)
            .then((targets) => {
              setDailyNutritionTargets(targets);
              setDailyTargetsDate(selectedDate);
            })
            .catch(() => {
              const fallback = fallbackNutritionTargetsFromWeight(savedBodyWeightKg);
              setDailyNutritionTargets({
                source: "fallback",
                recommendedCaloriesKcal: fallback.calories,
                recommendedProteinG: fallback.protein,
                comment: "Auto fallback used because AI target generation was unavailable."
              });
              setDailyTargetsDate(selectedDate);
            });
        }
      }
      if (showSuccessAlert) {
        Alert.alert("Profile saved");
      }
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
        if (detail.dailyCalorieTargetKcal !== null && detail.dailyProteinTargetG !== null) {
          setDailyNutritionTargets({
            source: detail.dailyTargetSource ?? "fallback",
            recommendedCaloriesKcal: detail.dailyCalorieTargetKcal,
            recommendedProteinG: detail.dailyProteinTargetG,
            comment: detail.dailyTargetComment
          });
          setDailyTargetsDate(date);
        } else {
          setDailyNutritionTargets(null);
          setDailyTargetsDate(null);
        }
      } else {
        setRecordDetail({
          recordId: "",
          date,
          userId: user.id,
          theme: null,
          checkInInitialized: false,
          dailyCalorieTargetKcal: null,
          dailyProteinTargetG: null,
          dailyTargetComment: null,
          dailyTargetSource: null,
          exercises: [],
          foodConsumptions: food.entries,
          totalCaloriesKcal: food.totalCaloriesKcal,
          totalProteinG: food.totalProteinG
        });
        setRecordThemeDraft("");
        setDailyNutritionTargets(null);
        setDailyTargetsDate(null);
      }
      setSavedBodyWeightKg(weight.weightKg);
      setBodyWeightDraft(weight.weightKg === null ? "" : String(weight.weightKg));
      setDailyCheckInThemeDraft(detail?.theme ?? "");
      setDailyCheckInWeightDraft(weight.weightKg === null ? "" : String(weight.weightKg));
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

  async function listWorkoutTemplates(): Promise<WorkoutTemplateSummary[]> {
    if (!user) {
      return [];
    }
    return apiJson<WorkoutTemplateSummary[]>("/templates");
  }

  async function loadWorkoutTemplateDetail(templateId: string): Promise<WorkoutTemplateDetail> {
    return apiJson<WorkoutTemplateDetail>(`/templates/${encodeURIComponent(templateId)}`);
  }

  async function saveWorkoutTemplate(
    templateName: string
  ): Promise<{ ok: true } | { ok: false; conflict: boolean; message: string }> {
    if (!user || !recordDetail) {
      return { ok: false, conflict: false, message: "Open a workout day first." };
    }
    const trimmedName = templateName.trim();
    if (!trimmedName) {
      return { ok: false, conflict: false, message: "Template name is required." };
    }
    if ((recordDetail.exercises ?? []).length === 0) {
      return { ok: false, conflict: false, message: "Add at least one exercise before saving a template." };
    }

    try {
      const snapshotByExerciseId = new Map<string, ExerciseDetail>();
      for (const summary of recordDetail.exercises) {
        const existing = exerciseDetailsById[summary.id];
        if (existing) {
          snapshotByExerciseId.set(summary.id, existing);
          continue;
        }
        const detail = await apiJson<ExerciseDetail>(`/exercises/${summary.id}`);
        const fallbackImageUrl =
          detail.exerciseItemImageUrl ?? exerciseItems.find((item) => item.id === detail.exerciseItemId)?.imageUrl ?? null;
        snapshotByExerciseId.set(summary.id, {
          ...detail,
          exerciseItemImageUrl: fallbackImageUrl
        });
      }

      const payload = {
        name: trimmedName,
        exercises: recordDetail.exercises
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((summary, index) => {
            const detail = snapshotByExerciseId.get(summary.id);
            const sets = (detail?.sets ?? [])
              .slice()
              .sort((a, b) => a.setOrder - b.setOrder)
              .map((setItem, setIndex) => ({
                reps: setItem.reps,
                weight: setItem.weight,
                setOrder: setItem.setOrder ?? setIndex,
                notes: setItem.notes ?? undefined
              }));
            return {
              exerciseItemId: summary.exerciseItemId,
              notes: (detail?.notes ?? summary.notes ?? "") || undefined,
              sortOrder: summary.sortOrder ?? index,
              sets
            };
          })
      };

      await apiJson<{ id: string }>("/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      return { ok: true };
    } catch (error) {
      const parsed = parseApiErrorPayload(error);
      return {
        ok: false,
        conflict: parsed.code === "TEMPLATE_NAME_CONFLICT",
        message: parsed.message || "Failed to save template."
      };
    }
  }

  async function applyWorkoutTemplate(templateId: string): Promise<boolean> {
    if (!user) {
      return false;
    }
    try {
      const template = await loadWorkoutTemplateDetail(templateId);
      for (const exercise of template.exercises.slice().sort((a, b) => a.sortOrder - b.sortOrder)) {
        const ok = await addExercise({
          exerciseItemId: exercise.exerciseItemId,
          notes: exercise.notes ?? undefined,
          initialSets: exercise.sets
            .slice()
            .sort((a, b) => a.setOrder - b.setOrder)
            .map((setItem, index) => ({
              reps: setItem.reps,
              weight: setItem.weight,
              setOrder: setItem.setOrder ?? index,
              notes: setItem.notes ?? undefined
            }))
        });
        if (!ok) {
          return false;
        }
      }
      return true;
    } catch (error) {
      Alert.alert("Failed to load template", String(error));
      return false;
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
      setRecordThemeDraft(recordDetail?.theme ?? "");
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
      if (date === todayDate()) {
        try {
          const targets = await fetchDailyNutritionTargets(date);
          setDailyNutritionTargets(targets);
          setDailyTargetsDate(date);
        } catch {
          setDailyNutritionTargets(null);
          setDailyTargetsDate(null);
        }
      }
    } catch (error) {
      Alert.alert("Failed to save weight", String(error));
    } finally {
      setSavingBodyWeight(false);
    }
  }

  async function fetchDailyNutritionTargets(date: string): Promise<DailyNutritionTargets> {
    return apiJson<DailyNutritionTargets>("/advice/daily-nutrition-targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date })
    });
  }

  async function getLatestRecordedBodyWeightKg(date: string): Promise<number | null> {
    const payload = await apiJson<{ records: BodyWeightRecord[] }>(
      `/body-weight/history?from=${encodeURIComponent(daysAgo(3650))}&to=${encodeURIComponent(date)}`
    );
    const latest = payload.records[payload.records.length - 1];
    return latest?.weightKg ?? null;
  }

  async function submitDailyCheckInForToday(): Promise<void> {
    if (!user || !profile || selectedDate !== todayDate()) {
      return;
    }
    const trimmedTheme = dailyCheckInThemeDraft.trim();
    if (!trimmedTheme) {
      Alert.alert("Theme required", "Please provide today's theme before continuing.");
      return;
    }

    let weightToPersist: number | null = null;
    const typedWeight = dailyCheckInWeightDraft.trim();
    if (typedWeight.length > 0) {
      const numeric = Number(typedWeight.replace(",", "."));
      if (!Number.isFinite(numeric) || numeric < 20 || numeric > 400) {
        Alert.alert("Invalid weight", "Body weight must be between 20 and 400 kg.");
        return;
      }
      weightToPersist = Number(numeric.toFixed(2));
    } else {
      const latestRecorded = await getLatestRecordedBodyWeightKg(selectedDate);
      weightToPersist = latestRecorded ?? profile.defaultBodyWeightKg ?? null;
      if (weightToPersist === null) {
        Alert.alert("Weight required", "Please enter today's body weight or set a default body weight in onboarding.");
        return;
      }
    }

    setDailyCheckInSubmitting(true);
    try {
      const updatedRecord = await apiJson<{
        recordId: string;
        date: string;
        userId: string;
        theme: string | null;
        checkInInitialized: boolean;
      }>(
        "/records/by-date/theme",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: selectedDate,
            theme: trimmedTheme
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
          theme: updatedRecord.theme,
          checkInInitialized: updatedRecord.checkInInitialized
        };
      });
      setRecordSummaries((rows) =>
        rows.map((row) => (row.date === selectedDate ? { ...row, theme: updatedRecord.theme } : row))
      );
      setCalendarSummaries((rows) =>
        rows.map((row) => (row.date === selectedDate ? { ...row, theme: updatedRecord.theme } : row))
      );

      const weightPayload = await apiJson<{ date: string; weightKg: number }>(
        "/body-weight/by-date",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: selectedDate,
            weightKg: Number(weightToPersist.toFixed(2))
          })
        }
      );
      setSavedBodyWeightKg(weightPayload.weightKg);
      setBodyWeightDraft(String(weightPayload.weightKg));
      setDailyCheckInWeightDraft(String(weightPayload.weightKg));
      try {
        const targets = await fetchDailyNutritionTargets(selectedDate);
        setDailyNutritionTargets(targets);
        setDailyTargetsDate(selectedDate);
      } catch {
        const fallback = fallbackNutritionTargetsFromWeight(weightPayload.weightKg);
        setDailyNutritionTargets({
          source: "fallback",
          recommendedCaloriesKcal: fallback.calories,
          recommendedProteinG: fallback.protein,
          comment: "Auto fallback used because AI target generation was unavailable."
        });
        setDailyTargetsDate(selectedDate);
      }
    } catch (error) {
      Alert.alert("Failed to complete daily check-in", String(error));
    } finally {
      setDailyCheckInSubmitting(false);
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

  async function submitOnboarding(): Promise<void> {
    if (!profile) {
      return;
    }
    setOnboardingError(null);
    const gender = onboardingGender.trim();
    const dob = onboardingDateOfBirth.trim();
    const defaultWeight = Number(onboardingDefaultWeight.trim().replace(",", "."));
    const height = Number(onboardingHeight.trim().replace(",", "."));
    const calorieTargetRaw = onboardingCalorieTarget.trim();
    const proteinTargetRaw = onboardingProteinTarget.trim();
    const calorieTarget = calorieTargetRaw ? Number(calorieTargetRaw.replace(",", ".")) : null;
    const proteinTarget = proteinTargetRaw ? Number(proteinTargetRaw.replace(",", ".")) : null;
    const llmPrompt = onboardingLlmPrompt.trim();

    if (!gender) {
      setOnboardingError("Please provide your gender.");
      return;
    }
    if (!Number.isFinite(defaultWeight) || defaultWeight < 20 || defaultWeight > 400) {
      setOnboardingError("Default body weight must be between 20 and 400 kg.");
      return;
    }
    if (!Number.isFinite(height) || height < 50 || height > 280) {
      setOnboardingError("Height must be between 50 and 280 cm.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      setOnboardingError("Date of birth must use format YYYY-MM-DD.");
      return;
    }
    if (
      calorieTargetRaw.length > 0 &&
      (!Number.isFinite(calorieTarget) || calorieTarget === null || calorieTarget < 800 || calorieTarget > 6000)
    ) {
      setOnboardingError("Daily calorie target must be between 800 and 6000 kcal.");
      return;
    }
    if (
      proteinTargetRaw.length > 0 &&
      (!Number.isFinite(proteinTarget) || proteinTarget === null || proteinTarget < 30 || proteinTarget > 400)
    ) {
      setOnboardingError("Daily protein target must be between 30 and 400 g.");
      return;
    }
    setOnboardingSubmitting(true);
    try {
      const next = await apiJson<UserProfile>("/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender,
          defaultBodyWeightKg: Number(defaultWeight.toFixed(2)),
          heightCm: Number(height.toFixed(2)),
          dailyCalorieTargetKcal: calorieTarget === null ? null : Number(calorieTarget.toFixed(2)),
          dailyProteinTargetG: proteinTarget === null ? null : Number(proteinTarget.toFixed(2)),
          dateOfBirth: dob,
          globalLlmPrompt: llmPrompt.length > 0 ? llmPrompt : null,
          profileInitialized: true
        })
      });
      setProfile(next);
      setUser({
        id: next.id,
        username: next.username,
        displayName: next.displayName,
        email: next.email,
        authProvider: next.authProvider
      });
      if (!next.profileInitialized) {
        setOnboardingError("Setup was saved but not initialized. Please ensure all required fields are filled.");
        return;
      }
      await bootstrap();
    } catch (error) {
      setOnboardingError(`Failed to complete onboarding: ${String(error)}`);
    } finally {
      setOnboardingSubmitting(false);
    }
  }

  function openOnboardingDatePicker(): void {
    setOnboardingPendingDate(parseDateValue(onboardingDateOfBirth) ?? new Date());
    setShowOnboardingDatePicker(true);
  }

  function handleOnboardingDateChange(event: DateTimePickerEvent, selectedDate?: Date): void {
    if (Platform.OS === "android") {
      setShowOnboardingDatePicker(false);
      if (event.type === "set" && selectedDate) {
        setOnboardingDateOfBirth(toDateString(selectedDate));
      }
      return;
    }

    if (selectedDate) {
      setOnboardingPendingDate(selectedDate);
    }
  }

  useEffect(() => {
    if (!profile || profile.profileInitialized) {
      return;
    }
    setOnboardingGender(profile.gender ?? "");
    setOnboardingDefaultWeight(
      profile.defaultBodyWeightKg !== null && Number.isFinite(profile.defaultBodyWeightKg)
        ? String(profile.defaultBodyWeightKg)
        : ""
    );
    setOnboardingHeight(profile.heightCm !== null && Number.isFinite(profile.heightCm) ? String(profile.heightCm) : "");
    setOnboardingCalorieTarget(
      profile.dailyCalorieTargetKcal !== null && Number.isFinite(profile.dailyCalorieTargetKcal)
        ? String(profile.dailyCalorieTargetKcal)
        : ""
    );
    setOnboardingProteinTarget(
      profile.dailyProteinTargetG !== null && Number.isFinite(profile.dailyProteinTargetG)
        ? String(profile.dailyProteinTargetG)
        : ""
    );
    setOnboardingDateOfBirth(profile.dateOfBirth ?? "");
    setOnboardingLlmPrompt(profile.globalLlmPrompt ?? "");
  }, [profile]);

  useEffect(() => {
    if (selectedDate !== todayDate()) {
      return;
    }
    setDailyCheckInThemeDraft(recordDetail?.theme ?? "");
    setDailyCheckInWeightDraft(savedBodyWeightKg === null ? "" : String(savedBodyWeightKg));
  }, [selectedDate, recordDetail?.theme, savedBodyWeightKg]);

  useEffect(() => {
    const today = todayDate();
    if (!profile?.profileInitialized || selectedDate !== today || screen !== "record") {
      return;
    }
    const checkInInitialized = recordDetail?.checkInInitialized === true;
    const alreadyLoadedTargets = dailyTargetsDate === today && dailyNutritionTargets !== null;
    if (!checkInInitialized || alreadyLoadedTargets) {
      return;
    }
    fetchDailyNutritionTargets(today)
      .then((payload) => {
        setDailyNutritionTargets(payload);
        setDailyTargetsDate(today);
      })
      .catch(() => {
        const fallback = fallbackNutritionTargetsFromWeight(savedBodyWeightKg);
        setDailyNutritionTargets({
          source: "fallback",
          recommendedCaloriesKcal: fallback.calories,
          recommendedProteinG: fallback.protein,
          comment: "Auto fallback used because AI target generation was unavailable."
        });
        setDailyTargetsDate(today);
      });
  }, [
    profile?.profileInitialized,
    selectedDate,
    screen,
    recordDetail?.checkInInitialized,
    dailyTargetsDate,
    dailyNutritionTargets,
    savedBodyWeightKg
  ]);

  useRecordEffects({
    exerciseDetailsById,
    setSetDraftsByExerciseId
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

  const isTodayHome = screen === "record" && selectedDate === todayDate();
  const hasResolvedSelectedRecord =
    recordDetail !== null && recordDetail.date === selectedDate;
  const hasCompletedDailyCheckIn =
    hasResolvedSelectedRecord && recordDetail.checkInInitialized === true;
  const shouldBlockHomeWithDailyGate = Boolean(
    profile?.profileInitialized &&
      isTodayHome &&
      hasResolvedSelectedRecord &&
      !loading &&
      !hasCompletedDailyCheckIn
  );

  if (!fontsLoaded) {
    return <SafeAreaView style={appStyles.safeArea} />;
  }

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
          {loading ? <ActivityIndicator color={palette.primary} /> : null}
          <Text style={{ marginTop: 10 }}>
            {bootstrapError ? "Could not load your account." : "Loading your account..."}
          </Text>
          {bootstrapError ? (
            <Pressable
              style={({ pressed }) => [
                {
                  marginTop: 14,
                  minHeight: 44,
                  borderRadius: radius.pill,
                  paddingHorizontal: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: palette.primary
                },
                withPressScale(pressed)
              ]}
              onPress={() => {
                bootstrap().catch(() => {});
              }}
              disabled={loading}
            >
              <Text style={{ color: "#F3F4F1", fontFamily: textStyles.bodyBold.fontFamily }}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  if (profile && !profile.profileInitialized) {
    return (
      <SafeAreaView style={appStyles.safeArea}>
        <StatusBar style="dark" />
        <View pointerEvents="none" style={styles.backgroundWrap}>
          <View style={[styles.blob, styles.blobA]} />
          <View style={[styles.blob, styles.blobB]} />
        </View>
        <ScrollView
          contentContainerStyle={styles.onboardingContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.onboardingCard}>
            <Text style={styles.onboardingTitle}>Complete your profile</Text>
            <Text style={styles.onboardingHint}>
              We need these details once before you can continue.
            </Text>
            <View style={styles.onboardingField}>
              <Text style={styles.onboardingLabel}>Gender</Text>
              <View style={styles.onboardingSegmentedRow}>
                {(["male", "female"] as const).map((option) => {
                  const selected = onboardingGender === option;
                  return (
                    <Pressable
                      key={option}
                      style={[styles.onboardingSegmentedOption, selected && styles.onboardingSegmentedOptionActive]}
                      onPress={() => setOnboardingGender(option)}
                      disabled={onboardingSubmitting}
                    >
                      <Text style={[styles.onboardingSegmentedText, selected && styles.onboardingSegmentedTextActive]}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={styles.onboardingField}>
              <Text style={styles.onboardingLabel}>Default Body Weight (kg)</Text>
              <View style={styles.onboardingUnitRow}>
                <TextInput
                  style={styles.onboardingInput}
                  value={onboardingDefaultWeight}
                  onChangeText={(value) => setOnboardingDefaultWeight(sanitizeWeightInput(value))}
                  keyboardType="decimal-pad"
                  inputAccessoryViewID={DONE_BAR_ID}
                  placeholder="0"
                  placeholderTextColor="#78786C"
                  editable={!onboardingSubmitting}
                />
                <View style={styles.onboardingUnitBadge}>
                  <Text style={styles.onboardingUnitBadgeText}>kg</Text>
                </View>
              </View>
            </View>
            <View style={styles.onboardingField}>
              <Text style={styles.onboardingLabel}>Height (cm)</Text>
              <View style={styles.onboardingUnitRow}>
                <TextInput
                  style={styles.onboardingInput}
                  value={onboardingHeight}
                  onChangeText={(value) => setOnboardingHeight(digitsOnly(value))}
                  keyboardType="number-pad"
                  inputAccessoryViewID={DONE_BAR_ID}
                  placeholder="0"
                  placeholderTextColor="#78786C"
                  editable={!onboardingSubmitting}
                />
                <View style={styles.onboardingUnitBadge}>
                  <Text style={styles.onboardingUnitBadgeText}>cm</Text>
                </View>
              </View>
            </View>
            <View style={styles.onboardingField}>
              <Text style={styles.onboardingLabel}>Daily Calorie Target (kcal, optional)</Text>
              <View style={styles.onboardingUnitRow}>
                <TextInput
                  style={styles.onboardingInput}
                  value={onboardingCalorieTarget}
                  onChangeText={(value) => setOnboardingCalorieTarget(digitsOnly(value))}
                  keyboardType="number-pad"
                  inputAccessoryViewID={DONE_BAR_ID}
                  placeholder="e.g. 2200"
                  placeholderTextColor="#78786C"
                  editable={!onboardingSubmitting}
                />
                <View style={styles.onboardingUnitBadge}>
                  <Text style={styles.onboardingUnitBadgeText}>kcal</Text>
                </View>
              </View>
            </View>
            <View style={styles.onboardingField}>
              <Text style={styles.onboardingLabel}>Daily Protein Target (g, optional)</Text>
              <View style={styles.onboardingUnitRow}>
                <TextInput
                  style={styles.onboardingInput}
                  value={onboardingProteinTarget}
                  onChangeText={(value) => setOnboardingProteinTarget(digitsOnly(value))}
                  keyboardType="number-pad"
                  inputAccessoryViewID={DONE_BAR_ID}
                  placeholder="e.g. 150"
                  placeholderTextColor="#78786C"
                  editable={!onboardingSubmitting}
                />
                <View style={styles.onboardingUnitBadge}>
                  <Text style={styles.onboardingUnitBadgeText}>g</Text>
                </View>
              </View>
            </View>
            <View style={styles.onboardingField}>
              <Text style={styles.onboardingLabel}>Date of Birth</Text>
              <Pressable
                style={styles.onboardingDateButton}
                onPress={openOnboardingDatePicker}
                disabled={onboardingSubmitting}
              >
                <Text style={onboardingDateOfBirth ? styles.onboardingDateText : styles.onboardingDatePlaceholder}>
                  {onboardingDateOfBirth || "Select date"}
                </Text>
                <Text style={styles.onboardingDateChevron}>›</Text>
              </Pressable>
            </View>
            <View style={styles.onboardingField}>
              <Text style={styles.onboardingLabel}>Personal LLM Prompt (optional)</Text>
              <TextInput
                style={[styles.onboardingInput, styles.onboardingPromptInput]}
                value={onboardingLlmPrompt}
                onChangeText={setOnboardingLlmPrompt}
                inputAccessoryViewID={DONE_BAR_ID}
                placeholder="Optional guidance for your AI recommendations"
                placeholderTextColor="#78786C"
                editable={!onboardingSubmitting}
                multiline
                textAlignVertical="top"
                maxLength={3000}
              />
            </View>
            <Pressable
              style={({ pressed }) => [styles.onboardingButton, withPressScale(pressed)]}
              onPress={() => {
                submitOnboarding().catch(() => {});
              }}
              disabled={onboardingSubmitting}
            >
              {onboardingSubmitting ? (
                <ActivityIndicator color="#F3F4F1" />
              ) : (
                <Text style={styles.onboardingButtonText}>Finish Setup</Text>
              )}
            </Pressable>
            {onboardingError ? <Text style={styles.onboardingErrorText}>{onboardingError}</Text> : null}
          </View>
        </ScrollView>
        {Platform.OS === "android" && showOnboardingDatePicker ? (
          <DateTimePicker
            value={onboardingPendingDate}
            mode="date"
            display="calendar"
            maximumDate={new Date()}
            onChange={handleOnboardingDateChange}
          />
        ) : null}
        {Platform.OS === "ios" && showOnboardingDatePicker ? (
          <Modal animationType="slide" transparent onRequestClose={() => setShowOnboardingDatePicker(false)}>
            <Pressable style={styles.datePickerModalOverlay} onPress={() => setShowOnboardingDatePicker(false)}>
              <Pressable style={styles.datePickerModalCard} onPress={() => {}}>
                <View style={styles.datePickerModalHeader}>
                  <Pressable hitSlop={12} onPress={() => setShowOnboardingDatePicker(false)}>
                    <Text style={styles.datePickerModalCancel}>Cancel</Text>
                  </Pressable>
                  <Text style={styles.datePickerModalTitle}>Date of Birth</Text>
                  <Pressable
                    hitSlop={12}
                    onPress={() => {
                      setOnboardingDateOfBirth(toDateString(onboardingPendingDate));
                      setShowOnboardingDatePicker(false);
                    }}
                  >
                    <Text style={styles.datePickerModalDone}>Done</Text>
                  </Pressable>
                </View>
                <View style={styles.datePickerSpinnerContainer}>
                  <DateTimePicker
                    value={onboardingPendingDate}
                    mode="date"
                    display="spinner"
                    maximumDate={new Date()}
                    onChange={handleOnboardingDateChange}
                  />
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        ) : null}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={appStyles.safeArea}>
      <StatusBar style="dark" />
      <View pointerEvents="none" style={styles.backgroundWrap}>
        <View style={[styles.blob, styles.blobA]} />
        <View style={[styles.blob, styles.blobB]} />
      </View>
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
          shouldBlockHomeWithDailyGate ? (
            <View style={styles.homeBlockedWrap}>
              <View style={styles.homeBlockedCard}>
                <Text style={styles.homeBlockedTitle}>Daily check-in required</Text>
                <Text style={styles.homeBlockedHint}>
                  Add today&apos;s theme and weight so we can generate your nutrition targets.
                </Text>
              </View>
            </View>
          ) : (
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
                listWorkoutTemplates={() => listWorkoutTemplates()}
                saveWorkoutTemplate={saveWorkoutTemplate}
                applyWorkoutTemplate={applyWorkoutTemplate}
                fetchDailySummary={(date) => fetchDailySummary(date)}
                fetchExerciseFeedback={(input) => fetchExerciseFeedback(input)}
                dailyNutritionTargets={dailyTargetsDate === selectedDate ? dailyNutritionTargets : null}
              />
            </ScrollView>
          )
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
        <Modal
          visible={shouldBlockHomeWithDailyGate}
          animationType="fade"
          transparent
          onRequestClose={() => {}}
        >
          <View style={styles.dailyGateBackdrop}>
            <View style={styles.dailyGateCard}>
              <Text style={styles.dailyGateTitle}>Today&apos;s check-in</Text>
              <Text style={styles.dailyGateHint}>
                Add your theme and weight to unlock your daily nutrition targets.
              </Text>
              <View style={styles.dailyGateField}>
                <Text style={styles.dailyGateLabel}>Theme</Text>
                <TextInput
                  style={styles.dailyGateInput}
                  value={dailyCheckInThemeDraft}
                  onChangeText={setDailyCheckInThemeDraft}
                  inputAccessoryViewID={DONE_BAR_ID}
                  placeholder="e.g. push, pull, rest"
                  placeholderTextColor="#78786C"
                  editable={!dailyCheckInSubmitting}
                  maxLength={30}
                />
              </View>
              <View style={styles.dailyGateField}>
                <Text style={styles.dailyGateLabel}>Weight (optional)</Text>
                <TextInput
                  style={styles.dailyGateInput}
                  value={dailyCheckInWeightDraft}
                  onChangeText={(value) => setDailyCheckInWeightDraft(sanitizeWeightInput(value))}
                  keyboardType="decimal-pad"
                  inputAccessoryViewID={DONE_BAR_ID}
                  placeholder="Leave empty to use weight recorded before"
                  placeholderTextColor="#78786C"
                  editable={!dailyCheckInSubmitting}
                />
              </View>
              <Pressable
                style={({ pressed }) => [styles.dailyGateButton, withPressScale(pressed)]}
                onPress={() => {
                  submitDailyCheckInForToday().catch(() => {});
                }}
                disabled={dailyCheckInSubmitting}
              >
                {dailyCheckInSubmitting ? (
                  <ActivityIndicator color="#F3F4F1" />
                ) : (
                  <Text style={styles.dailyGateButtonText}>Continue to Home</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Modal>
        {!keyboardVisible ? (
          <View
            style={[
              styles.bottomNav,
              {
                paddingBottom: Math.max(10, insets.bottom)
              }
            ]}
          >
            <Pressable
              style={({ pressed }) => [
                styles.bottomNavItem,
                screen === "record" ? styles.bottomNavItemActive : null,
                withPressScale(pressed)
              ]}
              onPress={() => {
                openDate(todayDate()).catch(() => {});
              }}
              disabled={loading || !user}
            >
              <Text style={[styles.bottomNavLabel, screen === "record" ? styles.bottomNavLabelActive : null]}>Home</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.bottomNavItem,
                screen === "calendar" ? styles.bottomNavItemActive : null,
                withPressScale(pressed)
              ]}
              onPress={() => {
                setScreen("calendar");
              }}
              disabled={loading || !user}
            >
              <Text style={[styles.bottomNavLabel, screen === "calendar" ? styles.bottomNavLabelActive : null]}>Calendar</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.bottomNavItem,
                screen === "statistics" ? styles.bottomNavItemActive : null,
                withPressScale(pressed)
              ]}
              onPress={() => {
                setScreen("statistics");
                if (weightHistory.length === 0 && nutritionHistory.length === 0) {
                  loadStatisticsBase().catch(() => {});
                }
              }}
              disabled={loading || !user}
            >
              <Text style={[styles.bottomNavLabel, screen === "statistics" ? styles.bottomNavLabelActive : null]}>Statistics</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.bottomNavItem,
                screen === "profile" ? styles.bottomNavItemActive : null,
                withPressScale(pressed)
              ]}
              onPress={() => {
                setScreen("profile");
              }}
              disabled={loading || !user}
            >
              <Text style={[styles.bottomNavLabel, screen === "profile" ? styles.bottomNavLabelActive : null]}>Profile</Text>
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
      {Platform.OS === "ios" && keyboardVisible ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.fallbackDoneWrap,
            {
              bottom: Math.max(12, keyboardHeight + 8)
            }
          ]}
        >
          <Pressable
            style={({ pressed }) => [styles.fallbackDoneButton, pressed ? styles.fallbackDoneButtonPressed : null]}
            onPress={() => {
              Keyboard.dismiss();
            }}
          >
            <Text style={styles.fallbackDoneText}>Done</Text>
          </Pressable>
        </View>
      ) : null}
      <KeyboardDoneBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backgroundWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden"
  },
  blob: {
    position: "absolute",
    opacity: 0.2
  },
  blobA: {
    ...organicShapes.blobA,
    width: 280,
    height: 280,
    right: -120,
    top: -80,
    backgroundColor: "#E6DCCD"
  },
  blobB: {
    ...organicShapes.blobB,
    width: 230,
    height: 230,
    left: -100,
    bottom: 40,
    backgroundColor: "#E7EFE3"
  },
  recordScrollContent: {
    ...appStyles.container,
    paddingBottom: 24
  },
  onboardingContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: "center"
  },
  onboardingCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#DED8CF",
    backgroundColor: "#FEFEFA",
    padding: 18,
    gap: 10,
    ...shadows.soft
  },
  onboardingTitle: {
    fontSize: 28,
    color: "#2C2C24",
    fontFamily: textStyles.headingMd.fontFamily
  },
  onboardingHint: {
    color: "#78786C",
    fontSize: 14,
    fontFamily: textStyles.body.fontFamily
  },
  onboardingField: {
    gap: 6
  },
  onboardingLabel: {
    color: "#4A4A40",
    fontSize: 13,
    fontFamily: textStyles.bodyBold.fontFamily,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  onboardingSegmentedRow: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: radius.pill,
    padding: 4,
    gap: 4
  },
  onboardingSegmentedOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: "center"
  },
  onboardingSegmentedOptionActive: {
    backgroundColor: "#FEFEFA",
    shadowColor: "#78786C",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1
  },
  onboardingSegmentedText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#78786C"
  },
  onboardingSegmentedTextActive: {
    color: "#2C2C24"
  },
  onboardingUnitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  onboardingUnitBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DED8CF"
  },
  onboardingUnitBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569"
  },
  onboardingInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#DED8CF",
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#FFFFFFCC",
    color: "#2C2C24",
    fontFamily: textStyles.body.fontFamily,
    fontSize: 16
  },
  onboardingDateButton: {
    borderWidth: 1,
    borderColor: "#DED8CF",
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FFFFFFCC",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  onboardingDateText: {
    color: "#2C2C24",
    fontFamily: textStyles.body.fontFamily,
    fontSize: 16
  },
  onboardingDatePlaceholder: {
    color: "#78786C",
    fontFamily: textStyles.body.fontFamily,
    fontSize: 16
  },
  onboardingDateChevron: {
    color: "#78786C",
    fontSize: 22,
    fontWeight: "600"
  },
  onboardingPromptInput: {
    minHeight: 90,
    borderRadius: 20
  },
  onboardingButton: {
    marginTop: 8,
    borderRadius: radius.pill,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    ...shadows.soft
  },
  onboardingButtonText: {
    color: "#F3F4F1",
    fontSize: 16,
    fontFamily: textStyles.bodyBold.fontFamily
  },
  onboardingErrorText: {
    marginTop: 8,
    color: palette.destructive,
    fontSize: 13,
    fontFamily: textStyles.bodySemiBold.fontFamily
  },
  homeBlockedWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24
  },
  homeBlockedCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#DED8CF",
    borderRadius: 28,
    backgroundColor: "#FEFEFA",
    padding: 18,
    gap: 8,
    ...shadows.soft
  },
  homeBlockedTitle: {
    color: "#2C2C24",
    fontSize: 22,
    fontFamily: textStyles.headingMd.fontFamily
  },
  homeBlockedHint: {
    color: "#78786C",
    fontSize: 14,
    fontFamily: textStyles.body.fontFamily
  },
  dailyGateBackdrop: {
    flex: 1,
    backgroundColor: "#2C2C2430",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20
  },
  dailyGateCard: {
    width: "100%",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#DED8CF",
    backgroundColor: "#FEFEFA",
    padding: 18,
    gap: 10,
    ...shadows.soft
  },
  dailyGateTitle: {
    color: "#2C2C24",
    fontSize: 24,
    fontFamily: textStyles.headingMd.fontFamily
  },
  dailyGateHint: {
    color: "#78786C",
    fontSize: 13,
    fontFamily: textStyles.body.fontFamily
  },
  dailyGateField: {
    gap: 6
  },
  dailyGateLabel: {
    color: "#4A4A40",
    fontSize: 13,
    fontFamily: textStyles.bodyBold.fontFamily
  },
  dailyGateInput: {
    borderWidth: 1,
    borderColor: "#DED8CF",
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FFFFFFCC",
    color: "#2C2C24",
    fontFamily: textStyles.body.fontFamily
  },
  dailyGateButton: {
    marginTop: 6,
    borderRadius: radius.pill,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primary,
    ...shadows.soft
  },
  dailyGateButtonText: {
    color: "#F3F4F1",
    fontSize: 16,
    fontFamily: textStyles.bodyBold.fontFamily
  },
  bottomNav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: `${palette.border}AA`,
    backgroundColor: "#FFFFFFC8",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    ...shadows.soft
  },
  bottomNavItem: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  bottomNavItemActive: {
    backgroundColor: "#E8EEE4"
  },
  bottomNavLabel: {
    fontSize: 14,
    color: palette.mutedForeground,
    fontFamily: textStyles.bodyBold.fontFamily
  },
  bottomNavLabelActive: {
    color: palette.primary
  },
  fallbackDoneWrap: {
    position: "absolute",
    right: 12,
    zIndex: 1200
  },
  fallbackDoneButton: {
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6F2EA",
    borderWidth: 1,
    borderColor: "#DED8CF",
    ...shadows.soft
  },
  fallbackDoneButtonPressed: {
    opacity: 0.75
  },
  fallbackDoneText: {
    color: palette.primary,
    fontSize: 16,
    fontFamily: textStyles.bodyBold.fontFamily
  },
  datePickerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(44, 44, 36, 0.28)",
    justifyContent: "flex-end"
  },
  datePickerModalCard: {
    backgroundColor: "#FEFEFA",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34
  },
  datePickerModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#DED8CF"
  },
  datePickerSpinnerContainer: {
    paddingHorizontal: 16
  },
  datePickerModalCancel: {
    fontSize: 16,
    color: "#78786C",
    fontWeight: "600"
  },
  datePickerModalTitle: {
    fontSize: 16,
    color: "#2C2C24",
    fontWeight: "700"
  },
  datePickerModalDone: {
    fontSize: 16,
    color: "#5D7052",
    fontWeight: "700"
  }
});
