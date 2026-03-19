import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View, type ModalProps, type StyleProp, type ViewStyle } from "react-native";
import { palette, radius } from "../../styles/theme";

type ModalShellProps = {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
  animationType?: ModalProps["animationType"];
  cardStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  dismissOnBackdropPress?: boolean;
};

export function ModalShell({
  visible,
  onRequestClose,
  children,
  animationType = "fade",
  cardStyle,
  contentStyle,
  dismissOnBackdropPress = true
}: ModalShellProps) {
  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onRequestClose}>
      <View style={[styles.backdrop, contentStyle]}>
        {dismissOnBackdropPress ? <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} /> : null}
        <View style={[styles.card, cardStyle]}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(44, 44, 36, 0.28)"
  },
  card: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: 24
  }
});
