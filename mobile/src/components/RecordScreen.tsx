import { useEffect, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { appStyles } from "../styles/appStyles";
import { DONE_BAR_ID } from "./KeyboardDoneBar";
import { SwipeActionRow } from "./SwipeActionRow";
import {
  AdviceReviewResult,
  DailyNutritionTargets,
  ExerciseDetail,
  ExerciseItem,
  RecordDetail,
  SetDraft,
  SetDrafts,
  User,
  WorkoutTemplateSummary
} from "../types/workout";

export type NewExerciseSetDraft = {
  reps: number;
  weight: number;
  setOrder: number;
  notes?: string;
};

export type NewExerciseDraft = {
  exerciseItemId: string;
  notes?: string;
  initialSets: NewExerciseSetDraft[];
};

type FoodImagePayload = {
  mimeType: string;
  dataBase64: string;
};

type FoodImageDraft = FoodImagePayload & {
  previewUri: string;
};

function sanitizeIntegerInput(value: string): string {
  return value.replace(/\D+/g, "");
}

function sanitizeWeightInput(value: string): string {
  const normalized = value.replace(",", ".").replace(/[^0-9.]/g, "");
  const [whole, ...decimals] = normalized.split(".");
  if (decimals.length === 0) {
    return whole;
  }
  return `${whole}.${decimals.join("")}`;
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

type RecordScreenProps = {
  loading: boolean;
  savingRecordTheme: boolean;
  selectedDate: string;
  recordDetail: RecordDetail | null;
  recordThemeDraft: string;
  setRecordThemeDraft: (value: string) => void;
  saveRecordTheme: () => void;
  exerciseItems: ExerciseItem[];
  addExercise: (draft: NewExerciseDraft) => Promise<boolean>;
  deleteExerciseInRecord: (exerciseId: string) => void;
  expandedExerciseIds: string[];
  exerciseDetailsById: Record<string, ExerciseDetail>;
  exerciseNotesDraftById: Record<string, string>;
  savingExerciseNotesById: Record<string, boolean>;
  updateExerciseNotesDraft: (exerciseId: string, value: string) => void;
  saveExerciseNotes: (exerciseId: string) => void;
  setDraftsByExerciseId: Record<string, SetDrafts>;
  savingSetIdsByExerciseId: Record<string, Record<string, boolean>>;
  toggleExerciseExpanded: (exerciseId: string) => void;
  setSetDraft: (exerciseId: string, setId: string, draft: SetDraft) => void;
  saveSet: (exerciseId: string, setId: string) => void;
  addSet: (exerciseId: string) => Promise<boolean>;
  addSetsFromPlan: (exerciseId: string, sets: { reps: number; weight: number }[]) => Promise<boolean>;
  fetchExercisePlan: (
    userId: string,
    exerciseItemId: string,
    exerciseName: string,
    date: string
  ) => Promise<{ sets: { reps: number; weight: number }[]; advice: string }>;
  deleteSet: (exerciseId: string, setId: string) => void;
  toggleSetCompleted: (exerciseId: string, setId: string) => void;
  user: User | null;
  savingFoodConsumption: boolean;
  deletingFoodIds: Record<string, boolean>;
  addFoodConsumption: (input: {
    text?: string;
    image?: FoodImagePayload;
  }) => Promise<boolean>;
  deleteFoodConsumption: (foodConsumptionId: string) => void;
  bodyWeightDraft: string;
  setBodyWeightDraft: (value: string) => void;
  savedBodyWeightKg: number | null;
  savingBodyWeight: boolean;
  saveBodyWeight: () => void;
  listWorkoutTemplates: () => Promise<WorkoutTemplateSummary[]>;
  saveWorkoutTemplate: (
    templateName: string
  ) => Promise<{ ok: true } | { ok: false; conflict: boolean; message: string }>;
  applyWorkoutTemplate: (templateId: string) => Promise<boolean>;
  fetchDailySummary: (date: string) => Promise<AdviceReviewResult>;
  fetchExerciseFeedback: (input: {
    exerciseId: string;
    exerciseItemId: string;
    exerciseName: string;
    date: string;
  }) => Promise<AdviceReviewResult>;
  dailyNutritionTargets: DailyNutritionTargets | null;
};

export function RecordScreen({
  loading,
  savingRecordTheme,
  selectedDate,
  recordDetail,
  recordThemeDraft,
  setRecordThemeDraft,
  saveRecordTheme,
  exerciseItems,
  addExercise,
  deleteExerciseInRecord,
  expandedExerciseIds,
  exerciseDetailsById,
  exerciseNotesDraftById,
  savingExerciseNotesById,
  updateExerciseNotesDraft,
  saveExerciseNotes,
  setDraftsByExerciseId,
  savingSetIdsByExerciseId,
  toggleExerciseExpanded,
  setSetDraft,
  saveSet,
  addSet,
  addSetsFromPlan,
  fetchExercisePlan,
  deleteSet,
  toggleSetCompleted,
  user,
  savingFoodConsumption,
  deletingFoodIds,
  addFoodConsumption,
  deleteFoodConsumption,
  bodyWeightDraft,
  setBodyWeightDraft,
  savedBodyWeightKg,
  savingBodyWeight,
  saveBodyWeight,
  listWorkoutTemplates,
  saveWorkoutTemplate,
  applyWorkoutTemplate,
  fetchDailySummary,
  fetchExerciseFeedback,
  dailyNutritionTargets
}: RecordScreenProps) {
  const [showExerciseSearchModal, setShowExerciseSearchModal] = useState(false);
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState("");
  const [showTemplateSaveModal, setShowTemplateSaveModal] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState("");
  const [templateSaveError, setTemplateSaveError] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showTemplateLoadModal, setShowTemplateLoadModal] = useState(false);
  const [templateSearchTerm, setTemplateSearchTerm] = useState("");
  const [templateOptions, setTemplateOptions] = useState<WorkoutTemplateSummary[]>([]);
  const [loadingTemplateOptions, setLoadingTemplateOptions] = useState(false);
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null);
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const [exerciseMenuTarget, setExerciseMenuTarget] = useState<{
    id: string;
    exerciseItemId: string;
    exerciseItemName: string;
  } | null>(null);
  const [adviceTarget, setAdviceTarget] = useState<{
    exerciseId: string;
    exerciseItemId: string;
    exerciseItemName: string;
  } | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceResult, setAdviceResult] = useState<{
    sets: { reps: number; weight: number }[];
    advice: string;
  } | null>(null);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const [dailySummaryVisible, setDailySummaryVisible] = useState(false);
  const [dailySummaryLoading, setDailySummaryLoading] = useState(false);
  const [dailySummaryError, setDailySummaryError] = useState<string | null>(null);
  const [dailySummaryResult, setDailySummaryResult] = useState<AdviceReviewResult | null>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<{
    exerciseId: string;
    exerciseItemId: string;
    exerciseItemName: string;
  } | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackResult, setFeedbackResult] = useState<AdviceReviewResult | null>(null);
  const [recordDetailTab, setRecordDetailTab] = useState<"exercise" | "food">("exercise");
  const [foodSectionExpanded, setFoodSectionExpanded] = useState(false);
  const [showFoodComposerModal, setShowFoodComposerModal] = useState(false);
  const [foodTextDraft, setFoodTextDraft] = useState("");
  const [foodImageDraft, setFoodImageDraft] = useState<FoodImageDraft | null>(null);
  const [foodComposerError, setFoodComposerError] = useState<string | null>(null);
  const [setNotesTarget, setSetNotesTarget] = useState<{
    exerciseId: string;
    setId: string;
    setNumber: number;
    exerciseName: string;
  } | null>(null);
  const [exerciseNotesTarget, setExerciseNotesTarget] = useState<{
    exerciseId: string;
    exerciseName: string;
  } | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const expandedIds = useMemo(() => new Set(expandedExerciseIds), [expandedExerciseIds]);
  const filteredExerciseItems = useMemo(() => {
    const normalizedQuery = normalizeSearchText(exerciseSearchTerm);
    if (!normalizedQuery) {
      return exerciseItems;
    }
    const queryTerms = normalizedQuery.split(" ").filter(Boolean);
    return exerciseItems
      .map((item) => {
        const normalizedName = normalizeSearchText(item.name);
        const nameTerms = normalizedName.split(" ").filter(Boolean);
        let score = normalizedName.includes(normalizedQuery) ? 200 : 0;
        for (const queryTerm of queryTerms) {
          const termScore = nameTerms.reduce((bestScore, nameTerm) => {
            if (nameTerm === queryTerm) {
              return Math.max(bestScore, 40);
            }
            if (nameTerm.startsWith(queryTerm)) {
              return Math.max(bestScore, 25);
            }
            if (nameTerm.includes(queryTerm)) {
              return Math.max(bestScore, 10);
            }
            return bestScore;
          }, 0);
          if (termScore === 0 && !normalizedName.includes(queryTerm)) {
            return null;
          }
          score += termScore;
        }
        return { item, score };
      })
      .filter((entry): entry is { item: ExerciseItem; score: number } => entry !== null)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
      .map((entry) => entry.item);
  }, [exerciseItems, exerciseSearchTerm]);
  const filteredTemplateOptions = useMemo(() => {
    const normalizedQuery = normalizeSearchText(templateSearchTerm);
    if (!normalizedQuery) {
      return templateOptions;
    }
    const queryTerms = normalizedQuery.split(" ").filter(Boolean);
    return templateOptions
      .map((item) => {
        const normalizedName = normalizeSearchText(item.name);
        const nameTerms = normalizedName.split(" ").filter(Boolean);
        let score = normalizedName.includes(normalizedQuery) ? 200 : 0;
        for (const queryTerm of queryTerms) {
          const termScore = nameTerms.reduce((bestScore, nameTerm) => {
            if (nameTerm === queryTerm) {
              return Math.max(bestScore, 40);
            }
            if (nameTerm.startsWith(queryTerm)) {
              return Math.max(bestScore, 25);
            }
            if (nameTerm.includes(queryTerm)) {
              return Math.max(bestScore, 10);
            }
            return bestScore;
          }, 0);
          if (termScore === 0 && !normalizedName.includes(queryTerm)) {
            return null;
          }
          score += termScore;
        }
        return { item, score };
      })
      .filter((entry): entry is { item: WorkoutTemplateSummary; score: number } => entry !== null)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
      .map((entry) => entry.item);
  }, [templateOptions, templateSearchTerm]);

  const completedSetCountByExerciseId = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const exercise of recordDetail?.exercises ?? []) {
      const detail = exerciseDetailsById[exercise.id];
      counts[exercise.id] = detail
        ? detail.sets.reduce((sum, setItem) => sum + (setItem.isCompleted ? 1 : 0), 0)
        : exercise.setCount;
    }
    return counts;
  }, [recordDetail?.exercises, exerciseDetailsById]);
  const totalSetCount = useMemo(
    () => Object.values(completedSetCountByExerciseId).reduce((sum, setCount) => sum + setCount, 0),
    [completedSetCountByExerciseId]
  );
  const totalVolume = useMemo(
    () => {
      const exercises = recordDetail?.exercises ?? [];
      const missingDetailIds: string[] = [];
      const total = exercises.reduce((sum, item) => {
        const detail = exerciseDetailsById[item.id];
        if (!detail) {
          missingDetailIds.push(item.id);
          return sum + item.completedVolume;
        }
        return (
          sum +
          detail.sets.reduce(
            (exerciseVolume, setItem) =>
              exerciseVolume + (setItem.isCompleted ? setItem.reps * setItem.weight : 0),
            0
          )
        );
      }, 0);
      return total;
    },
    [recordDetail?.exercises, exerciseDetailsById]
  );
  const trimmedThemeDraft = recordThemeDraft.trim();
  const savedTheme = (recordDetail?.theme ?? "").trim();
  const themeDirty = trimmedThemeDraft !== savedTheme;
  const trimmedBodyWeightDraft = bodyWeightDraft.trim();
  const parsedBodyWeightDraft = Number(trimmedBodyWeightDraft.replace(",", "."));
  const hasBodyWeightDraft = trimmedBodyWeightDraft.length > 0;
  const isBodyWeightDraftValid =
    hasBodyWeightDraft &&
    Number.isFinite(parsedBodyWeightDraft) &&
    parsedBodyWeightDraft >= 20 &&
    parsedBodyWeightDraft <= 400;
  const normalizedBodyWeightDraft = isBodyWeightDraftValid
    ? Number(parsedBodyWeightDraft.toFixed(2))
    : null;
  const normalizedSavedBodyWeight = savedBodyWeightKg === null ? null : Number(savedBodyWeightKg.toFixed(2));
  const bodyWeightDirty = normalizedBodyWeightDraft !== normalizedSavedBodyWeight;
  const checkInSaving = savingRecordTheme || savingBodyWeight;
  const checkInDirty = themeDirty || bodyWeightDirty;
  const totalCaloriesKcal = recordDetail?.totalCaloriesKcal ?? 0;
  const totalProteinG = recordDetail?.totalProteinG ?? 0;
  const calorieTarget = dailyNutritionTargets?.recommendedCaloriesKcal ?? null;
  const proteinTarget = dailyNutritionTargets?.recommendedProteinG ?? null;
  const calorieProgress = calorieTarget && calorieTarget > 0 ? totalCaloriesKcal / calorieTarget : null;
  const proteinProgress = proteinTarget && proteinTarget > 0 ? totalProteinG / proteinTarget : null;
  const calorieOverflow = calorieTarget ? Math.max(0, Math.round(totalCaloriesKcal - calorieTarget)) : 0;
  const proteinOverflow = proteinTarget ? Math.max(0, Math.round(totalProteinG - proteinTarget)) : 0;
  const foodEntryCount = recordDetail?.foodConsumptions.length ?? 0;
  const foodEntryLabel = foodEntryCount === 1 ? "entry" : "entries";
  const exerciseEntryCount = recordDetail?.exercises.length ?? 0;
  const canSaveTemplate = Boolean(user) && !loading && exerciseEntryCount > 0;
  const canLoadTemplate = Boolean(user) && !loading;

  useEffect(() => {
    if (Platform.OS !== "ios") {
      return;
    }
    const showSub = Keyboard.addListener("keyboardWillShow", (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event?.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener("keyboardWillHide", () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!adviceTarget || !user || !recordDetail) return;
    setAdviceLoading(true);
    setAdviceError(null);
    setAdviceResult(null);
    fetchExercisePlan(
      recordDetail.userId,
      adviceTarget.exerciseItemId,
      adviceTarget.exerciseItemName,
      selectedDate
    )
      .then((res) => {
        setAdviceResult(res);
        setAdviceLoading(false);
      })
      .catch((err) => {
        setAdviceError(String(err));
        setAdviceLoading(false);
      });
  }, [adviceTarget]);

  useEffect(() => {
    if (!feedbackTarget || !recordDetail) {
      return;
    }
    setFeedbackLoading(true);
    setFeedbackError(null);
    setFeedbackResult(null);
    fetchExerciseFeedback({
      exerciseId: feedbackTarget.exerciseId,
      exerciseItemId: feedbackTarget.exerciseItemId,
      exerciseName: feedbackTarget.exerciseItemName,
      date: selectedDate
    })
      .then((payload) => {
        setFeedbackResult(payload);
        setFeedbackLoading(false);
      })
      .catch((error) => {
        setFeedbackError(String(error));
        setFeedbackLoading(false);
      });
  }, [feedbackTarget]);

  function openDailySummaryModal(): void {
    setDailySummaryVisible(true);
    setDailySummaryLoading(true);
    setDailySummaryError(null);
    setDailySummaryResult(null);
    fetchDailySummary(selectedDate)
      .then((payload) => {
        setDailySummaryResult(payload);
        setDailySummaryLoading(false);
      })
      .catch((error) => {
        setDailySummaryError(String(error));
        setDailySummaryLoading(false);
      });
  }

  function openExerciseSearchModal(): void {
    setExerciseSearchTerm("");
    setShowExerciseSearchModal(true);
  }

  function closeExerciseSearchModal(): void {
    setShowExerciseSearchModal(false);
  }

  function openTemplateSaveModal(): void {
    setTemplateNameDraft("");
    setTemplateSaveError(null);
    setShowTemplateSaveModal(true);
  }

  function closeTemplateSaveModal(): void {
    if (savingTemplate) {
      return;
    }
    setShowTemplateSaveModal(false);
    setTemplateSaveError(null);
  }

  async function submitTemplateSave(): Promise<void> {
    const trimmed = templateNameDraft.trim();
    if (!trimmed) {
      setTemplateSaveError("Template name is required.");
      return;
    }
    setSavingTemplate(true);
    setTemplateSaveError(null);
    const result = await saveWorkoutTemplate(trimmed);
    if (result.ok) {
      setShowTemplateSaveModal(false);
      setTemplateNameDraft("");
      setTemplateSaveError(null);
      setSavingTemplate(false);
      Alert.alert("Template saved", `"${trimmed}" is now available in Load Exercises From Template.`);
      return;
    }
    setSavingTemplate(false);
    if (result.conflict) {
      setTemplateSaveError("A template with this name already exists. Please enter a new name.");
      return;
    }
    setTemplateSaveError(result.message || "Failed to save template.");
  }

  async function openTemplateLoadModal(): Promise<void> {
    setTemplateSearchTerm("");
    setTemplateLoadError(null);
    setTemplateOptions([]);
    setShowTemplateLoadModal(true);
    setLoadingTemplateOptions(true);
    try {
      const templates = await listWorkoutTemplates();
      setTemplateOptions(templates);
    } catch (error) {
      setTemplateLoadError(String(error));
    } finally {
      setLoadingTemplateOptions(false);
    }
  }

  function closeTemplateLoadModal(): void {
    if (applyingTemplateId) {
      return;
    }
    setShowTemplateLoadModal(false);
    setTemplateSearchTerm("");
    setTemplateLoadError(null);
    setLoadingTemplateOptions(false);
    setApplyingTemplateId(null);
  }

  async function chooseTemplateForLoad(templateId: string): Promise<void> {
    setApplyingTemplateId(templateId);
    setTemplateLoadError(null);
    const ok = await applyWorkoutTemplate(templateId);
    setApplyingTemplateId(null);
    if (ok) {
      setShowTemplateLoadModal(false);
      setTemplateSearchTerm("");
      return;
    }
    setTemplateLoadError("Failed to load template. Please try again.");
  }

  async function chooseExerciseForInPlaceAdd(exerciseItem: ExerciseItem): Promise<void> {
    setShowExerciseSearchModal(false);
    setExerciseSearchTerm("");
    await addExercise({
      exerciseItemId: exerciseItem.id,
      initialSets: []
    });
  }

  async function addSetForExercise(exerciseId: string): Promise<void> {
    await addSet(exerciseId);
  }


  function openAdviceSheetForExercise(item: { id: string; exerciseItemId: string; exerciseItemName: string }): void {
    setAdviceTarget({
      exerciseId: item.id,
      exerciseItemId: item.exerciseItemId,
      exerciseItemName: item.exerciseItemName
    });
  }

  function openExerciseMenu(item: { id: string; exerciseItemId: string; exerciseItemName: string }): void {
    setExerciseMenuTarget({ id: item.id, exerciseItemId: item.exerciseItemId, exerciseItemName: item.exerciseItemName });
  }

  function closeExerciseMenu(): void {
    setExerciseMenuTarget(null);
  }

  function openSetNotesSheet(input: {
    exerciseId: string;
    setId: string;
    setNumber: number;
    exerciseName: string;
  }): void {
    setSetNotesTarget(input);
  }

  function closeSetNotesSheet(): void {
    setSetNotesTarget(null);
  }

  function openExerciseNotesSheet(): void {
    const target = exerciseMenuTarget;
    if (!target) {
      return;
    }
    const initialNotes =
      exerciseNotesDraftById[target.id] ??
      exerciseDetailsById[target.id]?.notes ??
      (recordDetail?.exercises.find((item) => item.id === target.id)?.notes ?? "") ??
      "";
    updateExerciseNotesDraft(target.id, initialNotes);
    setExerciseNotesTarget({
      exerciseId: target.id,
      exerciseName: target.exerciseItemName
    });
    closeExerciseMenu();
  }

  function closeExerciseNotesSheet(): void {
    setExerciseNotesTarget(null);
  }

  function openFoodComposerModal(): void {
    setFoodTextDraft("");
    setFoodImageDraft(null);
    setFoodComposerError(null);
    setShowFoodComposerModal(true);
  }

  function closeFoodComposerModal(): void {
    if (savingFoodConsumption) {
      return;
    }
    setShowFoodComposerModal(false);
    setFoodComposerError(null);
  }

  async function pickFoodPhotoFromLibrary(): Promise<void> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Photo library permission is required to select an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.5,
      base64: true,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Automatic
    });
    if (result.canceled) {
      return;
    }
    const asset = result.assets[0];
    if (!asset?.base64) {
      Alert.alert("Image not available", "Could not read image data. Please try another image.");
      return;
    }
    if (asset.base64.length > 3_500_000) {
      Alert.alert("Image too large", "Please choose a smaller image.");
      return;
    }
    setFoodImageDraft({
      mimeType: asset.mimeType ?? "image/jpeg",
      dataBase64: asset.base64,
      previewUri: asset.uri
    });
  }

  async function takeFoodPhoto(): Promise<void> {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Camera permission is required to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.5,
      base64: true,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Automatic
    });
    if (result.canceled) {
      return;
    }
    const asset = result.assets[0];
    if (!asset?.base64) {
      Alert.alert("Image not available", "Could not read captured photo. Please try again.");
      return;
    }
    if (asset.base64.length > 3_500_000) {
      Alert.alert("Image too large", "Please retake with a closer crop.");
      return;
    }
    setFoodImageDraft({
      mimeType: asset.mimeType ?? "image/jpeg",
      dataBase64: asset.base64,
      previewUri: asset.uri
    });
  }

  async function submitFoodConsumption(): Promise<void> {
    const text = foodTextDraft.trim();
    if (!text && !foodImageDraft) {
      setFoodComposerError("Add a sentence, a photo, or both.");
      return;
    }
    setFoodComposerError(null);
    const ok = await addFoodConsumption({
      text: text || undefined,
      image: foodImageDraft
        ? {
            mimeType: foodImageDraft.mimeType,
            dataBase64: foodImageDraft.dataBase64
          }
        : undefined
    });
    if (!ok) {
      setFoodComposerError("Failed to save. Please try again.");
      return;
    }
    setShowFoodComposerModal(false);
    setFoodTextDraft("");
    setFoodImageDraft(null);
    setFoodComposerError(null);
  }

  return (
    <>
      <View style={styles.dailyMetricsSection}>
        <View style={styles.dailyMetricsHeader}>
          <Text style={styles.dailyMetricsTitle}>Daily Overview</Text>
          <View style={styles.dailyMetricsBadge}>
            <Text style={styles.dailyMetricsBadgeText}>Auto</Text>
          </View>
        </View>
        <Text style={styles.dailyMetricsHint}>These values are calculated from today&apos;s workout and food logs.</Text>
        <View style={styles.statsStrip}>
          <View style={styles.statsItem}>
            <Text style={styles.statsLabel}>Total Volume</Text>
            <Text style={styles.statsValue}>{Math.round(totalVolume)} kg</Text>
          </View>
          <View style={styles.statsItem}>
            <Text style={styles.statsLabel}>Completed Sets</Text>
            <Text style={styles.statsValue}>{totalSetCount}</Text>
          </View>
        </View>
        <View style={styles.nutritionProgressCard}>
          <View style={styles.nutritionProgressSection}>
            <Text style={styles.nutritionProgressTitle}>Calorie Progress</Text>
            <View style={styles.progressRow}>
              <Text style={styles.progressNumbers}>
                {Math.round(totalCaloriesKcal)} / {calorieTarget ? Math.round(calorieTarget) : "--"} kcal
              </Text>
              {calorieOverflow > 0 ? <Text style={styles.progressOverflow}>+{calorieOverflow} kcal</Text> : null}
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  styles.progressFillCalories,
                  { width: `${Math.max(0, Math.min(100, Math.round((calorieProgress ?? 0) * 100)))}%` }
                ]}
              />
            </View>
            <Text style={styles.progressMeta}>
              {calorieTarget ? `${Math.round((calorieProgress ?? 0) * 100)}% of target` : "Estimating daily target..."}
            </Text>
          </View>
          <View style={[styles.nutritionProgressSection, styles.nutritionProgressSectionDivider]}>
            <Text style={styles.nutritionProgressTitle}>Protein Progress</Text>
            <View style={styles.progressRow}>
              <Text style={styles.progressNumbers}>
                {Math.round(totalProteinG)} / {proteinTarget ? Math.round(proteinTarget) : "--"} g
              </Text>
              {proteinOverflow > 0 ? <Text style={styles.progressOverflow}>+{proteinOverflow} g</Text> : null}
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  styles.progressFillProtein,
                  { width: `${Math.max(0, Math.min(100, Math.round((proteinProgress ?? 0) * 100)))}%` }
                ]}
              />
            </View>
            <Text style={styles.progressMeta}>
              {proteinTarget ? `${Math.round((proteinProgress ?? 0) * 100)}% of target` : "Estimating daily target..."}
            </Text>
            {dailyNutritionTargets?.comment ? <Text style={styles.progressComment}>{dailyNutritionTargets.comment}</Text> : null}
          </View>
        </View>
      </View>

      <View style={styles.checkInCard}>
        <View style={styles.checkInHeaderRow}>
          <Text style={styles.checkInTitle}>Daily Check-in</Text>
          <View
            style={[
              styles.themeStatusBadge,
              checkInSaving
                ? styles.themeStatusSavingBadge
                : checkInDirty
                  ? styles.themeStatusUnsavedBadge
                  : styles.themeStatusSavedBadge
            ]}
          >
            <Text style={styles.themeStatusBadgeText}>{checkInSaving ? "Saving..." : checkInDirty ? "Unsaved" : "Saved"}</Text>
          </View>
        </View>
        <Text style={styles.checkInHint}>Auto-saves when you leave each field.</Text>
        <View style={styles.checkInField}>
          <Text style={styles.checkInFieldLabel}>Day Theme</Text>
          <TextInput
            style={styles.themeInput}
            value={recordThemeDraft}
            onChangeText={setRecordThemeDraft}
            inputAccessoryViewID={DONE_BAR_ID}
            onBlur={() => {
              if (themeDirty && !loading && !savingRecordTheme && user) {
                saveRecordTheme();
              }
            }}
            placeholder="e.g. pull, push, leg"
            placeholderTextColor="#78786C"
            editable={Boolean(user) && !loading}
            maxLength={30}
          />
        </View>
        <View style={styles.checkInField}>
          <Text style={styles.checkInFieldLabel}>Today's Weight</Text>
          <View style={styles.weightInputRow}>
            <TextInput
              style={styles.weightInput}
              value={bodyWeightDraft}
              onChangeText={(value) => setBodyWeightDraft(sanitizeWeightInput(value))}
              keyboardType="decimal-pad"
              inputAccessoryViewID={DONE_BAR_ID}
              placeholder="0.0"
              placeholderTextColor="#78786C"
              editable={Boolean(user) && !loading && !savingBodyWeight}
              onBlur={() => {
                if (bodyWeightDirty && isBodyWeightDraftValid && !savingBodyWeight && !loading && user) {
                  saveBodyWeight();
                }
              }}
            />
            <View style={styles.weightUnitPill}>
              <Text style={styles.weightUnitText}>kg</Text>
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.dailySummaryButton}
        onPress={openDailySummaryModal}
        disabled={loading}
      >
        <Text style={styles.dailySummaryButtonText}>Get AI Summary</Text>
      </TouchableOpacity>

      <View style={styles.logTabBar}>
        <Pressable
          style={[
            styles.logTabButton,
            recordDetailTab === "exercise" ? styles.logTabButtonActive : null
          ]}
          onPress={() => setRecordDetailTab("exercise")}
        >
          <Text
            style={[
              styles.logTabButtonText,
              recordDetailTab === "exercise" ? styles.logTabButtonTextActive : null
            ]}
          >
            Exercise Log
          </Text>
        </Pressable>
        <Pressable
          style={[styles.logTabButton, recordDetailTab === "food" ? styles.logTabButtonActive : null]}
          onPress={() => {
            setRecordDetailTab("food");
            setFoodSectionExpanded(true);
          }}
        >
          <Text
            style={[
              styles.logTabButtonText,
              recordDetailTab === "food" ? styles.logTabButtonTextActive : null
            ]}
          >
            Food Log
          </Text>
        </Pressable>
      </View>

      {recordDetailTab === "food" ? (
        <View style={styles.foodCard}>
          <Pressable
            style={styles.foodCardHeader}
            onPress={() => setFoodSectionExpanded((current) => !current)}
          >
            <View>
              <Text style={styles.foodCardTitle}>Food Log</Text>
              <Text style={styles.foodCardSubtitle}>
                {foodEntryCount} {foodEntryLabel} for {selectedDate}
              </Text>
            </View>
            <Text style={styles.foodCardChevron}>{foodSectionExpanded ? "▾" : "▸"}</Text>
          </Pressable>

          {foodSectionExpanded ? (
            <>
              <Text style={styles.foodPrivacyHint}>
                Photos are analyzed for nutrition but are not stored after analysis.
              </Text>
              {(recordDetail?.foodConsumptions ?? []).length === 0 ? (
                <View style={styles.emptyFoodCard}>
                  <Text style={appStyles.emptyText}>No food logged yet for this day.</Text>
                </View>
              ) : (
                <View style={styles.foodList}>
                  {(recordDetail?.foodConsumptions ?? []).map((entry) => (
                    <View key={entry.id} style={styles.foodRow}>
                      <View style={styles.foodRowTop}>
                        <Text style={styles.foodDescription}>{entry.description}</Text>
                        <TouchableOpacity
                          style={styles.foodDeleteButton}
                          onPress={() => deleteFoodConsumption(entry.id)}
                          disabled={deletingFoodIds[entry.id] || loading}
                        >
                          <Text style={styles.foodDeleteButtonText}>
                            {deletingFoodIds[entry.id] ? "..." : "Delete"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.foodMacrosText}>
                        {Math.round(entry.caloriesKcal)} kcal • {Math.round(entry.proteinG)} g protein
                      </Text>
                      <Text style={styles.foodCommentText}>{entry.comment}</Text>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.addFoodButton}
                onPress={openFoodComposerModal}
                disabled={!user || loading || savingFoodConsumption}
              >
                <Text style={styles.addFoodButtonText}>+ Add Food Log</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : null}

      {recordDetailTab === "exercise" ? (
        <>
          <Text style={appStyles.sectionTitle}>Exercises</Text>
          {(recordDetail?.exercises ?? []).length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>No exercises yet</Text>
              <Text style={appStyles.emptyText}>Tap Add Exercise to start your workout log.</Text>
            </View>
          ) : (
            (recordDetail?.exercises ?? []).map((item) => {
              const detail = exerciseDetailsById[item.id];
              const setDrafts = setDraftsByExerciseId[item.id] ?? {};
              const savingSetIds = savingSetIdsByExerciseId[item.id] ?? {};
              const isExpanded = expandedIds.has(item.id);

              return (
                <View key={item.id} style={styles.exerciseCard}>
                <View style={styles.exerciseCardHeader}>
                  <Pressable
                    style={styles.exerciseHeaderTapArea}
                    onPress={() => toggleExerciseExpanded(item.id)}
                  >
                    <View style={styles.exerciseHeaderLeft}>
                      {item.exerciseItemImageUrl ? (
                        <Image source={{ uri: item.exerciseItemImageUrl }} style={styles.exerciseThumb} />
                      ) : (
                        <View style={styles.exerciseThumbPlaceholder}>
                          <Text style={styles.exerciseThumbPlaceholderText}>No Image</Text>
                        </View>
                      )}
                      <View style={styles.exerciseHeaderText}>
                        <Text style={styles.exerciseTitle}>{item.exerciseItemName}</Text>
                        <Text style={styles.exerciseSubtitle}>
                          {completedSetCountByExerciseId[item.id] ?? 0} sets
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                  <TouchableOpacity
                    style={styles.exerciseMenuButton}
                    onPress={() => openExerciseMenu(item)}
                    disabled={loading}
                  >
                    <Text style={styles.exerciseMenuButtonText}>⋮</Text>
                  </TouchableOpacity>
                </View>

                {isExpanded ? (
                  <>
                    {!detail ? (
                      <View style={styles.loadingExerciseCard}>
                        <Text style={styles.statusText}>Loading sets...</Text>
                      </View>
                    ) : (
                      <>
                        <View style={styles.setTableHeader}>
                          <Text style={[styles.setHeaderText, styles.colSet]}>SET</Text>
                          <Text style={[styles.setHeaderText, styles.colWeight]}>KG</Text>
                          <Text style={[styles.setHeaderText, styles.colReps]}>REPS</Text>
                          <Text style={[styles.setHeaderText, styles.colNotes]}>NOTES</Text>
                          <Text style={[styles.setHeaderText, styles.colCheck]}>✓</Text>
                        </View>

                        {detail.sets.length === 0 ? (
                          <View style={styles.emptySetCard}>
                            <Text style={appStyles.emptyText}>No sets yet.</Text>
                          </View>
                        ) : (
                          detail.sets.map((setItem, index) => {
                            const draft = setDrafts[setItem.id] ?? {
                              reps: String(setItem.reps),
                              weight: String(setItem.weight),
                              notes: setItem.notes ?? ""
                            };
                            const isCompleted = setItem.isCompleted;
                            return (
                              <View key={setItem.id} style={styles.setRowSwipeWrap}>
                                <SwipeActionRow
                                  onAction={() => deleteSet(item.id, setItem.id)}
                                  disabled={loading || Boolean(savingSetIds[setItem.id])}
                                  borderRadius={0}
                                  marginBottom={0}
                                  actionLabel="Delete"
                                >
                                  <View
                                    style={[
                                      styles.setRowWrap,
                                      index % 2 === 0 ? styles.setRowEven : styles.setRowOdd,
                                      isCompleted ? styles.setRowCompleted : null
                                    ]}
                                  >
                                    <View style={styles.setRow}>
                                      <Text style={[styles.setCellText, styles.colSet, isCompleted ? styles.setCellTextCompleted : null]}>
                                        {index + 1}
                                      </Text>
                                      <TextInput
                                        style={[styles.setRowInput, styles.colWeight, isCompleted ? styles.setRowInputCompleted : null]}
                                        value={draft.weight}
                                        onChangeText={(text) =>
                                          setSetDraft(item.id, setItem.id, {
                                            reps: draft.reps,
                                            weight: sanitizeWeightInput(text),
                                            notes: draft.notes
                                          })
                                        }
                                        keyboardType="decimal-pad"
                                        inputAccessoryViewID={DONE_BAR_ID}
                                        placeholder="0"
                                        placeholderTextColor="#78786C"
                                        onBlur={() => saveSet(item.id, setItem.id)}
                                      />
                                      <TextInput
                                        style={[styles.setRowInput, styles.colReps, isCompleted ? styles.setRowInputCompleted : null]}
                                        value={draft.reps}
                                        onChangeText={(text) =>
                                          setSetDraft(item.id, setItem.id, {
                                            reps: sanitizeIntegerInput(text),
                                            weight: draft.weight,
                                            notes: draft.notes
                                          })
                                        }
                                        keyboardType="numeric"
                                        inputAccessoryViewID={DONE_BAR_ID}
                                        placeholder="0"
                                        placeholderTextColor="#78786C"
                                        onBlur={() => saveSet(item.id, setItem.id)}
                                      />
                                      <View style={styles.colNotes}>
                                        <TouchableOpacity
                                          style={styles.notePill}
                                          onPress={() =>
                                            openSetNotesSheet({
                                              exerciseId: item.id,
                                              setId: setItem.id,
                                              setNumber: index + 1,
                                              exerciseName: item.exerciseItemName
                                            })
                                          }
                                          disabled={loading || Boolean(savingSetIds[setItem.id])}
                                        >
                                          <Text style={styles.notePillText}>
                                            {draft.notes.trim().length > 0 ? "View" : "Add"}
                                          </Text>
                                        </TouchableOpacity>
                                      </View>
                                      <View style={styles.colCheck}>
                                        <Pressable
                                          style={[styles.checkPill, isCompleted ? styles.checkPillCompleted : null]}
                                          onPress={() => toggleSetCompleted(item.id, setItem.id)}
                                          disabled={loading || Boolean(savingSetIds[setItem.id])}
                                        >
                                          <Text style={styles.checkPillText}>
                                            {savingSetIds[setItem.id] ? "..." : "✓"}
                                          </Text>
                                        </Pressable>
                                      </View>
                                    </View>
                                  </View>
                                </SwipeActionRow>
                              </View>
                            );
                          })
                        )}

                        <TouchableOpacity
                          style={styles.addSetSimpleButton}
                          onPress={() => {
                            addSetForExercise(item.id).catch(() => {});
                          }}
                          disabled={loading || !user}
                        >
                          <Text style={styles.addSetSimpleButtonText}>+ Add Set</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.addSetSimpleButton}
                          onPress={() => {
                            openAdviceSheetForExercise(item);
                          }}
                          disabled={loading || !user}
                        >
                          <Text style={styles.addSetSimpleButtonText}>Add AI Recommended Sets</Text>
                        </TouchableOpacity>

                      </>
                    )}
                  </>
                ) : null}
              </View>
              );
            })
          )}
        </>
      ) : null}

      {recordDetailTab === "exercise" ? (
        <View style={styles.templateActionStack}>
          <TouchableOpacity style={styles.openAddModalButton} onPress={openTemplateSaveModal} disabled={!canSaveTemplate}>
            <Text style={styles.openAddModalButtonText}>Save as Template</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.openAddModalButton} onPress={openExerciseSearchModal} disabled={loading || !user}>
            <Text style={styles.openAddModalButtonText}>+ Add Exercise</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.openAddModalButton, styles.secondaryActionButton]}
            onPress={() => {
              openTemplateLoadModal().catch(() => {});
            }}
            disabled={!canLoadTemplate}
          >
            <Text style={[styles.openAddModalButtonText, styles.secondaryActionButtonText]}>
              Load Exercises From Template
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal
        visible={showTemplateSaveModal}
        transparent
        animationType="fade"
        onRequestClose={closeTemplateSaveModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropTapTarget} onPress={closeTemplateSaveModal} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Save Template</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={closeTemplateSaveModal} disabled={savingTemplate}>
                <Text style={styles.modalCloseButtonText}>x</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Save today&apos;s exercises and sets as a reusable template.</Text>
            <TextInput
              style={styles.searchInput}
              value={templateNameDraft}
              onChangeText={setTemplateNameDraft}
              inputAccessoryViewID={DONE_BAR_ID}
              placeholder="Template name"
              placeholderTextColor="#78786C"
              autoCorrect={false}
              editable={!savingTemplate}
              maxLength={120}
            />
            {templateSaveError ? <Text style={styles.foodComposerErrorText}>{templateSaveError}</Text> : null}
            <View style={styles.composerActionRow}>
              <TouchableOpacity style={styles.composerCancelButton} onPress={closeTemplateSaveModal} disabled={savingTemplate}>
                <Text style={styles.composerCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.composerSaveButton}
                onPress={() => {
                  submitTemplateSave().catch(() => {});
                }}
                disabled={savingTemplate}
              >
                <Text style={styles.composerSaveButtonText}>{savingTemplate ? "Saving..." : "Save Template"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTemplateLoadModal}
        transparent
        animationType="fade"
        onRequestClose={closeTemplateLoadModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropTapTarget} onPress={closeTemplateLoadModal} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Load Template</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closeTemplateLoadModal}
                disabled={Boolean(applyingTemplateId)}
              >
                <Text style={styles.modalCloseButtonText}>x</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Search a template to append its exercises and sets to today.</Text>
            <TextInput
              style={styles.searchInput}
              value={templateSearchTerm}
              onChangeText={setTemplateSearchTerm}
              inputAccessoryViewID={DONE_BAR_ID}
              placeholder="Search templates..."
              placeholderTextColor="#78786C"
              autoCorrect={false}
              autoCapitalize="none"
            />
            <ScrollView style={styles.searchList} keyboardShouldPersistTaps="handled">
              {loadingTemplateOptions ? (
                <View style={styles.emptySetCard}>
                  <Text style={appStyles.emptyText}>Loading templates...</Text>
                </View>
              ) : filteredTemplateOptions.length === 0 ? (
                <View style={styles.emptySetCard}>
                  <Text style={appStyles.emptyText}>No templates match your search.</Text>
                </View>
              ) : (
                filteredTemplateOptions.map((template) => (
                  <Pressable
                    key={template.id}
                    style={styles.searchResultRow}
                    onPress={() => {
                      chooseTemplateForLoad(template.id).catch(() => {});
                    }}
                    disabled={Boolean(applyingTemplateId)}
                  >
                    <Text style={styles.searchResultName}>{template.name}</Text>
                    <Text style={styles.searchResultMeta}>
                      {template.exerciseCount} exercises • {template.setCount} sets
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
            {templateLoadError ? <Text style={styles.foodComposerErrorText}>{templateLoadError}</Text> : null}
            <TouchableOpacity style={styles.cancelButton} onPress={closeTemplateLoadModal} disabled={Boolean(applyingTemplateId)}>
              <Text style={styles.cancelButtonText}>{applyingTemplateId ? "Applying..." : "Close"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showFoodComposerModal}
        transparent
        animationType="fade"
        onRequestClose={closeFoodComposerModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropTapTarget} onPress={closeFoodComposerModal} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Log Food</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={closeFoodComposerModal}>
                <Text style={styles.modalCloseButtonText}>x</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Add a sentence, a photo, or both. We will estimate calories and protein with AI.
            </Text>
            <TextInput
              style={[styles.modernInput, styles.foodTextInput]}
              value={foodTextDraft}
              onChangeText={setFoodTextDraft}
              inputAccessoryViewID={DONE_BAR_ID}
              multiline
              numberOfLines={3}
              placeholder="e.g. 60g steel cut oats + 200ml milk"
              placeholderTextColor="#78786C"
              editable={!savingFoodConsumption}
            />
            <View style={styles.foodPhotoActions}>
              <TouchableOpacity
                style={styles.foodPhotoActionButton}
                onPress={() => {
                  pickFoodPhotoFromLibrary().catch(() => {});
                }}
                disabled={savingFoodConsumption}
              >
                <Text style={styles.foodPhotoActionButtonText}>Choose Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.foodPhotoActionButton}
                onPress={() => {
                  takeFoodPhoto().catch(() => {});
                }}
                disabled={savingFoodConsumption}
              >
                <Text style={styles.foodPhotoActionButtonText}>Take Photo</Text>
              </TouchableOpacity>
            </View>
            {foodImageDraft ? (
              <View style={styles.foodImagePreviewWrap}>
                <Image source={{ uri: foodImageDraft.previewUri }} style={styles.foodImagePreview} />
                <TouchableOpacity
                  style={styles.clearFoodImageButton}
                  onPress={() => setFoodImageDraft(null)}
                  disabled={savingFoodConsumption}
                >
                  <Text style={styles.clearFoodImageButtonText}>Remove Photo</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {foodComposerError ? <Text style={styles.foodComposerErrorText}>{foodComposerError}</Text> : null}
            <View style={styles.composerActionRow}>
              <TouchableOpacity style={styles.composerCancelButton} onPress={closeFoodComposerModal}>
                <Text style={styles.composerCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.composerSaveButton}
                onPress={() => {
                  submitFoodConsumption().catch(() => {});
                }}
                disabled={savingFoodConsumption}
              >
                <Text style={styles.composerSaveButtonText}>
                  {savingFoodConsumption ? "Analyzing..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showExerciseSearchModal}
        transparent
        animationType="fade"
        onRequestClose={closeExerciseSearchModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropTapTarget} onPress={closeExerciseSearchModal} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Find Exercise</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={closeExerciseSearchModal}>
                <Text style={styles.modalCloseButtonText}>x</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Search and pick an exercise to start logging.</Text>
            <TextInput
              style={styles.searchInput}
              value={exerciseSearchTerm}
              onChangeText={setExerciseSearchTerm}
              inputAccessoryViewID={DONE_BAR_ID}
              placeholder="Search exercises..."
              placeholderTextColor="#78786C"
              autoCorrect={false}
              autoCapitalize="none"
            />
            <ScrollView style={styles.searchList} keyboardShouldPersistTaps="handled">
              {filteredExerciseItems.length === 0 ? (
                <View style={styles.emptySetCard}>
                  <Text style={appStyles.emptyText}>No exercises match your search.</Text>
                </View>
              ) : (
                filteredExerciseItems.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.searchResultRow}
                    onPress={() => {
                      chooseExerciseForInPlaceAdd(item).catch(() => {});
                    }}
                  >
                    <Text style={styles.searchResultName}>{item.name}</Text>
                    <Text style={styles.searchResultMeta}>{item.muscleGroup ?? "General"}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.cancelButton} onPress={closeExerciseSearchModal}>
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(exerciseMenuTarget)}
        transparent
        animationType="fade"
        onRequestClose={closeExerciseMenu}
      >
        <View style={styles.menuBackdrop}>
          <Pressable style={styles.modalBackdropTapTarget} onPress={closeExerciseMenu} />
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />
            <TouchableOpacity
              style={styles.menuRow}
              onPress={openExerciseNotesSheet}
            >
              <Text style={styles.menuRowText}>View / Edit Exercise Notes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                const target = exerciseMenuTarget;
                closeExerciseMenu();
                if (target) {
                  openAdviceSheetForExercise(target);
                }
              }}
            >
              <Text style={styles.menuRowText}>Add AI Recommended Sets</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                const target = exerciseMenuTarget;
                closeExerciseMenu();
                if (target) {
                  setFeedbackTarget({
                    exerciseId: target.id,
                    exerciseItemId: target.exerciseItemId,
                    exerciseItemName: target.exerciseItemName
                  });
                }
              }}
            >
              <Text style={styles.menuRowText}>Get AI Feedback</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                const target = exerciseMenuTarget;
                closeExerciseMenu();
                if (target) {
                  deleteExerciseInRecord(target.id);
                }
              }}
            >
              <Text style={styles.menuDeleteText}>Remove Exercise</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={setNotesTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeSetNotesSheet}
      >
        <KeyboardAvoidingView
          style={styles.menuBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={16}
        >
          <Pressable style={styles.modalBackdropTapTarget} onPress={closeSetNotesSheet} />
          <View style={styles.notesSheet}>
            <View style={styles.menuHandle} />
            {setNotesTarget ? (
              <>
                <Text style={styles.notesSheetTitle}>
                  Set {setNotesTarget.setNumber} Notes - {setNotesTarget.exerciseName}
                </Text>
                <Text style={styles.notesSheetSubtitle}>
                  Notes are saved to this set and included in AI advice context.
                </Text>
                <TextInput
                  style={styles.notesInput}
                  multiline
                  numberOfLines={4}
                  inputAccessoryViewID={DONE_BAR_ID}
                  value={setDraftsByExerciseId[setNotesTarget.exerciseId]?.[setNotesTarget.setId]?.notes ?? ""}
                  onChangeText={(value) => {
                    const draft = setDraftsByExerciseId[setNotesTarget.exerciseId]?.[setNotesTarget.setId];
                    if (!draft) {
                      return;
                    }
                    setSetDraft(setNotesTarget.exerciseId, setNotesTarget.setId, {
                      reps: draft.reps,
                      weight: draft.weight,
                      notes: value
                    });
                  }}
                  placeholder="e.g. Lower back felt tight in last 2 reps"
                  placeholderTextColor="#78786C"
                  editable={!loading && !savingSetIdsByExerciseId[setNotesTarget.exerciseId]?.[setNotesTarget.setId]}
                  textAlignVertical="top"
                  maxLength={400}
                />
                <View style={styles.notesActions}>
                  <TouchableOpacity style={styles.composerCancelButton} onPress={closeSetNotesSheet}>
                    <Text style={styles.composerCancelButtonText}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.composerSaveButton}
                    onPress={() => {
                      saveSet(setNotesTarget.exerciseId, setNotesTarget.setId);
                      closeSetNotesSheet();
                    }}
                    disabled={loading || Boolean(savingSetIdsByExerciseId[setNotesTarget.exerciseId]?.[setNotesTarget.setId])}
                  >
                    <Text style={styles.composerSaveButtonText}>
                      {savingSetIdsByExerciseId[setNotesTarget.exerciseId]?.[setNotesTarget.setId] ? "Saving..." : "Save"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
          {Platform.OS === "ios" && keyboardVisible && setNotesTarget !== null ? (
            <View
              pointerEvents="box-none"
              style={[
                styles.keyboardDoneWrap,
                {
                  bottom: Math.max(12, keyboardHeight + 8)
                }
              ]}
            >
              <Pressable
                style={({ pressed }) => [styles.keyboardDoneButton, pressed ? styles.keyboardDoneButtonPressed : null]}
                onPress={() => {
                  Keyboard.dismiss();
                }}
              >
                <Text style={styles.keyboardDoneText}>Done</Text>
              </Pressable>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={exerciseNotesTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeExerciseNotesSheet}
      >
        <KeyboardAvoidingView
          style={styles.menuBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={16}
        >
          <Pressable style={styles.modalBackdropTapTarget} onPress={closeExerciseNotesSheet} />
          <View style={styles.notesSheet}>
            <View style={styles.menuHandle} />
            {exerciseNotesTarget ? (
              <>
                <Text style={styles.notesSheetTitle}>Exercise Notes - {exerciseNotesTarget.exerciseName}</Text>
                <Text style={styles.notesSheetSubtitle}>
                  Add context like form cues, pain, or intent for this exercise.
                </Text>
                <TextInput
                  style={styles.notesInput}
                  multiline
                  numberOfLines={4}
                  inputAccessoryViewID={DONE_BAR_ID}
                  value={exerciseNotesDraftById[exerciseNotesTarget.exerciseId] ?? ""}
                  onChangeText={(value) => updateExerciseNotesDraft(exerciseNotesTarget.exerciseId, value)}
                  placeholder="e.g. Keep elbows tucked and control eccentric"
                  placeholderTextColor="#78786C"
                  editable={!loading && !savingExerciseNotesById[exerciseNotesTarget.exerciseId]}
                  textAlignVertical="top"
                  maxLength={400}
                />
                <View style={styles.notesActions}>
                  <TouchableOpacity style={styles.composerCancelButton} onPress={closeExerciseNotesSheet}>
                    <Text style={styles.composerCancelButtonText}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.composerSaveButton}
                    onPress={() => {
                      saveExerciseNotes(exerciseNotesTarget.exerciseId);
                      closeExerciseNotesSheet();
                    }}
                    disabled={loading || Boolean(savingExerciseNotesById[exerciseNotesTarget.exerciseId])}
                  >
                    <Text style={styles.composerSaveButtonText}>
                      {savingExerciseNotesById[exerciseNotesTarget.exerciseId] ? "Saving..." : "Save"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
          {Platform.OS === "ios" && keyboardVisible && exerciseNotesTarget !== null ? (
            <View
              pointerEvents="box-none"
              style={[
                styles.keyboardDoneWrap,
                {
                  bottom: Math.max(12, keyboardHeight + 8)
                }
              ]}
            >
              <Pressable
                style={({ pressed }) => [styles.keyboardDoneButton, pressed ? styles.keyboardDoneButtonPressed : null]}
                onPress={() => {
                  Keyboard.dismiss();
                }}
              >
                <Text style={styles.keyboardDoneText}>Done</Text>
              </Pressable>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={dailySummaryVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setDailySummaryVisible(false);
          setDailySummaryLoading(false);
          setDailySummaryError(null);
          setDailySummaryResult(null);
        }}
      >
        <View style={styles.menuBackdrop}>
          <Pressable
            style={styles.modalBackdropTapTarget}
            onPress={() => {
              setDailySummaryVisible(false);
              setDailySummaryLoading(false);
              setDailySummaryError(null);
              setDailySummaryResult(null);
            }}
          />
          <View style={styles.adviceSheet}>
            <View style={styles.menuHandle} />
            <Text style={styles.adviceTitle}>AI Summary: {selectedDate}</Text>
            {dailySummaryLoading ? (
              <View style={styles.adviceLoadingWrap}>
                <Text style={styles.statusText}>Loading...</Text>
              </View>
            ) : dailySummaryError ? (
              <>
                <Text style={styles.adviceErrorText}>{dailySummaryError}</Text>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setDailySummaryVisible(false);
                    setDailySummaryError(null);
                    setDailySummaryResult(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : dailySummaryResult ? (
              <>
                <ScrollView style={styles.adviceScroll} nestedScrollEnabled>
                  <View style={styles.adviceTextBlock}>
                    <Text style={styles.adviceSectionLabel}>
                      Review ({dailySummaryResult.source === "fallback" ? "Fallback" : "AI"})
                    </Text>
                    <Text style={styles.adviceParagraph}>{dailySummaryResult.review}</Text>
                  </View>
                </ScrollView>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setDailySummaryVisible(false);
                    setDailySummaryError(null);
                    setDailySummaryResult(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={feedbackTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setFeedbackTarget(null);
          setFeedbackLoading(false);
          setFeedbackError(null);
          setFeedbackResult(null);
        }}
      >
        <View style={styles.menuBackdrop}>
          <Pressable
            style={styles.modalBackdropTapTarget}
            onPress={() => {
              setFeedbackTarget(null);
              setFeedbackLoading(false);
              setFeedbackError(null);
              setFeedbackResult(null);
            }}
          />
          <View style={styles.adviceSheet}>
            <View style={styles.menuHandle} />
            <Text style={styles.adviceTitle}>
              AI Feedback: {feedbackTarget?.exerciseItemName ?? "Exercise"}
            </Text>
            {feedbackLoading ? (
              <View style={styles.adviceLoadingWrap}>
                <Text style={styles.statusText}>Loading...</Text>
              </View>
            ) : feedbackError ? (
              <>
                <Text style={styles.adviceErrorText}>{feedbackError}</Text>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setFeedbackTarget(null);
                    setFeedbackError(null);
                    setFeedbackResult(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : feedbackResult ? (
              <>
                <ScrollView style={styles.adviceScroll} nestedScrollEnabled>
                  <View style={styles.adviceTextBlock}>
                    <Text style={styles.adviceSectionLabel}>
                      Review ({feedbackResult.source === "fallback" ? "Fallback" : "AI"})
                    </Text>
                    <Text style={styles.adviceParagraph}>{feedbackResult.review}</Text>
                  </View>
                </ScrollView>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setFeedbackTarget(null);
                    setFeedbackError(null);
                    setFeedbackResult(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={adviceTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setAdviceTarget(null);
          setAdviceResult(null);
          setAdviceError(null);
        }}
      >
        <View style={styles.menuBackdrop}>
          <Pressable
            style={styles.modalBackdropTapTarget}
            onPress={() => {
              setAdviceTarget(null);
              setAdviceResult(null);
              setAdviceError(null);
            }}
          />
          <View style={styles.adviceSheet}>
            <View style={styles.menuHandle} />
            {adviceTarget ? (
              <>
                <Text style={styles.adviceTitle}>AI Advice: {adviceTarget.exerciseItemName}</Text>
                {adviceLoading ? (
                  <View style={styles.adviceLoadingWrap}>
                    <Text style={styles.statusText}>Loading...</Text>
                  </View>
                ) : adviceError ? (
                  <>
                    <Text style={styles.adviceErrorText}>{adviceError}</Text>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setAdviceTarget(null);
                        setAdviceResult(null);
                        setAdviceError(null);
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Close</Text>
                    </TouchableOpacity>
                  </>
                ) : adviceResult ? (
                  <>
                    <ScrollView style={styles.adviceScroll} nestedScrollEnabled>
                      {adviceResult.sets.length > 0 ? (
                        <View style={styles.adviceSetsBlock}>
                          <Text style={styles.adviceSectionLabel}>Suggested sets</Text>
                          {adviceResult.sets.map((set, index) => (
                            <Text key={index} style={styles.adviceSetRow}>
                              Set {index + 1}: {set.reps} reps @ {set.weight} kg
                            </Text>
                          ))}
                        </View>
                      ) : null}
                      {adviceResult.advice ? (
                        <View style={styles.adviceTextBlock}>
                          <Text style={styles.adviceSectionLabel}>Advice</Text>
                          <Text style={styles.adviceParagraph}>{adviceResult.advice}</Text>
                        </View>
                      ) : null}
                    </ScrollView>
                    <View style={styles.adviceActions}>
                      <TouchableOpacity
                        style={[styles.adviceButton, styles.adviceButtonAccept]}
                        onPress={async () => {
                          if (!adviceTarget || !adviceResult?.sets.length) return;
                          const ok = await addSetsFromPlan(adviceTarget.exerciseId, adviceResult.sets);
                          if (ok) {
                            setAdviceTarget(null);
                            setAdviceResult(null);
                            setAdviceError(null);
                          }
                        }}
                      >
                        <Text style={[styles.adviceButtonText, styles.adviceButtonTextAccept]}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.adviceButton, styles.adviceButtonDecline]}
                        onPress={() => {
                          setAdviceTarget(null);
                          setAdviceResult(null);
                          setAdviceError(null);
                        }}
                      >
                        <Text style={[styles.adviceButtonText, styles.adviceButtonTextDecline]}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  dailyMetricsSection: {
    marginTop: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DED8CF",
    backgroundColor: "#F4F0E8",
    padding: 12
  },
  dailyMetricsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  dailyMetricsTitle: {
    color: "#2C2C24",
    fontSize: 17,
    fontWeight: "800"
  },
  dailyMetricsBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#E8EEE4"
  },
  dailyMetricsBadgeText: {
    color: "#5D7052",
    fontSize: 11,
    fontWeight: "800"
  },
  dailyMetricsHint: {
    marginTop: 4,
    color: "#78786C",
    fontSize: 12
  },
  statsStrip: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  statsItem: {
    width: "48%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D8D1C6",
    backgroundColor: "#FEFEFA",
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  statsLabel: {
    color: "#4A4A40",
    fontSize: 12,
    fontWeight: "700"
  },
  statsValue: {
    marginTop: 4,
    color: "#2C2C24",
    fontSize: 20,
    fontWeight: "800"
  },
  nutritionProgressCard: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D8D1C6",
    backgroundColor: "#FEFEFA",
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  nutritionProgressSection: {
    width: "100%"
  },
  nutritionProgressSectionDivider: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E8E2D8"
  },
  nutritionProgressTitle: {
    color: "#4A4A40",
    fontSize: 13,
    fontWeight: "700"
  },
  progressRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  progressNumbers: {
    color: "#2C2C24",
    fontSize: 16,
    fontWeight: "800"
  },
  progressOverflow: {
    color: "#A85448",
    fontSize: 13,
    fontWeight: "800"
  },
  progressTrack: {
    marginTop: 8,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#F0EBE5",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999
  },
  progressFillCalories: {
    backgroundColor: "#C18C5D"
  },
  progressFillProtein: {
    backgroundColor: "#5D7052"
  },
  progressMeta: {
    marginTop: 6,
    color: "#78786C",
    fontSize: 12,
    fontWeight: "700"
  },
  progressComment: {
    marginTop: 6,
    color: "#4A4A40",
    fontSize: 12
  },
  checkInCard: {
    marginTop: 8,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#FEFEFA",
    borderWidth: 1,
    borderColor: "#DED8CF"
  },
  checkInHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  checkInTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2C2C24"
  },
  checkInHint: {
    marginTop: 4,
    color: "#78786C",
    fontSize: 12
  },
  checkInField: {
    marginTop: 10
  },
  checkInFieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4A4A40",
    marginBottom: 6
  },
  weightCard: {
    marginTop: 8,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#FEFEFA",
    borderWidth: 1,
    borderColor: "#DED8CF"
  },
  weightHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  weightCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2C2C24"
  },
  weightCardHint: {
    marginTop: 6,
    color: "#78786C",
    fontSize: 12
  },
  weightInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#DED8CF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFFCC",
    color: "#2C2C24",
    fontSize: 16,
    fontWeight: "700"
  },
  weightUnitPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DED8CF",
    backgroundColor: "#F6F2EA",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  weightUnitText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#4A4A40"
  },
  dailySummaryButton: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#5D7052"
  },
  dailySummaryButtonText: {
    color: "#FEFEFA",
    fontWeight: "800",
    fontSize: 15
  },
  logTabBar: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DED8CF",
    backgroundColor: "#F6F2EA",
    padding: 4
  },
  logTabButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center"
  },
  logTabButtonActive: {
    backgroundColor: "#5D7052"
  },
  logTabButtonText: {
    color: "#4A4A40",
    fontSize: 13,
    fontWeight: "700"
  },
  logTabButtonTextActive: {
    color: "#F3F4F1"
  },
  themeCard: {
    marginTop: 6,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#FEFEFA",
    borderWidth: 1,
    borderColor: "#DED8CF"
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2C2C24",
    marginBottom: 6
  },
  themeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6
  },
  themeStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  themeStatusSavedBadge: {
    backgroundColor: "#DCFCE7"
  },
  themeStatusUnsavedBadge: {
    backgroundColor: "#FEF3C7"
  },
  themeStatusSavingBadge: {
    backgroundColor: "#DBEAFE"
  },
  themeStatusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4A4A40"
  },
  themeInput: {
    borderWidth: 1,
    borderColor: "#DED8CF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#FFFFFFCC"
  },
  themeHint: {
    marginTop: 6,
    color: "#78786C",
    fontSize: 12
  },
  foodCard: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DED8CF",
    backgroundColor: "#FEFEFA",
    padding: 12
  },
  foodCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  foodCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2C2C24"
  },
  foodCardSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#78786C"
  },
  foodCardChevron: {
    color: "#4A4A40",
    fontSize: 18,
    fontWeight: "700"
  },
  foodPrivacyHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#475569"
  },
  emptyFoodCard: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DED8CF",
    backgroundColor: "#FEFEFA",
    padding: 10
  },
  foodList: {
    marginTop: 8,
    gap: 8
  },
  foodRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DED8CF",
    padding: 10,
    backgroundColor: "#FEFEFA"
  },
  foodRowTop: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start"
  },
  foodDescription: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#2C2C24"
  },
  foodDeleteButton: {
    borderRadius: 8,
    backgroundColor: "#F6E4DF",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  foodDeleteButtonText: {
    color: "#8E3D34",
    fontWeight: "700",
    fontSize: 12
  },
  foodMacrosText: {
    marginTop: 6,
    color: "#2C2C24",
    fontSize: 13,
    fontWeight: "700"
  },
  foodCommentText: {
    marginTop: 4,
    color: "#4A4A40",
    fontSize: 13,
    lineHeight: 18
  },
  addFoodButton: {
    marginTop: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#5D7052",
    backgroundColor: "#5D7052",
    paddingVertical: 12,
    alignItems: "center"
  },
  addFoodButtonText: {
    color: "#FEFEFA",
    fontWeight: "800",
    fontSize: 16
  },
  emptyStateCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DED8CF",
    backgroundColor: "#FEFEFA",
    padding: 12
  },
  emptyStateTitle: {
    color: "#2C2C24",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4
  },
  loadingExerciseCard: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DED8CF",
    backgroundColor: "#FEFEFA",
    padding: 10
  },
  statusText: {
    color: "#78786C",
    fontSize: 12,
    fontWeight: "700"
  },
  exerciseCard: {
    backgroundColor: "#FEFEFA",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DED8CF",
    padding: 12,
    marginBottom: 10
  },
  exerciseCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  exerciseHeaderTapArea: {
    flex: 1
  },
  exerciseHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1
  },
  exerciseThumb: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#DED8CF"
  },
  exerciseThumbPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#DED8CF",
    alignItems: "center",
    justifyContent: "center"
  },
  exerciseThumbPlaceholderText: {
    color: "#78786C",
    fontSize: 8,
    fontWeight: "700"
  },
  exerciseHeaderText: {
    flex: 1
  },
  exerciseTitle: {
    color: "#2C2C24",
    fontSize: 18,
    fontWeight: "800"
  },
  exerciseSubtitle: {
    marginTop: 2,
    color: "#78786C",
    fontSize: 12
  },
  exerciseMenuButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  exerciseMenuButtonText: {
    color: "#4A4A40",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 22
  },
  setTableHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginHorizontal: -12,
    paddingHorizontal: 12,
    paddingBottom: 6
  },
  setHeaderText: {
    color: "#78786C",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center"
  },
  setRowSwipeWrap: {
    marginHorizontal: -12
  },
  setRowWrap: {
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  setRowEven: {
    backgroundColor: "#FEFEFA"
  },
  setRowOdd: {
    backgroundColor: "#F1F5F9"
  },
  setRowCompleted: {
    backgroundColor: "#BBF7D0"
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  setCellText: {
    color: "#2C2C24",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center"
  },
  setRowInput: {
    color: "#2C2C24",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    height: 26,
    paddingVertical: 0,
    paddingHorizontal: 0
  },
  setCellTextCompleted: {
    color: "#14532D"
  },
  setRowInputCompleted: {
    color: "#14532D"
  },
  colSet: {
    flex: 0.8
  },
  colWeight: {
    flex: 1.2
  },
  colReps: {
    flex: 1.2
  },
  colNotes: {
    flex: 1.1,
    alignItems: "center"
  },
  colCheck: {
    flex: 0.6,
    alignItems: "center"
  },
  notePill: {
    minWidth: 44,
    borderRadius: 8,
    backgroundColor: "#DED8CF",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  notePillText: {
    color: "#4A4A40",
    fontSize: 12,
    fontWeight: "700"
  },
  checkPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#DED8CF",
    alignItems: "center",
    justifyContent: "center"
  },
  checkPillCompleted: {
    backgroundColor: "#22C55E"
  },
  checkPillText: {
    color: "#FEFEFA",
    fontWeight: "800"
  },
  addSetSimpleButton: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DED8CF",
    backgroundColor: "#FEFEFA",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10
  },
  addSetSimpleButtonText: {
    color: "#2C2C24",
    fontSize: 17,
    fontWeight: "600"
  },
  templateActionStack: {
    marginTop: 4,
    gap: 8
  },
  openAddModalButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#5D7052"
  },
  openAddModalButtonText: {
    color: "#FEFEFA",
    fontWeight: "800"
  },
  secondaryActionButton: {
    backgroundColor: "#E6DCCD"
  },
  secondaryActionButtonText: {
    color: "#4A4A40"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    padding: 16
  },
  modalBackdropTapTarget: {
    ...StyleSheet.absoluteFillObject
  },
  modalCard: {
    backgroundColor: "#FEFEFA",
    borderRadius: 20,
    padding: 16,
    maxHeight: "90%",
    shadowColor: "#2C2C24",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 12
    },
    elevation: 12
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#2C2C24"
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#DED8CF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEFEFA"
  },
  modalCloseButtonText: {
    color: "#4A4A40",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 18
  },
  modalSubtitle: {
    marginTop: 4,
    marginBottom: 8,
    color: "#78786C",
    fontSize: 13
  },
  modalSection: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DED8CF",
    backgroundColor: "#FEFEFA",
    padding: 12,
    marginTop: 10
  },
  modernInput: {
    borderWidth: 1,
    borderColor: "#DED8CF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#FEFEFA",
    marginTop: 8
  },
  foodTextInput: {
    minHeight: 90,
    textAlignVertical: "top"
  },
  foodPhotoActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8
  },
  foodPhotoActionButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DED8CF",
    backgroundColor: "#FEFEFA",
    paddingVertical: 10,
    alignItems: "center"
  },
  foodPhotoActionButtonText: {
    color: "#4A4A40",
    fontWeight: "700"
  },
  foodImagePreviewWrap: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DED8CF",
    padding: 10,
    backgroundColor: "#FEFEFA"
  },
  foodImagePreview: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    backgroundColor: "#DED8CF"
  },
  clearFoodImageButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 8,
    backgroundColor: "#DED8CF",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  clearFoodImageButtonText: {
    color: "#4A4A40",
    fontWeight: "700"
  },
  foodComposerErrorText: {
    marginTop: 10,
    color: "#A85448",
    fontSize: 13
  },
  searchInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#DED8CF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FEFEFA"
  },
  searchList: {
    marginTop: 8,
    maxHeight: 320
  },
  searchResultRow: {
    borderWidth: 1,
    borderColor: "#DED8CF",
    borderRadius: 12,
    backgroundColor: "#FEFEFA",
    padding: 12,
    marginBottom: 8
  },
  searchResultName: {
    color: "#2C2C24",
    fontWeight: "700"
  },
  searchResultMeta: {
    marginTop: 2,
    color: "#78786C",
    fontSize: 12
  },
  exerciseSelectionHeader: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DED8CF",
    backgroundColor: "#FEFEFA",
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center"
  },
  exerciseSelectionImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#DED8CF"
  },
  exerciseSelectionImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DED8CF"
  },
  exerciseSelectionImagePlaceholderText: {
    color: "#78786C",
    fontSize: 11,
    fontWeight: "700"
  },
  exerciseSelectionTextBlock: {
    flex: 1
  },
  exerciseSelectionLabel: {
    color: "#78786C",
    fontSize: 12,
    fontWeight: "700"
  },
  exerciseSelectionName: {
    marginTop: 2,
    color: "#2C2C24",
    fontSize: 17,
    fontWeight: "800"
  },
  emptySetCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DED8CF",
    backgroundColor: "#FEFEFA",
    padding: 12
  },
  loggedSetList: {
    maxHeight: 200,
    marginTop: 8
  },
  loggedSetItem: {
    borderWidth: 1,
    borderColor: "#DCE3EF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  loggedSetTextBlock: {
    flex: 1
  },
  deleteSetButton: {
    marginLeft: 10,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#F6E4DF"
  },
  deleteSetButtonText: {
    color: "#8E3D34",
    fontWeight: "700"
  },
  composerActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10
  },
  composerCancelButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#DED8CF"
  },
  composerCancelButtonText: {
    color: "#4A4A40",
    fontWeight: "700"
  },
  composerSaveButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#5D7052"
  },
  composerSaveButtonText: {
    color: "#FEFEFA",
    fontWeight: "800"
  },
  logSetButton: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#5D7052"
  },
  logSetButtonText: {
    color: "#FEFEFA",
    fontWeight: "800"
  },
  cancelButton: {
    flex: 1,
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#DED8CF"
  },
  cancelButtonText: {
    color: "#4A4A40",
    fontWeight: "700"
  },
  saveExerciseButton: {
    flex: 1,
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#5D7052"
  },
  saveExerciseButtonText: {
    color: "#FEFEFA",
    fontWeight: "800"
  },
  menuBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.4)"
  },
  menuSheet: {
    backgroundColor: "#FEFEFA",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24
  },
  menuHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#DED8CF",
    marginBottom: 10
  },
  menuRow: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#DED8CF"
  },
  menuRowText: {
    color: "#2C2C24",
    fontSize: 16,
    fontWeight: "600"
  },
  menuDeleteText: {
    color: "#A85448",
    fontSize: 16,
    fontWeight: "500"
  },
  notesSheet: {
    backgroundColor: "#FEFEFA",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24
  },
  notesSheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2C2C24"
  },
  notesSheetSubtitle: {
    marginTop: 6,
    color: "#78786C",
    fontSize: 13
  },
  notesInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#DED8CF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FEFEFA",
    minHeight: 120
  },
  notesActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12
  },
  adviceSheet: {
    backgroundColor: "#FEFEFA",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: "80%"
  },
  adviceTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2C2C24",
    marginBottom: 12
  },
  adviceLoadingWrap: {
    paddingVertical: 24,
    alignItems: "center"
  },
  adviceErrorText: {
    color: "#A85448",
    fontSize: 14,
    marginBottom: 12
  },
  adviceScroll: {
    maxHeight: 240,
    marginBottom: 16
  },
  adviceSetsBlock: {
    marginBottom: 12
  },
  adviceSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#78786C",
    marginBottom: 6
  },
  adviceSetRow: {
    fontSize: 15,
    color: "#2C2C24",
    marginBottom: 4
  },
  adviceTextBlock: {
    marginBottom: 12
  },
  adviceParagraph: {
    fontSize: 14,
    color: "#4A4A40",
    lineHeight: 20
  },
  adviceActions: {
    flexDirection: "row",
    gap: 12
  },
  adviceButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  adviceButtonAccept: {
    backgroundColor: "#2C2C24"
  },
  adviceButtonDecline: {
    backgroundColor: "#DED8CF"
  },
  adviceButtonText: {
    fontSize: 16,
    fontWeight: "700"
  },
  adviceButtonTextAccept: {
    color: "#FEFEFA"
  },
  adviceButtonTextDecline: {
    color: "#2C2C24"
  },
  keyboardDoneWrap: {
    position: "absolute",
    right: 12,
    zIndex: 2000
  },
  keyboardDoneButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6F2EA",
    borderWidth: 1,
    borderColor: "#DED8CF"
  },
  keyboardDoneButtonPressed: {
    opacity: 0.75
  },
  keyboardDoneText: {
    color: "#5D7052",
    fontSize: 16,
    fontWeight: "700"
  }
});
