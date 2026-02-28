import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { palette, radius, shadows, textStyles, withPressScale } from "../styles/theme";

type AuthScreenProps = {
  loading: boolean;
  error: string | null;
  onGoogle: () => void;
  onApple: () => void;
};

export function AuthScreen({ loading, error, onGoogle, onApple }: AuthScreenProps) {
  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.blob} />
      <Text style={styles.title}>Welcome to GymTracker</Text>
      <Text style={styles.subtitle}>Sign in to sync your workouts and profile across devices.</Text>
      <Pressable style={({ pressed }) => [styles.primaryButton, withPressScale(pressed)]} onPress={onGoogle} disabled={loading}>
        <Text style={styles.primaryButtonLabel}>Continue with Google</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.secondaryButton, withPressScale(pressed)]} onPress={onApple} disabled={loading}>
        <Text style={styles.secondaryButtonLabel}>Continue with Apple</Text>
      </Pressable>
      {loading ? <ActivityIndicator size="small" color={palette.primary} style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
    gap: 12,
    backgroundColor: "transparent"
  },
  blob: {
    position: "absolute",
    width: 240,
    height: 240,
    right: -90,
    top: 70,
    borderTopLeftRadius: 140,
    borderTopRightRadius: 90,
    borderBottomLeftRadius: 110,
    borderBottomRightRadius: 160,
    backgroundColor: "#E6DCCD66"
  },
  title: {
    ...textStyles.headingLg
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: palette.mutedForeground,
    fontFamily: textStyles.body.fontFamily,
    marginBottom: 8
  },
  primaryButton: {
    backgroundColor: palette.primary,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: "center",
    ...shadows.soft
  },
  primaryButtonLabel: {
    color: palette.primaryForeground,
    fontFamily: textStyles.bodyBold.fontFamily,
    fontSize: 15
  },
  secondaryButton: {
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: palette.secondary,
    backgroundColor: "#FFFFFFD9"
  },
  secondaryButtonLabel: {
    color: palette.secondary,
    fontFamily: textStyles.bodyBold.fontFamily,
    fontSize: 15
  },
  loader: {
    marginTop: 6
  },
  error: {
    marginTop: 6,
    color: palette.destructive,
    fontSize: 13,
    fontFamily: textStyles.body.fontFamily
  }
});

