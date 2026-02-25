import { Router } from "express";
import { ensureDefaultUser } from "../shared/users.js";

export const usersRouter = Router();

usersRouter.get("/users/bootstrap", async (_req, res) => {
  if (process.env.ENABLE_BOOTSTRAP_USER !== "true") {
    return res.status(404).json({ error: "Bootstrap user endpoint disabled." });
  }
  try {
    const user = await ensureDefaultUser();
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});
