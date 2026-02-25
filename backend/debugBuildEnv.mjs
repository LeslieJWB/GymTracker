import { createRequire } from "node:module";

const endpoint = "http://127.0.0.1:7242/ingest/2dcdadeb-a66d-4c0e-a93d-8cc544bdbbcb";
const sessionId = "45255c";
const require = createRequire(import.meta.url);

function canResolve(specifier) {
  try {
    require.resolve(specifier);
    return true;
  } catch {
    return false;
  }
}

function sendLog(payload) {
  // #region agent log
  fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": sessionId
    },
    body: JSON.stringify({
      sessionId,
      timestamp: Date.now(),
      ...payload
    })
  }).catch(() => {});
  // #endregion
}

sendLog({
  runId: "render-build",
  hypothesisId: "H1-H2",
  location: "debugBuildEnv.mjs:startup",
  message: "Build env snapshot",
  data: {
    nodeEnv: process.env.NODE_ENV ?? null,
    npmConfigProduction: process.env.npm_config_production ?? null,
    npmConfigOmit: process.env.npm_config_omit ?? null
  }
});

sendLog({
  runId: "render-build",
  hypothesisId: "H1-H3-H4",
  location: "debugBuildEnv.mjs:resolve",
  message: "Package resolution snapshot",
  data: {
    hasTypescript: canResolve("typescript"),
    hasTypesNode: canResolve("@types/node"),
    hasTypesExpress: canResolve("@types/express"),
    hasTypesCors: canResolve("@types/cors"),
    hasTypesPg: canResolve("@types/pg"),
    hasExpress: canResolve("express"),
    hasCors: canResolve("cors"),
    hasPg: canResolve("pg")
  }
});
