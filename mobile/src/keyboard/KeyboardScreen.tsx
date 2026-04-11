import type { ReactNode } from "react";
import { Platform, type StyleProp, type ViewStyle } from "react-native";
import {
  KeyboardAvoidingView,
  type KeyboardAvoidingViewProps
} from "react-native-keyboard-controller";

type KeyboardScreenProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
  behavior?: KeyboardAvoidingViewProps["behavior"];
};

export function KeyboardScreen({
  children,
  style,
  keyboardVerticalOffset = 0,
  behavior = Platform.OS === "ios" ? "padding" : undefined
}: KeyboardScreenProps) {
  return (
    <KeyboardAvoidingView style={style} behavior={behavior} keyboardVerticalOffset={keyboardVerticalOffset}>
      {children}
    </KeyboardAvoidingView>
  );
}
