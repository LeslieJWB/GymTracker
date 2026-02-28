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
import { usersRouter } from "./routes/users.js";

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

app.use(healthRouter);
app.use(meRouter);
app.use(usersRouter);
app.use(exerciseItemsRouter);
app.use(recordsRouter);
app.use(exercisesRouter);
app.use(foodRouter);
app.use(adviceRouter);
app.use(bodyWeightRouter);
app.use(statisticsRouter);

export default app;
