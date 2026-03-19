import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { palette, radius, shadows, textStyles, withPressScale } from "../../styles/theme";

type AppButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

type AppButtonProps = {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  variant?: AppButtonVariant;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  leftAdornment?: ReactNode;
};

export function AppButton({
  children,
  onPress,
  disabled = false,
  variant = "primary",
  style,
  textStyle,
  leftAdornment
}: AppButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        variantStyles.container[variant],
        disabled ? styles.disabled : null,
        withPressScale(pressed),
        style
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.content}>
        {leftAdornment}
        <Text style={[styles.text, variantStyles.text[variant], textStyle]}>{children}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center"
  },
  content: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  text: {
    fontSize: 15,
    fontFamily: textStyles.bodyBold.fontFamily
  },
  disabled: {
    opacity: 0.55
  }
});

const variantStyles = {
  container: StyleSheet.create<Record<AppButtonVariant, ViewStyle>>({
    primary: {
      backgroundColor: palette.primary,
      ...shadows.soft
    },
    secondary: {
      backgroundColor: palette.secondary
    },
    outline: {
      borderWidth: 2,
      borderColor: palette.secondary,
      backgroundColor: "transparent"
    },
    ghost: {
      backgroundColor: "transparent"
    },
    danger: {
      backgroundColor: palette.destructive
    }
  }),
  text: StyleSheet.create<Record<AppButtonVariant, TextStyle>>({
    primary: { color: palette.primaryForeground },
    secondary: { color: palette.secondaryForeground },
    outline: { color: palette.secondary },
    ghost: { color: palette.primary },
    danger: { color: "#FFFFFF" }
  })
} as const;
