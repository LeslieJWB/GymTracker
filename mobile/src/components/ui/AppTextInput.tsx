import { forwardRef } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { palette, radius, textStyles } from "../../styles/theme";

export const AppTextInput = forwardRef<TextInput, TextInputProps>(function AppTextInput(props, ref) {
  const { style, placeholderTextColor = palette.mutedForeground, ...rest } = props;
  return (
    <TextInput
      ref={ref}
      style={[styles.input, style]}
      placeholderTextColor={placeholderTextColor}
      selectionColor={palette.primary}
      {...rest}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFFCC",
    paddingHorizontal: 16,
    color: palette.foreground,
    fontFamily: textStyles.body.fontFamily,
    fontSize: 15
  }
});
