import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { supabaseJwtAudience, supabaseUrl } from "../config.js";

const AUTH_ISSUER = supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/auth/v1` : "";
const JWKS_URL = AUTH_ISSUER ? new URL(`${AUTH_ISSUER}/.well-known/jwks.json`) : null;
const jwks = JWKS_URL ? createRemoteJWKSet(JWKS_URL) : null;

function parseBearerToken(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const [scheme, token] = value.trim().split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }
  return token;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!AUTH_ISSUER || !jwks) {
    res.status(500).json({ error: "Auth is not configured on the backend." });
    return;
  }

  const token = parseBearerToken(req.header("Authorization"));
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: AUTH_ISSUER,
      audience: supabaseJwtAudience
    });
    const supabaseUserId = typeof payload.sub === "string" ? payload.sub : null;
    if (!supabaseUserId) {
      res.status(401).json({ error: "Invalid token subject" });
      return;
    }

    const appMetadata =
      payload.app_metadata && typeof payload.app_metadata === "object" ?
        (payload.app_metadata as Record<string, unknown>)
      : {};
    const providerRaw = appMetadata.provider;

    req.auth = {
      supabaseUserId,
      email: typeof payload.email === "string" ? payload.email : null,
      provider: typeof providerRaw === "string" ? providerRaw : null
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired auth token" });
  }
}

