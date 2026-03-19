import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, type KeyboardAvoidingViewProps, type StyleProp, type ViewStyle } from "react-native";

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
