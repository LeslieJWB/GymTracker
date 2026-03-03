import { createRemoteJWKSet, jwtVerify } from "jose";
import { supabaseJwtAudience, supabaseUrl } from "../config.js";
const AUTH_ISSUER = supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/auth/v1` : "";
const JWKS_URL = AUTH_ISSUER ? new URL(`${AUTH_ISSUER}/.well-known/jwks.json`) : null;
const jwks = JWKS_URL ? createRemoteJWKSet(JWKS_URL) : null;
function parseBearerToken(value) {
    if (!value) {
        return null;
    }
    const [scheme, token] = value.trim().split(/\s+/, 2);
    if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
        return null;
    }
    return token;
}
export async function requireAuth(req, res, next) {
    if (!AUTH_ISSUER || !jwks) {
        res.status(500).json({ error: "Auth is not configured on the backend." });
        return;
    }
    const token = parseBearerToken(req.header("Authorization"));
    if (!token) {
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/2dcdadeb-a66d-4c0e-a93d-8cc544bdbbcb", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c5f43b" }, body: JSON.stringify({ sessionId: "c5f43b", runId: "initial", hypothesisId: "H5", location: "backend/src/middleware/auth.ts:missingToken", message: "auth rejected missing bearer token", data: { method: req.method, path: req.path }, timestamp: Date.now() }) }).catch(() => { });
        // #endregion
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
        const appMetadata = payload.app_metadata && typeof payload.app_metadata === "object" ?
            payload.app_metadata
            : {};
        const providerRaw = appMetadata.provider;
        req.auth = {
            supabaseUserId,
            email: typeof payload.email === "string" ? payload.email : null,
            provider: typeof providerRaw === "string" ? providerRaw : null
        };
        next();
    }
    catch {
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/2dcdadeb-a66d-4c0e-a93d-8cc544bdbbcb", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c5f43b" }, body: JSON.stringify({ sessionId: "c5f43b", runId: "initial", hypothesisId: "H5", location: "backend/src/middleware/auth.ts:invalidToken", message: "auth rejected invalid or expired token", data: { method: req.method, path: req.path }, timestamp: Date.now() }) }).catch(() => { });
        // #endregion
        res.status(401).json({ error: "Invalid or expired auth token" });
    }
}
