import { Text, TouchableOpacity, View } from "react-native";

type RecordTemplateActionsSectionProps = {
  styles: any;
  canSaveTemplate: boolean;
  canLoadTemplate: boolean;
  openTemplateSaveModal: () => void;
  openTemplateLoadModal: () => void;
};

export function RecordTemplateActionsSection({
  styles,
  canSaveTemplate,
  canLoadTemplate,
  openTemplateSaveModal,
  openTemplateLoadModal
}: RecordTemplateActionsSectionProps) {
  return (
    <View style={styles.templateActionStack}>
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
  );
}
