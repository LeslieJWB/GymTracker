import { useCallback, useEffect, useState } from "react";
import { AppState, Linking } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { makeRedirectUri } from "expo-auth-session";
import type { Session } from "@supabase/supabase-js";
import sessionUrlProvider from "expo-auth-session/build/SessionUrlProvider";
import { assertSupabaseConfig, supabase } from "../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

type Provider = "google" | "apple";

const PENDING_PASSWORD_RECOVERY_KEY = "gymtracker_pending_password_recovery";

async function setPendingPasswordRecovery(pending: boolean): Promise<void> {
  if (pending) {
    await SecureStore.setItemAsync(PENDING_PASSWORD_RECOVERY_KEY, "true");
    return;
  }
  await SecureStore.deleteItemAsync(PENDING_PASSWORD_RECOVERY_KEY).catch(() => {});
}

function parseAuthParamsFromUrl(url: string): URLSearchParams {
  const hashIndex = url.indexOf("#");
  if (hashIndex >= 0) {
    return new URLSearchParams(url.slice(hashIndex + 1));
  }
  const queryIndex = url.indexOf("?");
  if (queryIndex >= 0) {
    return new URLSearchParams(url.slice(queryIndex + 1));
  }
  return new URLSearchParams();
}

async function createSessionFromAuthUrl(url: string): Promise<string | null> {
  const params = parseAuthParamsFromUrl(url);
  const authError = params.get("error");
  if (authError) {
    const errorCode = params.get("error_code");
    const errorDescription = params.get("error_description");
    if (errorCode === "otp_expired") {
      return "This reset link has expired or was already used. Request a new one from Forgot password?";
    }
    return errorDescription ?? authError;
  }
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) {
    return null;
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  return error?.message ?? null;
}

