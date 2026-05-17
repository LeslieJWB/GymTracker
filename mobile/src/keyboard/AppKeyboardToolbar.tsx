import { Platform } from "react-native";
import { KeyboardToolbar } from "react-native-keyboard-controller";

type AppKeyboardToolbarProps = {
  enabled: boolean;
};

export function AppKeyboardToolbar({ enabled }: AppKeyboardToolbarProps) {
  if (Platform.OS !== "ios") {
    return null;
  }
  return <KeyboardToolbar enabled={enabled} />;
}
