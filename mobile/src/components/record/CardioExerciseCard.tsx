import { Image, Pressable, Text, TextInput, TouchableOpacity, View } from "react-native";
import { appStyles } from "../../styles/appStyles";
import {
  CardioSessionDraft,
  CardioSessionDrafts,
  ExerciseDetail,
  RecordExerciseSummary
} from "../../types/workout";
import { formatDuration, formatDurationLabel, sanitizeDistanceInput, sanitizeDurationInput } from "../../utils/duration";
import { SwipeActionRow } from "../SwipeActionRow";

type CardioExerciseCardProps = {
  styles: any;
  item: RecordExerciseSummary;
  detail: ExerciseDetail | undefined;
  sessionDrafts: CardioSessionDrafts;
  savingSessionIds: Record<string, boolean>;
  isExpanded: boolean;
  loading: boolean;
  user: { id: string } | null;
  toggleExerciseExpanded: (exerciseId: string) => void;
  openExerciseMenu: (item: RecordExerciseSummary) => void;
  setCardioSessionDraft: (exerciseId: string, sessionId: string, draft: CardioSessionDraft) => void;
  saveCardioSession: (exerciseId: string, sessionId: string) => void;
  deleteCardioSession: (exerciseId: string, sessionId: string) => void;
  toggleCardioSessionCompleted: (exerciseId: string, sessionId: string) => void;
  addCardioSessionForExercise: (exerciseId: string) => void;
  openSessionNotesSheet: (input: {
    exerciseId: string;
    sessionId: string;
    sessionNumber: number;
    exerciseName: string;
  }) => void;
};

function buildCardioSubtitle(
  detail: ExerciseDetail | undefined,
  item: RecordExerciseSummary
): string {
  const sessions = detail?.sessions ?? [];
  const completedSessions = sessions.filter((session) => session.isCompleted);
  const sessionCount = completedSessions.length || item.sessionCount;
  const totalDuration = completedSessions.reduce((sum, session) => sum + session.durationSeconds, 0);
  const totalDistance = completedSessions.reduce(
    (sum, session) => sum + (session.distanceKm ?? 0),
    0
  );
  let subtitle = `${sessionCount} session${sessionCount === 1 ? "" : "s"}`;
  if (totalDuration > 0) {
    subtitle += ` · ${formatDurationLabel(totalDuration)}`;
  }
  if (totalDistance > 0) {
    subtitle += ` · ${totalDistance.toFixed(1)} km`;
  }
  return subtitle;
}

export function CardioExerciseCard({
  styles,
  item,
  detail,
  sessionDrafts,
  savingSessionIds,
  isExpanded,
  loading,
  user,
  toggleExerciseExpanded,
  openExerciseMenu,
  setCardioSessionDraft,
  saveCardioSession,
  deleteCardioSession,
  toggleCardioSessionCompleted,
  addCardioSessionForExercise,
  openSessionNotesSheet
}: CardioExerciseCardProps) {
  const subtitle = buildCardioSubtitle(detail, item);

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseCardHeader}>
        <Pressable style={styles.exerciseHeaderTapArea} onPress={() => toggleExerciseExpanded(item.id)}>
          <View style={styles.exerciseHeaderLeft}>
            {item.exerciseItemImageUrl ? (
              <Image source={{ uri: item.exerciseItemImageUrl }} style={styles.exerciseThumb} />
            ) : (
              <View style={[styles.exerciseThumbPlaceholder, styles.cardioThumbPlaceholder]}>
                <Text style={styles.exerciseThumbPlaceholderText}>Cardio</Text>
              </View>
            )}
            <View style={styles.exerciseHeaderText}>
              <Text style={styles.exerciseTitle}>{item.exerciseItemName}</Text>
              <Text style={styles.exerciseSubtitle}>{subtitle}</Text>
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
              <Text style={styles.statusText}>Loading sessions...</Text>
            </View>
          ) : (
            <>
              <View style={styles.setTableHeader}>
                <Text style={[styles.setHeaderText, styles.colSet]}>SESSION</Text>
                <Text style={[styles.setHeaderText, styles.colCardioTime]}>TIME</Text>
                <Text style={[styles.setHeaderText, styles.colCardioDistance]}>KM</Text>
                <Text style={[styles.setHeaderText, styles.colNotes]}>NOTES</Text>
                <Text style={[styles.setHeaderText, styles.colCheck]}>✓</Text>
              </View>

              {detail.sessions.length === 0 ? (
                <View style={styles.emptySetCard}>
                  <Text style={appStyles.emptyText}>No sessions yet.</Text>
                </View>
              ) : (
                detail.sessions.map((session, index) => {
                  const draft = sessionDrafts[session.id] ?? {
                    duration: formatDuration(session.durationSeconds),
                    distance: session.distanceKm !== null ? String(session.distanceKm) : "",
                    notes: session.notes ?? ""
                  };
                  const isCompleted = session.isCompleted;
                  return (
                    <View key={session.id} style={styles.setRowSwipeWrap}>
                      <SwipeActionRow
                        onAction={() => deleteCardioSession(item.id, session.id)}
                        disabled={loading || Boolean(savingSessionIds[session.id])}
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
                                styles.colCardioTime,
                                isCompleted ? styles.setRowInputCompleted : null
                              ]}
                              value={draft.duration}
                              onChangeText={(text) =>
                                setCardioSessionDraft(item.id, session.id, {
                                  duration: sanitizeDurationInput(text),
                                  distance: draft.distance,
                                  notes: draft.notes
                                })
                              }
                              keyboardType="numbers-and-punctuation"
                              placeholder="0:00"
                              placeholderTextColor="#78786C"
                              onBlur={() => saveCardioSession(item.id, session.id)}
                            />
                            <TextInput
                              style={[
                                styles.setRowInput,
                                styles.colCardioDistance,
                                isCompleted ? styles.setRowInputCompleted : null
                              ]}
                              value={draft.distance}
                              onChangeText={(text) =>
                                setCardioSessionDraft(item.id, session.id, {
                                  duration: draft.duration,
                                  distance: sanitizeDistanceInput(text),
                                  notes: draft.notes
                                })
                              }
                              keyboardType="decimal-pad"
                              placeholder="—"
                              placeholderTextColor="#78786C"
                              onBlur={() => saveCardioSession(item.id, session.id)}
                            />
                            <View style={styles.colNotes}>
                              <TouchableOpacity
                                style={styles.notePill}
                                onPress={() =>
                                  openSessionNotesSheet({
                                    exerciseId: item.id,
                                    sessionId: session.id,
                                    sessionNumber: index + 1,
                                    exerciseName: item.exerciseItemName
                                  })
                                }
                                disabled={loading || Boolean(savingSessionIds[session.id])}
                              >
                                <Text style={styles.notePillText}>
                                  {draft.notes.trim().length > 0 ? "View" : "Add"}
                                </Text>
                              </TouchableOpacity>
                            </View>
                            <View style={styles.colCheck}>
                              <Pressable
                                style={[styles.checkPill, isCompleted ? styles.checkPillCompleted : null]}
                                onPress={() => toggleCardioSessionCompleted(item.id, session.id)}
                                disabled={loading || Boolean(savingSessionIds[session.id])}
                              >
                                <Text style={styles.checkPillText}>
                                  {savingSessionIds[session.id] ? "..." : "✓"}
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
                onPress={() => addCardioSessionForExercise(item.id)}
                disabled={loading || !user}
              >
                <Text style={styles.addSetSimpleButtonText}>+ Add Session</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      ) : null}
    </View>
  );
}