function resolveAuthRedirectUri(): string {
  if (Constants.appOwnership === "expo") {
    try {
      return sessionUrlProvider.getDefaultReturnUrl();
    } catch {
      return makeRedirectUri({ scheme: "gymtracker", path: "auth/callback" });
    }
  }
  return makeRedirectUri({ scheme: "gymtracker", path: "auth/callback" });
}

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);
  const [needsPasswordUpdate, setNeedsPasswordUpdate] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([supabase.auth.getSession(), SecureStore.getItemAsync(PENDING_PASSWORD_RECOVERY_KEY)])
      .then(([{ data }, pendingRecovery]) => {
        if (mounted) {
          setSession(data.session ?? null);
          if (pendingRecovery === "true" && data.session) {
            setNeedsPasswordUpdate(true);
          }
        }
      })
      .finally(() => {
        if (mounted) {
          setCheckingSession(false);
        }
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession ?? null);
      if (event === "PASSWORD_RECOVERY") {
        setNeedsPasswordUpdate(true);
        setPendingPasswordRecovery(true).catch(() => {});
      }
      if (nextSession) {
        setAuthError(null);
        setPendingConfirmationEmail(null);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function handleIncomingUrl(url: string | null) {
      if (!url || !url.includes("auth/callback")) {
        return;
      }
      const params = parseAuthParamsFromUrl(url);
      const isRecovery = params.get("type") === "recovery";
      if (isRecovery) {
        setNeedsPasswordUpdate(true);
        await setPendingPasswordRecovery(true);
      }
      const sessionError = await createSessionFromAuthUrl(url);
      if (sessionError) {
        setAuthError(sessionError);
      }
    }

    Linking.getInitialURL()
      .then(handleIncomingUrl)
      .catch(() => {});
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleIncomingUrl(url).catch(() => {});
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (AppState.currentState === "active") {
      supabase.auth.startAutoRefresh();
    }

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      appStateSubscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  const signInWithProvider = useCallback(async (provider: Provider): Promise<boolean> => {
    const configError = assertSupabaseConfig();
    if (configError) {
      setAuthError(configError);
      setAuthMessage(null);
      return false;
    }

    setAuthError(null);
    setAuthMessage(null);
    const redirectTo = resolveAuthRedirectUri();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true
      }
    });
    if (error || !data?.url) {
      setAuthError(error?.message ?? "Could not start sign-in flow.");
      setAuthMessage(null);
      return false;
    }

    const authUrlToOpen = data.url;
    let result: Awaited<ReturnType<typeof WebBrowser.openAuthSessionAsync>>;
    try {
      result = await WebBrowser.openAuthSessionAsync(authUrlToOpen, redirectTo);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Failed to open auth session.");
      setAuthMessage(null);
      return false;
    }
    if (result.type !== "success" || !result.url) {
      setAuthError("Sign-in was cancelled.");
      setAuthMessage(null);
      return false;
    }

    const params = parseAuthParamsFromUrl(result.url);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) {
      setAuthError("Missing auth tokens from sign-in redirect.");
      setAuthMessage(null);
      return false;
    }

    const sessionResult = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    if (sessionResult.error) {
      setAuthError(sessionResult.error.message);
      setAuthMessage(null);
      return false;
    }
    return true;
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<boolean> => {
    const configError = assertSupabaseConfig();
    if (configError) {
      setAuthError(configError);
      setAuthMessage(null);
      return false;
    }

    setAuthError(null);
    setAuthMessage(null);
    setPendingConfirmationEmail(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      setAuthError(error.message);
      return false;
    }
    return true;
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string): Promise<boolean> => {
    const configError = assertSupabaseConfig();
    if (configError) {
      setAuthError(configError);
      setAuthMessage(null);
      return false;
    }

    setAuthError(null);
    setAuthMessage(null);
    setPendingConfirmationEmail(null);
    const emailRedirectTo = resolveAuthRedirectUri();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo
      }
    });

    if (error) {
      setAuthError(error.message);
      return false;
    }
    if (!data.session) {
      const identitiesCount = data.user?.identities?.length ?? 0;
      setPendingConfirmationEmail(email.trim().toLowerCase());
      if (identitiesCount === 0) {
        setAuthMessage("This email may already be registered. Try sign in first, then use resend confirmation if needed.");
      } else {
        setAuthMessage("Check your email to confirm your account, then sign in. You can resend below.");
      }
    } else {
      setAuthMessage("Account created and signed in.");
    }
    return true;
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<boolean> => {
    const configError = assertSupabaseConfig();
    if (configError) {
      setAuthError(configError);
      setAuthMessage(null);
      return false;
    }
    setAuthError(null);
    setAuthMessage(null);
    const redirectTo = resolveAuthRedirectUri();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) {
      setAuthError(error.message);
      return false;
    }
    setAuthMessage("Password reset email sent. Open the link on this device to set a new password.");
    return true;
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<boolean> => {
    setAuthError(null);
    setAuthMessage(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setAuthError(error.message);
      return false;
    }
    setNeedsPasswordUpdate(false);
    await setPendingPasswordRecovery(false);
    setAuthMessage("Password updated. You are signed in.");
    return true;
  }, []);

  const resendEmailConfirmation = useCallback(async (): Promise<boolean> => {
    if (!pendingConfirmationEmail) {
      setAuthError("No pending signup email to resend confirmation.");
      return false;
    }
    setAuthError(null);
    setAuthMessage(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingConfirmationEmail,
      options: {
        emailRedirectTo: resolveAuthRedirectUri()
      }
    });
    if (error) {
      setAuthError(error.message);
      return false;
    }
    setAuthMessage(`Confirmation email resent to ${pendingConfirmationEmail}.`);
    return true;
  }, [pendingConfirmationEmail]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await setPendingPasswordRecovery(false);
    setAuthMessage(null);
    setPendingConfirmationEmail(null);
    setNeedsPasswordUpdate(false);
  }, []);

  return {
    session,
    checkingSession,
    authError,
    authMessage,
    pendingConfirmationEmail,
    needsPasswordUpdate,
    signInWithProvider,
    signInWithEmail,
    signUpWithEmail,
    requestPasswordReset,
    updatePassword,
    resendEmailConfirmation,
    signOut
  };
}

