import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allowedOrigins, nodeEnv, trustProxy } from "./config.js";
import { adviceRouter } from "./routes/advice.js";
import { bodyWeightRouter } from "./routes/bodyWeight.js";
import { exerciseItemsRouter } from "./routes/exerciseItems.js";
import { exercisesRouter } from "./routes/exercises.js";
import { foodRouter } from "./routes/food.js";
import { healthRouter } from "./routes/health.js";
import { meRouter } from "./routes/me.js";
import { recordsRouter } from "./routes/records.js";
import { statisticsRouter } from "./routes/statistics.js";
import { templatesRouter } from "./routes/templates.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

if (trustProxy) {
  app.set("trust proxy", 1);
}

const isProduction = nodeEnv === "production";
const shouldRestrictCors = isProduction && allowedOrigins.length > 0;
app.use(
  cors({
    origin(origin, callback) {
      if (!shouldRestrictCors || !origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    }
  })
);
app.use(express.json({ limit: "8mb" }));
app.use("/assets", express.static(publicDir));
app.use((req, res, next) => {
  if (!req.path.startsWith("/advice")) {
    next();
    return;
  }
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/2dcdadeb-a66d-4c0e-a93d-8cc544bdbbcb",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"c5f43b"},body:JSON.stringify({sessionId:"c5f43b",runId:"initial",hypothesisId:"H2",location:"backend/src/app.ts:adviceMiddleware:entry",message:"incoming advice request",data:{method:req.method,path:req.path,hasAuthorization:Boolean(req.header("Authorization"))},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  res.on("finish", () => {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/2dcdadeb-a66d-4c0e-a93d-8cc544bdbbcb",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"c5f43b"},body:JSON.stringify({sessionId:"c5f43b",runId:"initial",hypothesisId:"H2",location:"backend/src/app.ts:adviceMiddleware:finish",message:"completed advice request",data:{method:req.method,path:req.path,status:res.statusCode},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  });
  next();
});

app.use(healthRouter);
app.use(meRouter);
app.use(exerciseItemsRouter);
app.use(recordsRouter);
app.use(exercisesRouter);
app.use(templatesRouter);
app.use(foodRouter);
app.use(adviceRouter);
app.use(bodyWeightRouter);
app.use(statisticsRouter);
app.use((req, res) => {
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/2dcdadeb-a66d-4c0e-a93d-8cc544bdbbcb",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"c5f43b"},body:JSON.stringify({sessionId:"c5f43b",runId:"initial",hypothesisId:"H3",location:"backend/src/app.ts:notFound",message:"request fell through routers",data:{method:req.method,path:req.path},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  res.status(404).json({ error: "Not found" });
});

export default app;
