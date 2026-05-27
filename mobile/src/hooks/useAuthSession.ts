import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { makeRedirectUri } from "expo-auth-session";
import type { Session } from "@supabase/supabase-js";
import sessionUrlProvider from "expo-auth-session/build/SessionUrlProvider";
import { assertSupabaseConfig, supabase } from "../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

type Provider = "google" | "apple";

function parseFragmentParams(url: string): URLSearchParams {
  const fragment = url.split("#")[1] ?? "";
  return new URLSearchParams(fragment);
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

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          setSession(data.session ?? null);
        }
      })
      .finally(() => {
        if (mounted) {
          setCheckingSession(false);
        }
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
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

    const params = parseFragmentParams(result.url);
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
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) {
      setAuthError(error.message);
      return false;
    }
    setAuthMessage("Password reset email sent. Open the link in your inbox to set a new password.");
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
    setAuthMessage(null);
    setPendingConfirmationEmail(null);
  }, []);

  return {
    session,
    checkingSession,
    authError,
    authMessage,
    pendingConfirmationEmail,
    signInWithProvider,
    signInWithEmail,
    signUpWithEmail,
    requestPasswordReset,
    resendEmailConfirmation,
    signOut
  };
}

