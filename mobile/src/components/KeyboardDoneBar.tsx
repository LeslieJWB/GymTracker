import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { palette, typography } from "../styles/theme";

export const KEYBOARD_ACCESSORY_ID = "keyboard-done-bar";

export function KeyboardDoneBar() {
  if (Platform.OS !== "ios") return null;

  return (
    <InputAccessoryView nativeID={KEYBOARD_ACCESSORY_ID}>
      <View style={styles.bar}>
        <View style={styles.spacer} />
        <Pressable
          onPress={() => Keyboard.dismiss()}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: palette.muted,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  spacer: {
    flex: 1
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8
  },
  buttonPressed: {
    opacity: 0.6
  },
  buttonText: {
    fontFamily: typography.bodySemiBold,
    fontSize: 16,
    color: palette.primary
  }
});
