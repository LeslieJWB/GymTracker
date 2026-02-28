import { useEffect, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { appStyles } from "../styles/appStyles";
import { SwipeActionRow } from "./SwipeActionRow";
import { AdviceReviewResult, ExerciseDetail, ExerciseItem, RecordDetail, SetDraft, SetDrafts, User } from "../types/workout";

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
  fetchDailySummary: (date: string) => Promise<AdviceReviewResult>;
  fetchExerciseFeedback: (input: {
    exerciseId: string;
    exerciseItemId: string;
    exerciseName: string;
    date: string;
  }) => Promise<AdviceReviewResult>;
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
  fetchDailySummary,
  fetchExerciseFeedback
}: RecordScreenProps) {
  const [showExerciseSearchModal, setShowExerciseSearchModal] = useState(false);
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState("");
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
  const totalCaloriesKcal = recordDetail?.totalCaloriesKcal ?? 0;
  const totalProteinG = recordDetail?.totalProteinG ?? 0;
  const foodEntryCount = recordDetail?.foodConsumptions.length ?? 0;
  const foodEntryLabel = foodEntryCount === 1 ? "entry" : "entries";

  useEffect(() => {
    if (!themeDirty || loading || !user || savingRecordTheme) {
      return;
    }
    const timeoutId = setTimeout(() => {
      saveRecordTheme();
    }, 550);
    return () => clearTimeout(timeoutId);
  }, [themeDirty, loading, user, savingRecordTheme, saveRecordTheme]);

  useEffect(() => {
    if (!bodyWeightDirty || !isBodyWeightDraftValid || loading || !user || savingBodyWeight) {
      return;
    }
    const timeoutId = setTimeout(() => {
      saveBodyWeight();
    }, 550);
    return () => clearTimeout(timeoutId);
  }, [bodyWeightDirty, isBodyWeightDraftValid, loading, user, savingBodyWeight, saveBodyWeight]);

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
      base64: true
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
      base64: true
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
      <View style={styles.themeCard}>
        <View style={styles.themeHeaderRow}>
          <Text style={styles.themeLabel}>Day Theme</Text>
          <View
            style={[
              styles.themeStatusBadge,
              savingRecordTheme
                ? styles.themeStatusSavingBadge
                : themeDirty
                  ? styles.themeStatusUnsavedBadge
                  : styles.themeStatusSavedBadge
            ]}
          >
            <Text style={styles.themeStatusBadgeText}>{savingRecordTheme ? "Saving..." : themeDirty ? "Unsaved" : "Saved"}</Text>
          </View>
        </View>
        <TextInput
          style={styles.themeInput}
          value={recordThemeDraft}
          onChangeText={setRecordThemeDraft}
          onBlur={() => {
            if (themeDirty && !loading && !savingRecordTheme && user) {
              saveRecordTheme();
            }
          }}
          placeholder="e.g. pull, push, leg"
          placeholderTextColor="#94A3B8"
          editable={Boolean(user) && !loading}
          maxLength={30}
        />
        <Text style={styles.themeHint}>Auto-saves for {selectedDate}</Text>
      </View>

      <View style={styles.statsStrip}>
        <View style={styles.statsItem}>
          <Text style={styles.statsLabel}>Total Volume</Text>
          <Text style={styles.statsValue}>{Math.round(totalVolume)} kg</Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={styles.statsLabel}>Completed Sets</Text>
          <Text style={styles.statsValue}>{totalSetCount}</Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={styles.statsLabel}>Calories</Text>
          <Text style={styles.statsValue}>{Math.round(totalCaloriesKcal)} kcal</Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={styles.statsLabel}>Protein</Text>
          <Text style={styles.statsValue}>{Math.round(totalProteinG)} g</Text>
        </View>
      </View>

      <View style={styles.weightCard}>
        <View style={styles.weightHeaderRow}>
          <Text style={styles.weightCardTitle}>Today's Weight</Text>
          <View
            style={[
              styles.themeStatusBadge,
              savingBodyWeight
                ? styles.themeStatusSavingBadge
                : bodyWeightDirty
                  ? styles.themeStatusUnsavedBadge
                  : styles.themeStatusSavedBadge
            ]}
          >
            <Text style={styles.themeStatusBadgeText}>{savingBodyWeight ? "Saving..." : bodyWeightDirty ? "Unsaved" : "Saved"}</Text>
          </View>
        </View>
        <View style={styles.weightInputRow}>
          <TextInput
            style={styles.weightInput}
            value={bodyWeightDraft}
            onChangeText={(value) => setBodyWeightDraft(sanitizeWeightInput(value))}
            keyboardType="decimal-pad"
            placeholder="kg"
            placeholderTextColor="#94A3B8"
            editable={Boolean(user) && !loading && !savingBodyWeight}
            onBlur={() => {
              if (bodyWeightDirty && isBodyWeightDraftValid && !savingBodyWeight && !loading && user) {
                saveBodyWeight();
              }
            }}
          />
        </View>
        <Text style={styles.weightCardHint}>Auto-saves for {selectedDate}</Text>
      </View>

      <TouchableOpacity
        style={styles.dailySummaryButton}
        onPress={openDailySummaryModal}
        disabled={loading}
      >
        <Text style={styles.dailySummaryButtonText}>Get AI Summary</Text>
      </TouchableOpacity>

      <View style={styles.foodCard}>
        <Pressable
          style={styles.foodCardHeader}
          onPress={() => setFoodSectionExpanded((current) => !current)}
        >
          <View>
            <Text style={styles.foodCardTitle}>Food Consumption</Text>
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
              <Text style={styles.addFoodButtonText}>+ Add Food Consumption</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>

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
                                        placeholder="0"
                                        placeholderTextColor="#94A3B8"
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
                                        placeholder="0"
                                        placeholderTextColor="#94A3B8"
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

                      </>
                    )}
                  </>
                ) : null}
              </View>
          );
        })
      )}

      <TouchableOpacity style={styles.openAddModalButton} onPress={openExerciseSearchModal} disabled={loading || !user}>
        <Text style={styles.openAddModalButtonText}>+ Add Exercise</Text>
      </TouchableOpacity>

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
              multiline
              numberOfLines={3}
              placeholder="e.g. 60g steel cut oats + 200ml milk"
              placeholderTextColor="#94A3B8"
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
              placeholder="Search exercises..."
              placeholderTextColor="#94A3B8"
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
                  setAdviceTarget({
                    exerciseId: target.id,
                    exerciseItemId: target.exerciseItemId,
                    exerciseItemName: target.exerciseItemName
                  });
                }
              }}
            >
              <Text style={styles.menuRowText}>Get AI Advice</Text>
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
        <View style={styles.menuBackdrop}>
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
                  placeholderTextColor="#94A3B8"
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
        </View>
      </Modal>

      <Modal
        visible={exerciseNotesTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeExerciseNotesSheet}
      >
        <View style={styles.menuBackdrop}>
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
                  value={exerciseNotesDraftById[exerciseNotesTarget.exerciseId] ?? ""}
                  onChangeText={(value) => updateExerciseNotesDraft(exerciseNotesTarget.exerciseId, value)}
                  placeholder="e.g. Keep elbows tucked and control eccentric"
                  placeholderTextColor="#94A3B8"
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
        </View>
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
                      Review ({dailySummaryResult.source === "gemini" ? "AI" : "Fallback"})
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
                      Review ({feedbackResult.source === "gemini" ? "AI" : "Fallback"})
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
  statsStrip: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  statsItem: {
    width: "48%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  statsLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600"
  },
  statsValue: {
    marginTop: 4,
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "800"
  },
  weightCard: {
    marginTop: 8,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0"
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
    color: "#0F172A"
  },
  weightCardHint: {
    marginTop: 6,
    color: "#64748B",
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
    borderColor: "#D4DCE8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F8FAFC",
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "700"
  },
  dailySummaryButton: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#1D4ED8"
  },
  dailySummaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15
  },
  themeCard: {
    marginTop: 6,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
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
    color: "#334155"
  },
  themeInput: {
    borderWidth: 1,
    borderColor: "#D4DCE8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#F8FAFC"
  },
  themeHint: {
    marginTop: 6,
    color: "#64748B",
    fontSize: 12
  },
  foodCard: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
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
    color: "#0F172A"
  },
  foodCardSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748B"
  },
  foodCardChevron: {
    color: "#334155",
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
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    padding: 10
  },
  foodList: {
    marginTop: 8,
    gap: 8
  },
  foodRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    backgroundColor: "#F8FAFC"
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
    color: "#0F172A"
  },
  foodDeleteButton: {
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  foodDeleteButtonText: {
    color: "#B91C1C",
    fontWeight: "700",
    fontSize: 12
  },
  foodMacrosText: {
    marginTop: 6,
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "700"
  },
  foodCommentText: {
    marginTop: 4,
    color: "#334155",
    fontSize: 13,
    lineHeight: 18
  },
  addFoodButton: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: "#0F172A",
    paddingVertical: 10,
    alignItems: "center"
  },
  addFoodButtonText: {
    color: "#FFFFFF",
    fontWeight: "800"
  },
  emptyStateCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 12
  },
  emptyStateTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4
  },
  loadingExerciseCard: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    padding: 10
  },
  statusText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700"
  },
  exerciseCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
    backgroundColor: "#E2E8F0"
  },
  exerciseThumbPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center"
  },
  exerciseThumbPlaceholderText: {
    color: "#64748B",
    fontSize: 8,
    fontWeight: "700"
  },
  exerciseHeaderText: {
    flex: 1
  },
  exerciseTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800"
  },
  exerciseSubtitle: {
    marginTop: 2,
    color: "#64748B",
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
    color: "#334155",
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
    color: "#94A3B8",
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
    backgroundColor: "#FFFFFF"
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
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center"
  },
  setRowInput: {
    color: "#0F172A",
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
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  notePillText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700"
  },
  checkPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center"
  },
  checkPillCompleted: {
    backgroundColor: "#22C55E"
  },
  checkPillText: {
    color: "#FFFFFF",
    fontWeight: "800"
  },
  addSetSimpleButton: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10
  },
  addSetSimpleButtonText: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "600"
  },
  openAddModalButton: {
    marginTop: 4,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#1D4ED8"
  },
  openAddModalButtonText: {
    color: "#FFFFFF",
    fontWeight: "800"
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
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    maxHeight: "90%",
    shadowColor: "#0F172A",
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
    color: "#0F172A"
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC"
  },
  modalCloseButtonText: {
    color: "#334155",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 18
  },
  modalSubtitle: {
    marginTop: 4,
    marginBottom: 8,
    color: "#64748B",
    fontSize: 13
  },
  modalSection: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    padding: 12,
    marginTop: 10
  },
  modernInput: {
    borderWidth: 1,
    borderColor: "#D4DCE8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#F8FAFC",
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
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingVertical: 10,
    alignItems: "center"
  },
  foodPhotoActionButtonText: {
    color: "#334155",
    fontWeight: "700"
  },
  foodImagePreviewWrap: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    backgroundColor: "#F8FAFC"
  },
  foodImagePreview: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    backgroundColor: "#E2E8F0"
  },
  clearFoodImageButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  clearFoodImageButtonText: {
    color: "#334155",
    fontWeight: "700"
  },
  foodComposerErrorText: {
    marginTop: 10,
    color: "#DC2626",
    fontSize: 13
  },
  searchInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF"
  },
  searchList: {
    marginTop: 8,
    maxHeight: 320
  },
  searchResultRow: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 12,
    marginBottom: 8
  },
  searchResultName: {
    color: "#0F172A",
    fontWeight: "700"
  },
  searchResultMeta: {
    marginTop: 2,
    color: "#64748B",
    fontSize: 12
  },
  exerciseSelectionHeader: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center"
  },
  exerciseSelectionImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#E2E8F0"
  },
  exerciseSelectionImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E2E8F0"
  },
  exerciseSelectionImagePlaceholderText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700"
  },
  exerciseSelectionTextBlock: {
    flex: 1
  },
  exerciseSelectionLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700"
  },
  exerciseSelectionName: {
    marginTop: 2,
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "800"
  },
  emptySetCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#FEE2E2"
  },
  deleteSetButtonText: {
    color: "#B91C1C",
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
    backgroundColor: "#E2E8F0"
  },
  composerCancelButtonText: {
    color: "#334155",
    fontWeight: "700"
  },
  composerSaveButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#1D4ED8"
  },
  composerSaveButtonText: {
    color: "#FFFFFF",
    fontWeight: "800"
  },
  logSetButton: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#1D4ED8"
  },
  logSetButtonText: {
    color: "#FFFFFF",
    fontWeight: "800"
  },
  cancelButton: {
    flex: 1,
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#E2E8F0"
  },
  cancelButtonText: {
    color: "#334155",
    fontWeight: "700"
  },
  saveExerciseButton: {
    flex: 1,
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#1D4ED8"
  },
  saveExerciseButtonText: {
    color: "#FFFFFF",
    fontWeight: "800"
  },
  menuBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.4)"
  },
  menuSheet: {
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#CBD5E1",
    marginBottom: 10
  },
  menuRow: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0"
  },
  menuRowText: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "600"
  },
  menuDeleteText: {
    color: "#DC2626",
    fontSize: 16,
    fontWeight: "500"
  },
  notesSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24
  },
  notesSheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A"
  },
  notesSheetSubtitle: {
    marginTop: 6,
    color: "#64748B",
    fontSize: 13
  },
  notesInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F8FAFC",
    minHeight: 120
  },
  notesActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12
  },
  adviceSheet: {
    backgroundColor: "#FFFFFF",
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
    color: "#0F172A",
    marginBottom: 12
  },
  adviceLoadingWrap: {
    paddingVertical: 24,
    alignItems: "center"
  },
  adviceErrorText: {
    color: "#DC2626",
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
    color: "#64748B",
    marginBottom: 6
  },
  adviceSetRow: {
    fontSize: 15,
    color: "#0F172A",
    marginBottom: 4
  },
  adviceTextBlock: {
    marginBottom: 12
  },
  adviceParagraph: {
    fontSize: 14,
    color: "#334155",
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
    backgroundColor: "#0F172A"
  },
  adviceButtonDecline: {
    backgroundColor: "#E2E8F0"
  },
  adviceButtonText: {
    fontSize: 16,
    fontWeight: "700"
  },
  adviceButtonTextAccept: {
    color: "#FFFFFF"
  },
  adviceButtonTextDecline: {
    color: "#0F172A"
  }
});
