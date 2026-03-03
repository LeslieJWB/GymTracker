import { Dispatch, SetStateAction, useState } from "react";
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { appStyles } from "../styles/appStyles";
import { BackButton } from "./BackButton";
import { DONE_BAR_ID } from "./KeyboardDoneBar";
import { SwipeActionRow } from "./SwipeActionRow";
import { ExerciseDetail, SetDrafts } from "../types/workout";

type ExerciseScreenProps = {
  loading: boolean;
  setScreen: (screen: "record") => void;
  exerciseDetail: ExerciseDetail | null;
  exerciseNotesDraft: string;
  setExerciseNotesDraft: (value: string) => void;
  savingExerciseNotes: boolean;
  saveExerciseNotes: () => void;
  setDrafts: SetDrafts;
  setSetDrafts: Dispatch<SetStateAction<SetDrafts>>;
  savingSetIds: Record<string, boolean>;
  saveSet: (setId: string) => void;
  deleteSet: (setId: string) => void;
  newSetReps: string;
  setNewSetReps: (value: string) => void;
  newSetWeight: string;
  setNewSetWeight: (value: string) => void;
  addSet: () => void;
  deleteExercise: () => void;
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

export function ExerciseScreen({
  loading,
  setScreen,
  exerciseDetail,
  exerciseNotesDraft,
  setExerciseNotesDraft,
  savingExerciseNotes,
  saveExerciseNotes,
  setDrafts,
  setSetDrafts,
  savingSetIds,
  saveSet,
  deleteSet,
  newSetReps,
  setNewSetReps,
  newSetWeight,
  setNewSetWeight,
  addSet,
  deleteExercise
}: ExerciseScreenProps) {
  const [showAddSetComposer, setShowAddSetComposer] = useState(false);
  const normalizedExerciseNotes = exerciseNotesDraft.trim();
  const normalizedSavedExerciseNotes = (exerciseDetail?.notes ?? "").trim();
  const exerciseNotesDirty = normalizedExerciseNotes !== normalizedSavedExerciseNotes;

  function saveNewSet(): void {
    const reps = Number(newSetReps);
    const weight = Number(newSetWeight);
    if (
      !Number.isInteger(reps) ||
      reps <= 0 ||
      !Number.isFinite(weight) ||
      weight < 0
    ) {
      Alert.alert("Invalid set", "Set needs reps > 0 and weight >= 0.");
      return;
    }
    addSet();
    setShowAddSetComposer(false);
  }

  return (
    <>
      <View style={appStyles.headerRow}>
        <BackButton onPress={() => setScreen("record")} disabled={loading} />
      </View>

      <View style={styles.exerciseHeader}>
        {exerciseDetail?.exerciseItemImageUrl ? (
          <Image source={{ uri: exerciseDetail.exerciseItemImageUrl }} style={styles.exerciseHeaderImage} />
        ) : (
          <View style={styles.exerciseHeaderImagePlaceholder}>
            <Text style={styles.exerciseHeaderImagePlaceholderText}>No Image</Text>
          </View>
        )}
        <View style={styles.exerciseHeaderTextBlock}>
          <Text style={styles.exerciseHeaderLabel}>Exercise</Text>
          <Text style={styles.exerciseHeaderName}>
            {exerciseDetail?.exerciseItemName ?? "Exercise"}
          </Text>
        </View>
      </View>

      <View style={styles.notesCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardHeader}>Exercise Notes</Text>
          <Text style={styles.statusText}>
            {savingExerciseNotes ? "Saving..." : exerciseNotesDirty ? "Unsaved" : "Saved"}
          </Text>
        </View>
        <TextInput
          style={styles.modernInput}
          value={exerciseNotesDraft}
          onChangeText={setExerciseNotesDraft}
          onBlur={() => {
            if (exerciseNotesDirty && !loading && !savingExerciseNotes && exerciseDetail) {
              saveExerciseNotes();
            }
          }}
          placeholder="How did this exercise feel?"
          placeholderTextColor="#78786C"
        />
      </View>

      <Text style={appStyles.sectionTitle}>Sets</Text>
      {(exerciseDetail?.sets ?? []).length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Text style={appStyles.emptyText}>No sets yet. Add one below.</Text>
        </View>
      ) : (
        (exerciseDetail?.sets ?? []).map((item, index) => (
          <SwipeActionRow
            key={item.id}
            onAction={() => deleteSet(item.id)}
            disabled={loading || Boolean(savingSetIds[item.id])}
            borderRadius={14}
            marginBottom={10}
          >
            <View style={styles.setCard}>
              <View style={styles.setTitleRow}>
                <Text style={appStyles.cardTitle}>Set {index + 1}</Text>
                <View style={styles.metricPill}>
                  <Text style={styles.metricPillText}>
                    {setDrafts[item.id]?.reps ?? String(item.reps)} reps @{" "}
                    {setDrafts[item.id]?.weight ?? String(item.weight)}kg
                  </Text>
                </View>
              </View>
              <View style={appStyles.row}>
                <View style={appStyles.col}>
                  <TextInput
                    style={styles.modernInput}
                    value={setDrafts[item.id]?.reps ?? String(item.reps)}
                    onChangeText={(text) =>
                      setSetDrafts((prev) => ({
                        ...prev,
                        [item.id]: {
                          reps: sanitizeIntegerInput(text),
                          weight: prev[item.id]?.weight ?? String(item.weight),
                          notes: prev[item.id]?.notes ?? item.notes ?? ""
                        }
                      }))
                    }
                    keyboardType="numeric"
                    inputAccessoryViewID={DONE_BAR_ID}
                    placeholder="Reps"
                  />
                </View>
                <View style={appStyles.col}>
                  <View style={styles.weightInputWrap}>
                    <TextInput
                      style={styles.weightInput}
                      value={setDrafts[item.id]?.weight ?? String(item.weight)}
                      onChangeText={(text) =>
                        setSetDrafts((prev) => ({
                          ...prev,
                          [item.id]: {
                            reps: prev[item.id]?.reps ?? String(item.reps),
                            weight: sanitizeWeightInput(text),
                            notes: prev[item.id]?.notes ?? item.notes ?? ""
                          }
                        }))
                      }
                      keyboardType="decimal-pad"
                      inputAccessoryViewID={DONE_BAR_ID}
                      placeholder="Weight"
                      placeholderTextColor="#78786C"
                    />
                    <Text style={styles.unitLabel}>kg</Text>
                  </View>
                </View>
              </View>
              <TextInput
                style={[styles.modernInput, styles.setNoteInput]}
                value={setDrafts[item.id]?.notes ?? item.notes ?? ""}
                onChangeText={(text) =>
                  setSetDrafts((prev) => ({
                    ...prev,
                    [item.id]: {
                      reps: prev[item.id]?.reps ?? String(item.reps),
                      weight: prev[item.id]?.weight ?? String(item.weight),
                      notes: text
                    }
                  }))
                }
                onBlur={() => {
                  const draft = setDrafts[item.id];
                  if (
                    !draft ||
                    loading ||
                    savingSetIds[item.id] ||
                    (item.notes ?? "").trim() === draft.notes.trim()
                  ) {
                    return;
                  }
                  saveSet(item.id);
                }}
                placeholder="Set note (optional)"
                placeholderTextColor="#78786C"
              />
              <Text style={styles.statusText}>
                {savingSetIds[item.id]
                  ? "Saving..."
                  : (() => {
                      const draft = setDrafts[item.id];
                      if (!draft) {
                        return "Saved";
                      }
                      const reps = Number(draft.reps);
                      const weight = Number(draft.weight);
                      if (
                        !Number.isInteger(reps) ||
                        reps <= 0 ||
                        !Number.isFinite(weight) ||
                        weight < 0
                      ) {
                        return "Invalid values";
                      }
                      const dirty =
                        String(item.reps) !== draft.reps ||
                        String(item.weight) !== draft.weight ||
                        (item.notes ?? "").trim() !== draft.notes.trim();
                      return dirty ? "Unsaved" : "Saved";
                    })()}
              </Text>
            </View>
          </SwipeActionRow>
        ))
      )}

      <View style={styles.addSetCard}>
        <Text style={styles.cardHeader}>Add Set</Text>
        {!showAddSetComposer ? (
          <TouchableOpacity
            style={styles.addSetButton}
            onPress={() => setShowAddSetComposer(true)}
            disabled={loading || !exerciseDetail}
          >
            <Text style={styles.addSetButtonText}>+ Add Set</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={appStyles.row}>
              <View style={appStyles.col}>
                <TextInput
                  style={styles.modernInput}
                  value={newSetReps}
                  onChangeText={(text) => setNewSetReps(sanitizeIntegerInput(text))}
                  keyboardType="numeric"
                  inputAccessoryViewID={DONE_BAR_ID}
                  placeholder="Reps"
                  placeholderTextColor="#78786C"
                />
              </View>
              <View style={appStyles.col}>
                <View style={styles.weightInputWrap}>
                  <TextInput
                    style={styles.weightInput}
                    value={newSetWeight}
                    onChangeText={(text) => setNewSetWeight(sanitizeWeightInput(text))}
                    keyboardType="decimal-pad"
                    inputAccessoryViewID={DONE_BAR_ID}
                    placeholder="Weight"
                    placeholderTextColor="#78786C"
                  />
                  <Text style={styles.unitLabel}>kg</Text>
                </View>
              </View>
            </View>
            <View style={styles.newSetActionRow}>
              <TouchableOpacity
                style={styles.newSetCancelButton}
                onPress={() => {
                  setShowAddSetComposer(false);
                  setNewSetReps("");
                  setNewSetWeight("");
                }}
                disabled={loading}
              >
                <Text style={styles.newSetCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.newSetSaveButton}
                onPress={saveNewSet}
                disabled={loading || !exerciseDetail}
              >
                <Text style={styles.newSetSaveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <TouchableOpacity
        style={styles.deleteExerciseButton}
        onPress={deleteExercise}
        disabled={loading || !exerciseDetail}
      >
        <Text style={styles.deleteExerciseButtonText}>Delete Exercise</Text>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  exerciseHeader: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DED8CF",
    backgroundColor: "#FEFEFA",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  exerciseHeaderImage: {
    width: 78,
    height: 78,
    borderRadius: 10,
    backgroundColor: "#DED8CF"
  },
  exerciseHeaderImagePlaceholder: {
    width: 78,
    height: 78,
    borderRadius: 10,
    backgroundColor: "#DED8CF",
    alignItems: "center",
    justifyContent: "center"
  },
  exerciseHeaderImagePlaceholderText: {
    color: "#78786C",
    fontSize: 11,
    fontWeight: "700"
  },
  exerciseHeaderTextBlock: {
    flex: 1
  },
  exerciseHeaderLabel: {
    color: "#78786C",
    fontSize: 12,
    fontWeight: "700"
  },
  exerciseHeaderName: {
    marginTop: 2,
    color: "#2C2C24",
    fontSize: 19,
    fontWeight: "800"
  },
  notesCard: {
    marginTop: 6,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#FEFEFA",
    borderWidth: 1,
    borderColor: "#DED8CF"
  },
  addSetCard: {
    marginTop: 12,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#FEFEFA",
    borderWidth: 1,
    borderColor: "#DED8CF"
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2C2C24",
    marginBottom: 6
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  statusText: {
    color: "#78786C",
    fontSize: 12,
    fontWeight: "700"
  },
  modernInput: {
    borderWidth: 1,
    borderColor: "#DED8CF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#FEFEFA"
  },
  weightInputWrap: {
    borderWidth: 1,
    borderColor: "#DED8CF",
    borderRadius: 12,
    backgroundColor: "#FEFEFA",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12
  },
  weightInput: {
    flex: 1,
    paddingVertical: 11
  },
  setNoteInput: {
    marginTop: 8
  },
  unitLabel: {
    color: "#78786C",
    fontWeight: "700"
  },
  saveNotesButton: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#4A4A40"
  },
  saveNotesButtonText: {
    color: "#FEFEFA",
    fontWeight: "700"
  },
  emptyStateCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DED8CF",
    backgroundColor: "#FEFEFA",
    padding: 12
  },
  setCard: {
    backgroundColor: "#FEFEFA",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DED8CF",
    padding: 12
  },
  setTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  metricPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#E8EEE4"
  },
  metricPillText: {
    color: "#5D7052",
    fontSize: 12,
    fontWeight: "700"
  },
  noteText: {
    marginTop: 8,
    color: "#475569"
  },
  inlineSaveButton: {
    flex: 1,
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#4A4A40"
  },
  inlineSaveButtonText: {
    color: "#FEFEFA",
    fontWeight: "700"
  },
  inlineDeleteButton: {
    flex: 1,
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#F6E4DF"
  },
  inlineDeleteButtonText: {
    color: "#8E3D34",
    fontWeight: "700"
  },
  addSetButton: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#5D7052"
  },
  addSetButtonText: {
    color: "#FEFEFA",
    fontWeight: "800"
  },
  newSetActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10
  },
  newSetCancelButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#DED8CF"
  },
  newSetCancelButtonText: {
    color: "#4A4A40",
    fontWeight: "700"
  },
  newSetSaveButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#5D7052"
  },
  newSetSaveButtonText: {
    color: "#FEFEFA",
    fontWeight: "800"
  },
  deleteExerciseButton: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#F6E4DF",
    borderWidth: 1,
    borderColor: "#D9A79D"
  },
  deleteExerciseButtonText: {
    color: "#8E3D34",
    fontWeight: "700"
  }
});
