import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { keyboardToolbarBottomInset } from "../keyboard/keyboardToolbarInset";
import { bottomNavScrollInset } from "../layout/bottomNavInset";
import { AppButton } from "./ui/AppButton";
import { AppCard } from "./ui/AppCard";
import { AppTextInput } from "./ui/AppTextInput";
import { LegalLinksRow } from "./ui/LegalLinksRow";
import { ModalShell } from "./ui/ModalShell";
import { radius, textStyles } from "../styles/theme";
import type { UserProfile } from "../types/workout";
import { parseDateValue, toDateString } from "../utils/dateInput";
import { digitsOnly, sanitizeBodyFatInput, sanitizeWeightInput } from "../utils/inputSanitizers";

type ProfileInput = {
  heightCm: string;
  gender: string;
  defaultBodyWeightKg: string;
  defaultBodyFatPercentage: string;
  dailyCalorieTargetKcal: string;
  dailyProteinTargetG: string;
  dateOfBirth: string;
  globalLlmPrompt: string;
};

export type LlmQuotaStatus = {
  tier: "free" | "subscriber" | "unlimited";
  limit: number | null;
  used: number;
};

export function isFreeTierQuotaExhausted(quota: LlmQuotaStatus | null): boolean {
  return quota?.tier === "free" && quota.limit !== null && quota.used >= quota.limit;
}

/** Pro status for UI and quota — backend tier is authoritative (what AI limits enforce). */
export function hasProQuota(quota: LlmQuotaStatus | null): boolean {
  return quota?.tier === "subscriber" || quota?.tier === "unlimited";
}

/** RevenueCat/Apple may still show active while backend tier is free (expired, sync lag, etc.). */
export function hasSubscriptionMismatch(
  quota: LlmQuotaStatus | null,
  subscriptionActive: boolean | null
): boolean {
  return subscriptionActive === true && !hasProQuota(quota);
}

type ProfileScreenProps = {
  profile: UserProfile | null;
  saving: boolean;
  llmQuota: LlmQuotaStatus | null;
  llmQuotaLoading: boolean;
  llmQuotaError: string | null;
  subscriptionAvailable: boolean;
  subscriptionActive: boolean | null;
  onOpenSubscription: () => void;
  onRestoreSubscription: () => void;
  onSave: (payload: {
    heightCm: number | null;
    gender: string | null;
    defaultBodyWeightKg: number | null;
    defaultBodyFatPercentage: number | null;
    dailyCalorieTargetKcal: number | null;
    dailyProteinTargetG: number | null;
    dateOfBirth: string | null;
    globalLlmPrompt: string | null;
  }) => Promise<void>;
  onSignOut: () => void;
  onDeleteAccount: () => Promise<void>;
  deletingAccount: boolean;
};

