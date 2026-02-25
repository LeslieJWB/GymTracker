import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

type AuthScreenProps = {
  loading: boolean;
  error: string | null;
  onGoogle: () => void;
  onApple: () => void;
};

export function AuthScreen({ loading, error, onGoogle, onApple }: AuthScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to GymTracker</Text>
      <Text style={styles.subtitle}>Sign in to sync your workouts and profile across devices.</Text>
      <Pressable style={styles.primaryButton} onPress={onGoogle} disabled={loading}>
        <Text style={styles.primaryButtonLabel}>Continue with Google</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={onApple} disabled={loading}>
        <Text style={styles.secondaryButtonLabel}>Continue with Apple</Text>
      </Pressable>
      {loading ? <ActivityIndicator size="small" color="#2563EB" style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
    gap: 12
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A"
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: "#475569",
    marginBottom: 8
  },
  primaryButton: {
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center"
  },
  primaryButtonLabel: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF"
  },
  secondaryButtonLabel: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: 15
  },
  loader: {
    marginTop: 6
  },
  error: {
    marginTop: 6,
    color: "#DC2626",
    fontSize: 13
  }
});

