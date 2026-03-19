import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  type ModalProps,
  type StyleProp,
  type ViewStyle
} from "react-native";

type KeyboardModalSheetProps = {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  backdropStyle?: StyleProp<ViewStyle>;
  animationType?: ModalProps["animationType"];
  keyboardVerticalOffset?: number;
  useKeyboardAvoiding?: boolean;
};

export function KeyboardModalSheet({
  visible,
  onRequestClose,
  children,
  contentStyle,
  backdropStyle,
  animationType = "fade",
  keyboardVerticalOffset = 16,
  useKeyboardAvoiding = true
}: KeyboardModalSheetProps) {
  const content = (
    <>
      <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} />
      <Pressable style={contentStyle} onPress={() => {}}>
        {children}
      </Pressable>
    </>
  );

  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onRequestClose}>
      <Pressable style={[styles.backdrop, backdropStyle]} onPress={onRequestClose}>
        {useKeyboardAvoiding ? (
          <KeyboardAvoidingView
            style={styles.keyboardAvoiding}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={keyboardVerticalOffset}
          >
            {content}
          </KeyboardAvoidingView>
        ) : (
          content
        )}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(44, 44, 36, 0.28)"
  },
  keyboardAvoiding: {
    flex: 1,
    justifyContent: "flex-end"
  }
});
