import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { KeyboardScreen } from "../keyboard/KeyboardScreen";
import { AppButton } from "./ui/AppButton";
import { AppCard } from "./ui/AppCard";
import { AppTextInput } from "./ui/AppTextInput";
import { palette, radius, shadows, textStyles, withPressScale } from "../styles/theme";

type AuthScreenProps = {
  loading: boolean;
  error: string | null;
  message: string | null;
  canResendConfirmation: boolean;
  onGoogle: () => void;
  onApple: () => void;
  onEmailSignIn: (email: string, password: string) => Promise<boolean>;
  onEmailSignUp: (email: string, password: string) => Promise<boolean>;
  onForgotPassword: (email: string) => Promise<boolean>;
  onResendConfirmation: () => Promise<boolean>;
};

type Mode = "signIn" | "signUp";

const MIN_PASSWORD_LENGTH = 8;

function isLikelyEmail(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(email);
}

export function AuthScreen({
  loading,
  error,
  message,
  canResendConfirmation,
  onGoogle,
  onApple,
  onEmailSignIn,
  onEmailSignUp,
  onForgotPassword,
  onResendConfirmation
}: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const actionLabel = useMemo(() => (mode === "signIn" ? "Sign in with Email" : "Sign up with Email"), [mode]);
  const subtitle = useMemo(
    () =>
      mode === "signIn"
        ? "Sign in to sync your workouts and profile across devices."
        : "Create an account to start syncing workouts and profile across devices.",
    [mode]
  );

  const handleEmailAuth = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setLocalError("Enter both email and password.");
      return;
    }
    if (!isLikelyEmail(normalizedEmail)) {
      setLocalError("Enter a valid email address.");
      return;
    }
    if (mode === "signUp" && password.length < MIN_PASSWORD_LENGTH) {
      setLocalError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setLocalError(null);
    if (mode === "signIn") {
      await onEmailSignIn(normalizedEmail, password);
      return;
    }
    await onEmailSignUp(normalizedEmail, password);
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setLocalError("Enter your email first to reset password.");
      return;
    }
    if (!isLikelyEmail(normalizedEmail)) {
      setLocalError("Enter a valid email address.");
      return;
    }
    setLocalError(null);
    await onForgotPassword(normalizedEmail);
  };

  return (
    <KeyboardScreen style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View pointerEvents="none" style={styles.blob} />
        <AppCard style={styles.authCard}>
          <Text style={styles.title}>Welcome to IntelliFit</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.modeRow}>
            <Pressable
              style={({ pressed }) => [
                styles.modeButton,
                mode === "signIn" ? styles.modeButtonActive : null,
                withPressScale(pressed)
              ]}
              onPress={() => {
                setMode("signIn");
                setLocalError(null);
              }}
              disabled={loading}
            >
              <Text style={[styles.modeLabel, mode === "signIn" ? styles.modeLabelActive : null]}>Sign in</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.modeButton,
                mode === "signUp" ? styles.modeButtonActive : null,
                withPressScale(pressed)
              ]}
              onPress={() => {
                setMode("signUp");
                setLocalError(null);
              }}
              disabled={loading}
            >
              <Text style={[styles.modeLabel, mode === "signUp" ? styles.modeLabelActive : null]}>Sign up</Text>
            </Pressable>
          </View>

        <AppTextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          placeholder="Email"
          placeholderTextColor={palette.mutedForeground}
          value={email}
          onChangeText={setEmail}
          editable={!loading}
        />
        <AppTextInput
          secureTextEntry
          textContentType={mode === "signIn" ? "password" : "newPassword"}
          autoComplete={mode === "signIn" ? "current-password" : "new-password"}
          placeholder="Password"
          placeholderTextColor={palette.mutedForeground}
          value={password}
          onChangeText={setPassword}
          editable={!loading}
        />
        {mode === "signIn" ? (
          <Pressable
            style={({ pressed }) => [styles.forgotPasswordButton, withPressScale(pressed)]}
            onPress={() => {
              handleForgotPassword().catch(() => {});
            }}
            disabled={loading}
          >
            <Text style={styles.forgotPasswordLabel}>Forgot password?</Text>
          </Pressable>
        ) : null}
        <AppButton onPress={handleEmailAuth} disabled={loading}>
          {actionLabel}
        </AppButton>

        <Text style={styles.orLabel}>or continue with</Text>

        <AppButton variant="outline" onPress={onGoogle} disabled={loading}>
          Continue with Google
        </AppButton>
        <AppButton variant="secondary" onPress={onApple} disabled={loading}>
          Continue with Apple
        </AppButton>
        {loading ? <ActivityIndicator size="small" color={palette.primary} style={styles.loader} /> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {canResendConfirmation ? (
          <Pressable
            style={({ pressed }) => [styles.resendButton, withPressScale(pressed)]}
            onPress={() => {
              onResendConfirmation().catch(() => {});
            }}
            disabled={loading}
          >
            <Text style={styles.resendButtonLabel}>Resend confirmation email</Text>
          </Pressable>
        ) : null}
        {localError ? <Text style={styles.error}>{localError}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        </AppCard>
      </ScrollView>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
    gap: 12,
    backgroundColor: "transparent"
  },
  authCard: {
    gap: 12
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
  modeRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFFB8",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: `${palette.border}CC`,
    padding: 4,
    marginBottom: 4
  },
  modeButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  modeButtonActive: {
    backgroundColor: palette.primary
  },
  modeLabel: {
    color: palette.mutedForeground,
    fontFamily: textStyles.bodyBold.fontFamily,
    fontSize: 14
  },
  modeLabelActive: {
    color: palette.primaryForeground
  },
  forgotPasswordButton: {
    alignSelf: "flex-end",
    minHeight: 30,
    justifyContent: "center",
    paddingHorizontal: 4
  },
  forgotPasswordLabel: {
    color: palette.secondary,
    fontFamily: textStyles.bodyBold.fontFamily,
    fontSize: 13,
    textDecorationLine: "underline"
  },
  orLabel: {
    textAlign: "center",
    color: palette.mutedForeground,
    fontFamily: textStyles.body.fontFamily,
    fontSize: 13,
    marginTop: 2
  },
  loader: {
    marginTop: 6
  },
  error: {
    marginTop: 6,
    color: palette.destructive,
    fontSize: 13,
    fontFamily: textStyles.body.fontFamily
  },
  message: {
    marginTop: 6,
    color: palette.primary,
    fontSize: 13,
    fontFamily: textStyles.body.fontFamily
  },
  resendButton: {
    alignSelf: "center",
    marginTop: 4,
    minHeight: 36,
    paddingHorizontal: 12,
    justifyContent: "center"
  },
  resendButtonLabel: {
    color: palette.secondary,
    fontFamily: textStyles.bodyBold.fontFamily,
    fontSize: 13,
    textDecorationLine: "underline"
  }
});