function toInput(profile: UserProfile | null): ProfileInput {
  return {
    heightCm: profile?.heightCm != null ? String(profile.heightCm) : "",
    gender: profile?.gender ?? "",
    defaultBodyWeightKg: profile?.defaultBodyWeightKg != null ? String(profile.defaultBodyWeightKg) : "",
    defaultBodyFatPercentage: profile?.defaultBodyFatPercentage != null ? String(profile.defaultBodyFatPercentage) : "",
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

function formatQuotaSummary(quota: LlmQuotaStatus | null, error: string | null): string {
  if (error) {
    return error;
  }
  if (!quota) {
    return "—";
  }
  if (quota.tier === "unlimited") {
    return "Unlimited AI coaching";
  }
  if (quota.limit === null) {
    return `${quota.used} AI calls used today`;
  }
  return `${quota.used} of ${quota.limit} AI calls used today`;
}

function formatPlanLabel(quota: LlmQuotaStatus | null): string {
  if (quota?.tier === "unlimited") {
    return "Unlimited";
  }
  if (hasProQuota(quota)) {
    return "Pro subscriber";
  }
  return "Free plan";
}

export function ProfileScreen({
  profile,
  saving,
  llmQuota,
  llmQuotaLoading,
  llmQuotaError,
  subscriptionAvailable,
  subscriptionActive,
  onOpenSubscription,
  onRestoreSubscription,
  onSave,
  onSignOut,
  onDeleteAccount,
  deletingAccount
}: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const navScrollInset = bottomNavScrollInset(insets);
  const [draft, setDraft] = useState<ProfileInput>(() => toInput(profile));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [pendingDate, setPendingDate] = useState<Date>(() => parseDateValue(profile?.dateOfBirth ?? "") ?? new Date());

  useEffect(() => {
    setDraft(toInput(profile));
  }, [
    profile?.id,
    profile?.heightCm,
    profile?.gender,
    profile?.defaultBodyWeightKg,
    profile?.defaultBodyFatPercentage,
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
        setDraft((current) => ({ ...current, dateOfBirth: toDateString(selectedDate) }));
      }
      return;
    }

    if (selectedDate) {
      setPendingDate(selectedDate);
    }
  };

  const avatarColor = getAvatarColor(profile);
  const deleteConfirmed = deleteConfirmText.trim().toLowerCase() === "delete";

  const closeDeleteModal = () => {
    if (deletingAccount) {
      return;
    }
    setShowDeleteModal(false);
    setDeleteConfirmText("");
  };

  const handleDeleteAccount = () => {
    onDeleteAccount()
      .then(() => {
        setShowDeleteModal(false);
        setDeleteConfirmText("");
      })
      .catch(() => {});
  };

  return (
    <KeyboardAwareScrollView
      style={styles.screen}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: navScrollInset }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      bottomOffset={navScrollInset + keyboardToolbarBottomInset()}
      extraKeyboardSpace={keyboardToolbarBottomInset()}
    >
      {/* Avatar Hero */}
      <View style={styles.heroSection}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{getInitials(profile)}</Text>
        </View>
        <Text style={styles.heroName}>{getDisplayName(profile)}</Text>
        <Text style={styles.heroEmail}>{profile?.email ?? ""}</Text>
      </View>

      {/* Account Info */}
      <AppCard style={styles.card}>
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
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Pressable
            onPress={() => setShowDeleteModal(true)}
            hitSlop={8}
            disabled={deletingAccount}
          >
            <Text style={styles.deleteAccountLinkText}>Delete account</Text>
          </Pressable>
        </View>
      </AppCard>

      {/* Body Metrics */}
      <AppCard style={styles.card}>
        <Text style={styles.cardHeader}>Body Metrics</Text>
        <Text style={styles.cardSubheader}>Used for workout calculations and tracking</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Height</Text>
          <View style={styles.unitRow}>
            <AppTextInput
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
            <AppTextInput
              style={styles.fieldInput}
              value={draft.defaultBodyWeightKg}
              onChangeText={(value) => setDraft((current) => ({ ...current, defaultBodyWeightKg: sanitizeWeightInput(value) }))}
              placeholder="0"
              placeholderTextColor="#A29F94"
              keyboardType="decimal-pad"

            />
            <View style={styles.unitBadge}>
              <Text style={styles.unitBadgeText}>kg</Text>
            </View>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Body Fat %</Text>
          <View style={styles.unitRow}>
            <AppTextInput
              style={styles.fieldInput}
              value={draft.defaultBodyFatPercentage}
              onChangeText={(value) => setDraft((current) => ({ ...current, defaultBodyFatPercentage: sanitizeBodyFatInput(value) }))}
              placeholder="0"
              placeholderTextColor="#A29F94"
              keyboardType="decimal-pad"

            />
            <View style={styles.unitBadge}>
              <Text style={styles.unitBadgeText}>%</Text>
            </View>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Daily Calorie Target (optional)</Text>
          <View style={styles.unitRow}>
            <AppTextInput
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
            <AppTextInput
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
      </AppCard>

      {/* Subscription & AI quota */}
      <AppCard style={styles.card}>
        <Text style={styles.cardHeader}>AI Coaching Plan</Text>
        <Text style={styles.cardSubheader}>
          Food analysis, workout plans, summaries, and feedback all count toward your daily AI quota.
        </Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Plan</Text>
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>{formatPlanLabel(llmQuota)}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Today</Text>
          {llmQuotaLoading ? (
            <ActivityIndicator color="#5D7052" />
          ) : (
            <Text style={[styles.infoValue, llmQuotaError ? styles.infoValueError : null]}>
              {formatQuotaSummary(llmQuota, llmQuotaError)}
            </Text>
          )}
        </View>
        {subscriptionAvailable ? (
          <>
            <View style={styles.subscriptionSpacer} />
            {subscriptionActive === null && llmQuotaLoading ? (
              <ActivityIndicator color="#5D7052" />
            ) : hasProQuota(llmQuota) ? (
              <Text style={styles.subscriptionFootnote}>
                Your subscription is active. Manage or cancel it anytime in the App Store.
              </Text>
            ) : hasSubscriptionMismatch(llmQuota, subscriptionActive) ? (
              <>
                <Text style={styles.subscriptionFootnote}>
                  Your App Store subscription may still be active, but Pro AI quota is not enabled on this
                  account yet. Try restoring purchases to sync.
                </Text>
                <Pressable style={styles.restoreLink} onPress={onRestoreSubscription} hitSlop={8}>
                  <Text style={styles.restoreLinkText}>Restore purchases</Text>
                </Pressable>
              </>
            ) : (
              <>
                <AppButton onPress={onOpenSubscription}>View subscription plans</AppButton>
                <Pressable style={styles.restoreLink} onPress={onRestoreSubscription} hitSlop={8}>
                  <Text style={styles.restoreLinkText}>Restore purchases</Text>
                </Pressable>
              </>
            )}
          </>
        ) : (
          <Text style={styles.subscriptionFootnote}>
            {Platform.OS === "ios"
              ? "Subscriptions are not configured in this build yet."
              : "Subscriptions are available on iOS. Sign in on an iPhone to upgrade."}
          </Text>
        )}
        <LegalLinksRow />
      </AppCard>

      {/* LLM Prompt */}
      <AppCard style={styles.card}>
        <Text style={styles.cardHeader}>AI Coaching Style</Text>
        <Text style={styles.cardSubheader}>Customize how the AI assistant interacts with you</Text>
        <AppTextInput
          style={styles.promptInput}
          value={draft.globalLlmPrompt}
          onChangeText={(value) => setDraft((current) => ({ ...current, globalLlmPrompt: value }))}
          placeholder="e.g. Focus on hypertrophy, keep rest times short..."
          placeholderTextColor="#A29F94"
          multiline
          textAlignVertical="top"
        />
      </AppCard>

      {/* Save */}
      <AppButton
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        disabled={saving}
        onPress={() =>
          onSave({
            heightCm: draft.heightCm.trim() ? Number(draft.heightCm) : null,
            gender: draft.gender.trim() || null,
            defaultBodyWeightKg: draft.defaultBodyWeightKg.trim() ? Number(draft.defaultBodyWeightKg) : null,
            defaultBodyFatPercentage: draft.defaultBodyFatPercentage.trim() ? Number(draft.defaultBodyFatPercentage) : null,
            dailyCalorieTargetKcal: draft.dailyCalorieTargetKcal.trim() ? Number(draft.dailyCalorieTargetKcal) : null,
            dailyProteinTargetG: draft.dailyProteinTargetG.trim() ? Number(draft.dailyProteinTargetG) : null,
            dateOfBirth: draft.dateOfBirth.trim() || null,
            globalLlmPrompt: draft.globalLlmPrompt.trim() || null
          }).catch(() => {})
        }
      >
        {saving ? "Saving..." : "Save Changes"}
      </AppButton>

      {/* Sign Out */}
      <AppButton style={styles.signOutButton} textStyle={styles.signOutLabel} variant="danger" onPress={onSignOut}>
        Sign Out
      </AppButton>

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
        <ModalShell visible={showDatePicker} animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
          <View style={styles.modalHeader}>
            <Pressable hitSlop={12} onPress={() => setShowDatePicker(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Date of Birth</Text>
            <Pressable
              hitSlop={12}
              onPress={() => {
                setDraft((current) => ({ ...current, dateOfBirth: toDateString(pendingDate) }));
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
        </ModalShell>
      ) : null}
      <ModalShell visible={showDeleteModal} animationType="slide" onRequestClose={closeDeleteModal}>
        <View style={styles.modalHeader}>
          <Pressable hitSlop={12} onPress={closeDeleteModal} disabled={deletingAccount}>
            <Text style={[styles.modalCancel, deletingAccount && styles.modalActionDisabled]}>Cancel</Text>
          </Pressable>
          <Text style={styles.modalTitle}>Delete Account</Text>
          <View style={styles.modalHeaderSpacer} />
        </View>
        <View style={styles.deleteModalBody}>
          <Text style={styles.deleteModalWarning}>
            This permanently removes your account, workouts, exercises, nutrition logs, body metrics, templates, and AI
            history. You will not be able to sign in again.
          </Text>
          <Text style={styles.deleteModalPrompt}>Type delete to confirm:</Text>
          <AppTextInput
            style={styles.deleteConfirmInput}
            value={deleteConfirmText}
            onChangeText={setDeleteConfirmText}
            placeholder="delete"
            placeholderTextColor="#A29F94"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!deletingAccount}
          />
          <AppButton
            style={styles.deleteConfirmButton}
            textStyle={styles.signOutLabel}
            variant="danger"
            disabled={!deleteConfirmed || deletingAccount}
            onPress={handleDeleteAccount}
          >
            {deletingAccount ? "Deleting..." : "Delete permanently"}
          </AppButton>
        </View>
      </ModalShell>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FDFCF8"
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 32
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
  infoValueError: {
    color: "#A85448",
    fontWeight: "500",
    fontSize: 13
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
  planBadge: {
    backgroundColor: "#5D7052",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8
  },
  planBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F3F4F1"
  },
  subscriptionSpacer: {
    height: 12
  },
  subscriptionFootnote: {
    fontSize: 13,
    color: "#78786C",
    lineHeight: 20
  },
  restoreLink: {
    alignSelf: "center",
    marginTop: 12,
    paddingVertical: 4
  },
  restoreLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#5D7052"
  },
  deleteAccountLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#A85448"
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
  signOutButton: {
    backgroundColor: "#A85448",
    borderColor: "#A85448"
  },
  signOutLabel: {
    color: "#FFFFFF",
    fontFamily: textStyles.bodyBold.fontFamily,
    fontSize: 15
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
  },
  modalHeaderSpacer: {
    width: 52
  },
  modalActionDisabled: {
    opacity: 0.4
  },
  deleteModalBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32
  },
  deleteModalWarning: {
    fontSize: 15,
    color: "#2C2C24",
    lineHeight: 22,
    marginBottom: 20
  },
  deleteModalPrompt: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 8
  },
  deleteConfirmInput: {
    backgroundColor: "#FFFFFFCC",
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#2C2C24",
    borderWidth: 1,
    borderColor: "#DED8CF",
    marginBottom: 16
  },
  deleteConfirmButton: {
    backgroundColor: "#A85448",
    borderColor: "#A85448"
  }
});
