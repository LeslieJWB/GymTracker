import { useCallback, useEffect, useState } from "react";
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
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signInWithProvider = useCallback(async (provider: Provider): Promise<boolean> => {
    const configError = assertSupabaseConfig();
    if (configError) {
      setAuthError(configError);
      return false;
    }

    setAuthError(null);
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
      return false;
    }

    const authUrlToOpen = data.url;
    let result: Awaited<ReturnType<typeof WebBrowser.openAuthSessionAsync>>;
    try {
      result = await WebBrowser.openAuthSessionAsync(authUrlToOpen, redirectTo);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Failed to open auth session.");
      return false;
    }
    if (result.type !== "success" || !result.url) {
      setAuthError("Sign-in was cancelled.");
      return false;
    }

    const params = parseFragmentParams(result.url);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) {
      setAuthError("Missing auth tokens from sign-in redirect.");
      return false;
    }

    const sessionResult = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    if (sessionResult.error) {
      setAuthError(sessionResult.error.message);
      return false;
    }
    return true;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    session,
    checkingSession,
    authError,
    signInWithProvider,
    signOut
  };
}

