// modules/backend/src/routes/elektroUserRoutes.js
import { Router } from "express";
import {
  getElektroLeaderboard,
  getUserElektroProfile,
  updateElektroProfile,
  updateElektroScores,
} from "../controllers/elektroUserController.js";

const router = Router();

// GET /api/rups2/users/leaderboard
router.get("/leaderboard", getElektroLeaderboard);

// GET /api/rups2/users/:id  -> elektro profil (username + avatar + elektro_* polja)
router.get("/:id", getUserElektroProfile);

// PUT /api/rups2/users/:id  -> update avatarPath (in po želji username)
router.put("/:id", updateElektroProfile);

// PUT /api/rups2/users/:id/scores  -> update elektro_points/highScore/totalPoints
router.put("/:id/scores", updateElektroScores);

export default router;