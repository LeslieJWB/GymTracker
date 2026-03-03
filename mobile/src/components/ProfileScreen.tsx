import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { radius, textStyles, withPressScale } from "../styles/theme";
import type { UserProfile } from "../types/workout";

type ProfileInput = {
  heightCm: string;
  gender: string;
  defaultBodyWeightKg: string;
  dailyCalorieTargetKcal: string;
  dailyProteinTargetG: string;
  dateOfBirth: string;
  globalLlmPrompt: string;
};

type ProfileScreenProps = {
  profile: UserProfile | null;
  saving: boolean;
  onSave: (payload: {
    heightCm: number | null;
    gender: string | null;
    defaultBodyWeightKg: number | null;
    dailyCalorieTargetKcal: number | null;
    dailyProteinTargetG: number | null;
    dateOfBirth: string | null;
    globalLlmPrompt: string | null;
  }) => Promise<void>;
  onSignOut: () => void;
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function formatDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function toInput(profile: UserProfile | null): ProfileInput {
  return {
    heightCm: profile?.heightCm != null ? String(profile.heightCm) : "",
    gender: profile?.gender ?? "",
    defaultBodyWeightKg: profile?.defaultBodyWeightKg != null ? String(profile.defaultBodyWeightKg) : "",
    dailyCalorieTargetKcal: profile?.dailyCalorieTargetKcal != null ? String(profile.dailyCalorieTargetKcal) : "",
    dailyProteinTargetG: profile?.dailyProteinTargetG != null ? String(profile.dailyProteinTargetG) : "",
    dateOfBirth: profile?.dateOfBirth ?? "",
    globalLlmPrompt: profile?.globalLlmPrompt ?? ""
  };
}

function getInitials(profile: UserProfile | null): string {
  if (profile?.displayName) {
    const parts = profile.displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }
  if (profile?.email) {
    return profile.email.substring(0, 2).toUpperCase();
  }
  return "??";
}

function getDisplayName(profile: UserProfile | null): string {
  return profile?.displayName || profile?.username || "User";
}

function formatProvider(provider: string | null | undefined): string {
  if (!provider) return "Unknown";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

const AVATAR_COLORS = ["#5D7052", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#5D7052", "#EF4444"];

function getAvatarColor(profile: UserProfile | null): string {
  const seed = profile?.email || profile?.username || "";
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function ProfileScreen({ profile, saving, onSave, onSignOut }: ProfileScreenProps) {
  const [draft, setDraft] = useState<ProfileInput>(() => toInput(profile));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingDate, setPendingDate] = useState<Date>(() => parseDateValue(profile?.dateOfBirth ?? "") ?? new Date());

  useEffect(() => {
    setDraft(toInput(profile));
  }, [
    profile?.id,
    profile?.heightCm,
    profile?.gender,
    profile?.defaultBodyWeightKg,
    profile?.dailyCalorieTargetKcal,
    profile?.dailyProteinTargetG,
    profile?.dateOfBirth,
    profile?.globalLlmPrompt
  ]);

  const openDatePicker = () => {
    setPendingDate(parseDateValue(draft.dateOfBirth) ?? new Date());
    setShowDatePicker(true);
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
      if (event.type === "set" && selectedDate) {
        setDraft((current) => ({ ...current, dateOfBirth: formatDateValue(selectedDate) }));
      }
      return;
    }

    if (selectedDate) {
      setPendingDate(selectedDate);
    }
  };

  const avatarColor = getAvatarColor(profile);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Avatar Hero */}
      <View style={styles.heroSection}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{getInitials(profile)}</Text>
        </View>
        <Text style={styles.heroName}>{getDisplayName(profile)}</Text>
        <Text style={styles.heroEmail}>{profile?.email ?? ""}</Text>
      </View>

      {/* Account Info */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Account</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Email</Text>
          <Text style={styles.infoValue} numberOfLines={1}>{profile?.email ?? "Not set"}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Provider</Text>
          <View style={styles.providerBadge}>
            <Text style={styles.providerBadgeText}>{formatProvider(profile?.authProvider)}</Text>
          </View>
        </View>
      </View>

      {/* Body Metrics */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Body Metrics</Text>
        <Text style={styles.cardSubheader}>Used for workout calculations and tracking</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Height</Text>
          <View style={styles.unitRow}>
            <TextInput
              style={styles.fieldInput}
              value={draft.heightCm}
              onChangeText={(value) => setDraft((current) => ({ ...current, heightCm: digitsOnly(value) }))}
              placeholder="0"
              placeholderTextColor="#A29F94"
              keyboardType="number-pad"

            />
            <View style={styles.unitBadge}>
              <Text style={styles.unitBadgeText}>cm</Text>
            </View>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Gender</Text>
          <View style={styles.segmentedRow}>
            {(["male", "female"] as const).map((option) => {
              const selected = draft.gender === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.segmentedOption, selected && styles.segmentedOptionActive]}
                  onPress={() => setDraft((current) => ({ ...current, gender: option }))}
                >
                  <Text style={[styles.segmentedText, selected && styles.segmentedTextActive]}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Body Weight</Text>
          <View style={styles.unitRow}>
            <TextInput
              style={styles.fieldInput}
              value={draft.defaultBodyWeightKg}
              onChangeText={(value) => setDraft((current) => ({ ...current, defaultBodyWeightKg: digitsOnly(value) }))}
              placeholder="0"
              placeholderTextColor="#A29F94"
              keyboardType="number-pad"

            />
            <View style={styles.unitBadge}>
              <Text style={styles.unitBadgeText}>kg</Text>
            </View>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Daily Calorie Target (optional)</Text>
          <View style={styles.unitRow}>
            <TextInput
              style={styles.fieldInput}
              value={draft.dailyCalorieTargetKcal}
              onChangeText={(value) => setDraft((current) => ({ ...current, dailyCalorieTargetKcal: digitsOnly(value) }))}
              placeholder="e.g. 2200"
              placeholderTextColor="#A29F94"
              keyboardType="number-pad"

            />
            <View style={styles.unitBadge}>
              <Text style={styles.unitBadgeText}>kcal</Text>
            </View>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Daily Protein Target (optional)</Text>
          <View style={styles.unitRow}>
            <TextInput
              style={styles.fieldInput}
              value={draft.dailyProteinTargetG}
              onChangeText={(value) => setDraft((current) => ({ ...current, dailyProteinTargetG: digitsOnly(value) }))}
              placeholder="e.g. 150"
              placeholderTextColor="#A29F94"
              keyboardType="number-pad"

            />
            <View style={styles.unitBadge}>
              <Text style={styles.unitBadgeText}>g</Text>
            </View>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Date of Birth</Text>
          <Pressable style={styles.dateButton} onPress={openDatePicker}>
            <Text style={draft.dateOfBirth ? styles.dateText : styles.datePlaceholder}>
              {draft.dateOfBirth || "Select date"}
            </Text>
            <Text style={styles.dateChevron}>›</Text>
          </Pressable>
        </View>
      </View>

      {/* LLM Prompt */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>AI Coaching</Text>
        <Text style={styles.cardSubheader}>Customize how the AI assistant interacts with you</Text>
        <TextInput
          style={styles.promptInput}
          value={draft.globalLlmPrompt}
          onChangeText={(value) => setDraft((current) => ({ ...current, globalLlmPrompt: value }))}
          placeholder="e.g. Focus on hypertrophy, keep rest times short..."
          placeholderTextColor="#A29F94"
          multiline
          textAlignVertical="top"
        />
      </View>

      {/* Save */}
      <Pressable
        style={({ pressed }) => [styles.saveButton, saving && styles.saveButtonDisabled, pressed && !saving && styles.saveButtonPressed, withPressScale(pressed)]}
        disabled={saving}
        onPress={() =>
          onSave({
            heightCm: draft.heightCm.trim() ? Number(draft.heightCm) : null,
            gender: draft.gender.trim() || null,
            defaultBodyWeightKg: draft.defaultBodyWeightKg.trim() ? Number(draft.defaultBodyWeightKg) : null,
            dailyCalorieTargetKcal: draft.dailyCalorieTargetKcal.trim() ? Number(draft.dailyCalorieTargetKcal) : null,
            dailyProteinTargetG: draft.dailyProteinTargetG.trim() ? Number(draft.dailyProteinTargetG) : null,
            dateOfBirth: draft.dateOfBirth.trim() || null,
            globalLlmPrompt: draft.globalLlmPrompt.trim() || null
          }).catch(() => {})
        }
      >
        <Text style={styles.saveLabel}>{saving ? "Saving..." : "Save Changes"}</Text>
      </Pressable>

      {/* Sign Out */}
      <Pressable
        style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed, withPressScale(pressed)]}
        onPress={onSignOut}
      >
        <Text style={styles.signOutLabel}>Sign Out</Text>
      </Pressable>

      <View style={styles.footer} />

      {/* Date Picker Modals */}
      {Platform.OS === "android" && showDatePicker ? (
        <DateTimePicker
          value={pendingDate}
          mode="date"
          display="calendar"
          maximumDate={new Date()}
          onChange={handleDateChange}
        />
      ) : null}
      {Platform.OS === "ios" && showDatePicker ? (
        <Modal animationType="slide" transparent onRequestClose={() => setShowDatePicker(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Pressable hitSlop={12} onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.modalCancel}>Cancel</Text>
                </Pressable>
                <Text style={styles.modalTitle}>Date of Birth</Text>
                <Pressable
                  hitSlop={12}
                  onPress={() => {
                    setDraft((current) => ({ ...current, dateOfBirth: formatDateValue(pendingDate) }));
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={styles.modalDone}>Done</Text>
                </Pressable>
              </View>
              <View style={styles.spinnerContainer}>
                <DateTimePicker
                  value={pendingDate}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={handleDateChange}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FDFCF8"
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40
  },

  heroSection: {
    alignItems: "center",
    marginBottom: 28
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6
  },
  avatarText: {
    color: "#FEFEFA",
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 1
  },
  heroName: {
    fontSize: 22,
    fontFamily: textStyles.headingSemiBold.fontFamily,
    color: "#2C2C24",
    marginBottom: 4
  },
  heroEmail: {
    fontSize: 14,
    color: "#78786C"
  },

  card: {
    backgroundColor: "#FEFEFA",
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#78786C",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2
  },
  cardHeader: {
    fontSize: 17,
    fontFamily: textStyles.headingSemiBold.fontFamily,
    color: "#2C2C24",
    marginBottom: 2
  },
  cardSubheader: {
    fontSize: 13,
    color: "#78786C",
    marginBottom: 16
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10
  },
  infoKey: {
    fontSize: 15,
    color: "#78786C",
    fontWeight: "500"
  },
  infoValue: {
    fontSize: 15,
    color: "#2C2C24",
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
    maxWidth: "60%"
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#DED8CF"
  },
  providerBadge: {
    backgroundColor: "#E6DCCD",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8
  },
  providerBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5D7052"
  },

  fieldGroup: {
    marginBottom: 16
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#78786C",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  fieldInput: {
    flex: 1,
    backgroundColor: "#FFFFFFCC",
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#2C2C24",
    fontWeight: "500",
    borderWidth: 1,
    borderColor: "#DED8CF"
  },
  unitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  unitBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DED8CF"
  },
  unitBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569"
  },

  segmentedRow: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: radius.pill,
    padding: 4,
    gap: 4
  },
  segmentedOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: "center"
  },
  segmentedOptionActive: {
    backgroundColor: "#FEFEFA",
    shadowColor: "#78786C",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1
  },
  segmentedText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#78786C"
  },
  segmentedTextActive: {
    color: "#2C2C24"
  },

  dateButton: {
    backgroundColor: "#FFFFFFCC",
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DED8CF"
  },
  dateText: {
    fontSize: 16,
    color: "#2C2C24",
    fontWeight: "500"
  },
  datePlaceholder: {
    fontSize: 16,
    color: "#A29F94"
  },
  dateChevron: {
    fontSize: 22,
    color: "#78786C",
    fontWeight: "600"
  },

  promptInput: {
    backgroundColor: "#FFFFFFCC",
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 15,
    color: "#2C2C24",
    minHeight: 110,
    lineHeight: 22,
    borderWidth: 1,
    borderColor: "#DED8CF"
  },

  saveButton: {
    backgroundColor: "#5D7052",
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#5D7052",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  saveButtonDisabled: {
    opacity: 0.6
  },
  saveButtonPressed: {
    backgroundColor: "#4F6146",
    transform: [{ scale: 0.98 }]
  },
  saveLabel: {
    color: "#FEFEFA",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.3
  },

  signOutButton: {
    backgroundColor: "#F6E4DF",
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D9A79D"
  },
  signOutButtonPressed: {
    backgroundColor: "#F2D7D0"
  },
  signOutLabel: {
    color: "#A85448",
    fontWeight: "700",
    fontSize: 15
  },

  footer: {
    height: 20
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(44, 44, 36, 0.28)",
    justifyContent: "flex-end"
  },
  modalCard: {
    backgroundColor: "#FEFEFA",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#DED8CF"
  },
  spinnerContainer: {
    paddingHorizontal: 16
  },
  modalCancel: {
    fontSize: 16,
    color: "#78786C",
    fontWeight: "600"
  },
  modalTitle: {
    fontSize: 16,
    color: "#2C2C24",
    fontWeight: "700"
  },
  modalDone: {
    fontSize: 16,
    color: "#5D7052",
    fontWeight: "700"
  }
});
