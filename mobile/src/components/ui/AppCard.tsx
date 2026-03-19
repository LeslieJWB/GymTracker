import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { palette, radius, shadows } from "../../styles/theme";

type AppCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AppCard({ children, style }: AppCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: `${palette.border}80`,
    padding: 16,
    ...shadows.soft
  }
});
