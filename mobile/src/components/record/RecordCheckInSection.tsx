import { Text, TextInput, View } from "react-native";
import type { User } from "../../types/workout";
import { sanitizeBodyFatInput, sanitizeWeightInput } from "../../utils/inputSanitizers";

type RecordCheckInSectionProps = {
  styles: any;
  loading: boolean;
  user: User | null;
  savingRecordTheme: boolean;
  recordThemeDraft: string;
  setRecordThemeDraft: (value: string) => void;
  themeDirty: boolean;
  saveRecordTheme: () => void;
  savingBodyWeight: boolean;
  bodyWeightDraft: string;
  setBodyWeightDraft: (value: string) => void;
  bodyWeightDirty: boolean;
  hasBodyWeightDraft: boolean;
  isBodyWeightDraftValid: boolean;
  savedBodyWeightKg: number | null;
  bodyFatDraft: string;
  setBodyFatDraft: (value: string) => void;
  bodyFatDirty: boolean;
  isBodyFatDraftValid: boolean;
  saveBodyWeight: () => void;
};

export function RecordCheckInSection({
  styles,
  loading,
  user,
  savingRecordTheme,
  recordThemeDraft,
  setRecordThemeDraft,
  themeDirty,
  saveRecordTheme,
  savingBodyWeight,
  bodyWeightDraft,
  setBodyWeightDraft,
  bodyWeightDirty,
  hasBodyWeightDraft,
  isBodyWeightDraftValid,
  savedBodyWeightKg,
  bodyFatDraft,
  setBodyFatDraft,
  bodyFatDirty,
  isBodyFatDraftValid,
  saveBodyWeight
}: RecordCheckInSectionProps) {
  const checkInSaving = savingRecordTheme || savingBodyWeight;
  const checkInDirty = themeDirty || bodyWeightDirty || bodyFatDirty;
  return (
    <View style={styles.checkInCard}>
      <View style={styles.checkInHeaderRow}>
        <Text style={styles.checkInTitle}>Daily Check-in</Text>
        <View
          style={[
            styles.themeStatusBadge,
            checkInSaving ? styles.themeStatusSavingBadge : checkInDirty ? styles.themeStatusUnsavedBadge : styles.themeStatusSavedBadge
          ]}
        >
          <Text style={styles.themeStatusBadgeText}>{checkInSaving ? "Saving..." : checkInDirty ? "Unsaved" : "Saved"}</Text>
        </View>
      </View>
      <View style={styles.checkInField}>
        <Text style={styles.checkInFieldLabel}>Day Theme</Text>
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
            placeholder="0.0"
            placeholderTextColor="#78786C"
            editable={Boolean(user) && !loading && !savingBodyWeight}
            onBlur={() => {
              if (!savingBodyWeight && !loading && user) {
                const weightCleared = !hasBodyWeightDraft && savedBodyWeightKg !== null;
                if ((bodyWeightDirty && isBodyWeightDraftValid) || weightCleared) {
                  saveBodyWeight();
                }
              }
            }}
          />
          <View style={styles.weightUnitPill}>
            <Text style={styles.weightUnitText}>kg</Text>
          </View>
        </View>
      </View>
      <View style={styles.checkInField}>
        <Text style={styles.checkInFieldLabel}>Body Fat %</Text>
        <View style={styles.weightInputRow}>
          <TextInput
            style={styles.weightInput}
            value={bodyFatDraft}
            onChangeText={(value) => setBodyFatDraft(sanitizeBodyFatInput(value))}
            keyboardType="decimal-pad"
            placeholder="0.0"
            placeholderTextColor="#78786C"
            editable={Boolean(user) && !loading && !savingBodyWeight}
            onBlur={() => {
              if (
                bodyFatDirty &&
                isBodyFatDraftValid &&
                hasBodyWeightDraft &&
                isBodyWeightDraftValid &&
                !savingBodyWeight &&
                !loading &&
                user
              ) {
                saveBodyWeight();
              }
            }}
          />
          <View style={styles.weightUnitPill}>
            <Text style={styles.weightUnitText}>%</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
