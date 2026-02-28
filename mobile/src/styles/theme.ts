import { Platform, TextStyle, ViewStyle } from "react-native";

export const palette = {
  background: "#FDFCF8",
  surface: "#FEFEFA",
  foreground: "#2C2C24",
  primary: "#5D7052",
  primaryForeground: "#F3F4F1",
  secondary: "#C18C5D",
  secondaryForeground: "#FFFFFF",
  accent: "#E6DCCD",
  accentForeground: "#4A4A40",
  muted: "#F0EBE5",
  mutedForeground: "#78786C",
  border: "#DED8CF",
  destructive: "#A85448",
  destructiveSoft: "#F6E4DF"
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  pill: 999
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24
} as const;

export const shadows = {
  soft: {
    shadowColor: "#5D7052",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  } satisfies ViewStyle,
  float: {
    shadowColor: "#C18C5D",
    shadowOpacity: 0.2,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6
  } satisfies ViewStyle
} as const;

export const typography = {
  heading: "Fraunces_700Bold",
  headingSemiBold: "Fraunces_600SemiBold",
  body: "Nunito_500Medium",
  bodySemiBold: "Nunito_600SemiBold",
  bodyBold: "Nunito_700Bold"
} as const;

export const textStyles = {
  headingLg: {
    fontFamily: typography.heading,
    fontSize: 30,
    color: palette.foreground
  } satisfies TextStyle,
  headingMd: {
    fontFamily: typography.headingSemiBold,
    fontSize: 24,
    color: palette.foreground
  } satisfies TextStyle,
  headingSemiBold: {
    fontFamily: typography.headingSemiBold,
    color: palette.foreground
  } satisfies TextStyle,
  body: {
    fontFamily: typography.body,
    color: palette.foreground
  } satisfies TextStyle,
  bodySemiBold: {
    fontFamily: typography.bodySemiBold,
    color: palette.foreground
  } satisfies TextStyle,
  bodyMuted: {
    fontFamily: typography.body,
    color: palette.mutedForeground
  } satisfies TextStyle,
  bodyBold: {
    fontFamily: typography.bodyBold,
    color: palette.foreground
  } satisfies TextStyle
} as const;

export const organicShapes = {
  blobA: {
    borderTopLeftRadius: 140,
    borderTopRightRadius: 96,
    borderBottomRightRadius: 160,
    borderBottomLeftRadius: 112
  } satisfies ViewStyle,
  blobB: {
    borderTopLeftRadius: 120,
    borderTopRightRadius: 160,
    borderBottomRightRadius: 90,
    borderBottomLeftRadius: 150
  } satisfies ViewStyle
} as const;

export function withPressScale(pressed: boolean): ViewStyle {
  return {
    transform: [{ scale: pressed ? 0.98 : 1 }],
    opacity: Platform.OS === "ios" && pressed ? 0.95 : 1
  };
}
