import { Router } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const legalDir = path.resolve(__dirname, "../../public/legal");

router.get("/legal/privacy", (_req, res) => {
  res.type("html").sendFile(path.join(legalDir, "privacy.html"));
});

router.get("/legal/terms", (_req, res) => {
  res.type("html").sendFile(path.join(legalDir, "terms.html"));
});

export const legalRouter = router;
