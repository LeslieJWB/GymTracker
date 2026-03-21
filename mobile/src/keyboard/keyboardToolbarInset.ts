import { Platform } from "react-native";

/** Matches `KEYBOARD_TOOLBAR_HEIGHT` in react-native-keyboard-controller's KeyboardToolbar. */
const KEYBOARD_TOOLBAR_HEIGHT = 42;

/** Extra bottom inset so focused fields clear the iOS keyboard accessory (Prev/Next/Done). */
export function keyboardToolbarBottomInset(): number {
  return Platform.OS === "ios" ? KEYBOARD_TOOLBAR_HEIGHT : 0;
}
