import { Image, Pressable, Text, TextInput, TouchableOpacity, View } from "react-native";
import { appStyles } from "../../styles/appStyles";
import { ExerciseDetail, RecordExerciseSummary, SetDraft, SetDrafts } from "../../types/workout";
import { sanitizeIntegerInput, sanitizeWeightInput } from "../../utils/inputSanitizers";
import { SwipeActionRow } from "../SwipeActionRow";

type StrengthExerciseCardProps = {
  styles: any;
  item: RecordExerciseSummary;
  detail: ExerciseDetail | undefined;
  setDrafts: SetDrafts;
  savingSetIds: Record<string, boolean>;
  isExpanded: boolean;
  completedSetCount: number;
  loading: boolean;
  user: { id: string } | null;
  toggleExerciseExpanded: (exerciseId: string) => void;
  openExerciseMenu: (item: RecordExerciseSummary) => void;
  setSetDraft: (exerciseId: string, setId: string, draft: SetDraft) => void;
  saveSet: (exerciseId: string, setId: string) => void;
  deleteSet: (exerciseId: string, setId: string) => void;
  toggleSetCompleted: (exerciseId: string, setId: string) => void;
  addSetForExercise: (exerciseId: string) => void;
  openAdviceSheetForExercise: (item: RecordExerciseSummary) => void;
  openSetNotesSheet: (input: {
    exerciseId: string;
    setId: string;
    setNumber: number;
    exerciseName: string;
  }) => void;
};

export function StrengthExerciseCard({
  styles,
  item,
  detail,
  setDrafts,
  savingSetIds,
  isExpanded,
  completedSetCount,
  loading,
  user,
  toggleExerciseExpanded,
  openExerciseMenu,
  setSetDraft,
  saveSet,
  deleteSet,
  toggleSetCompleted,
  addSetForExercise,
  openAdviceSheetForExercise,
  openSetNotesSheet
}: StrengthExerciseCardProps) {
  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseCardHeader}>
        <Pressable style={styles.exerciseHeaderTapArea} onPress={() => toggleExerciseExpanded(item.id)}>
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
              <Text style={styles.exerciseSubtitle}>{completedSetCount} sets</Text>
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
                            <Text
                              style={[
                                styles.setCellText,
                                styles.colSet,
                                isCompleted ? styles.setCellTextCompleted : null
                              ]}
                            >
                              {index + 1}
                            </Text>
                            <TextInput
                              style={[
                                styles.setRowInput,
                                styles.colWeight,
                                isCompleted ? styles.setRowInputCompleted : null
                              ]}
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
                              placeholderTextColor="#78786C"
                              onBlur={() => saveSet(item.id, setItem.id)}
                            />
                            <TextInput
                              style={[
                                styles.setRowInput,
                                styles.colReps,
                                isCompleted ? styles.setRowInputCompleted : null
                              ]}
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
                onPress={() => addSetForExercise(item.id)}
                disabled={loading || !user}
              >
                <Text style={styles.addSetSimpleButtonText}>+ Add Set</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addSetSimpleButton}
                onPress={() => openAdviceSheetForExercise(item)}
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
}
