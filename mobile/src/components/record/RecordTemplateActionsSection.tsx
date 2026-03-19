import { Text, TouchableOpacity, View } from "react-native";
import type { User } from "../../types/workout";

type RecordTemplateActionsSectionProps = {
  styles: any;
  loading: boolean;
  user: User | null;
  canSaveTemplate: boolean;
  canLoadTemplate: boolean;
  openExerciseSearchModal: () => void;
  openTemplateSaveModal: () => void;
  openTemplateLoadModal: () => void;
};

export function RecordTemplateActionsSection({
  styles,
  loading,
  user,
  canSaveTemplate,
  canLoadTemplate,
  openExerciseSearchModal,
  openTemplateSaveModal,
  openTemplateLoadModal
}: RecordTemplateActionsSectionProps) {
  return (
    <View style={styles.templateActionStack}>
      <View style={styles.templateActionCard}>
        <TouchableOpacity
          style={[styles.openAddModalButton, loading || !user ? styles.primaryActionButtonDisabled : null]}
          onPress={openExerciseSearchModal}
          disabled={loading || !user}
        >
          <Text style={styles.openAddModalButtonText}>+ Add Exercise</Text>
        </TouchableOpacity>
        <View style={styles.templateSecondaryActionRow}>
          <TouchableOpacity
            style={[styles.secondaryActionButton, !canSaveTemplate ? styles.secondaryActionButtonDisabled : null]}
            onPress={openTemplateSaveModal}
            disabled={!canSaveTemplate}
          >
            <Text style={[styles.secondaryActionButtonText, !canSaveTemplate ? styles.secondaryActionButtonTextDisabled : null]}>
              Save Template
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tertiaryActionButton, !canLoadTemplate ? styles.secondaryActionButtonDisabled : null]}
            onPress={openTemplateLoadModal}
            disabled={!canLoadTemplate}
          >
            <Text style={[styles.tertiaryActionButtonText, !canLoadTemplate ? styles.secondaryActionButtonTextDisabled : null]}>
              Load Template
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
