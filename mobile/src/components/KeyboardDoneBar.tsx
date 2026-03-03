import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text
} from "react-native";
import { palette, typography } from "../styles/theme";

export const DONE_BAR_ID = "gym-tracker-done-bar";

export function KeyboardDoneBar() {
  if (Platform.OS !== "ios") return null;

  return (
    <InputAccessoryView nativeID={DONE_BAR_ID}>
      <Pressable
        onPress={() => Keyboard.dismiss()}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        hitSlop={8}
      >
        <Text style={styles.buttonText}>Done</Text>
      </Pressable>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  buttonPressed: {
    opacity: 0.5
  },
  buttonText: {
    fontFamily: typography.bodySemiBold,
    fontSize: 17,
    color: palette.primary
  }
});
