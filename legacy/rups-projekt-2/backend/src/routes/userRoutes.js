// backend/src/routes/userRoutes.js
import { Router } from "express";
import {
  registerUser,
  loginUser,
  updateUserProfile,
  updateUserPassword,
  updateUserScores,
  getLeaderboard,
  getUserById,
} from "../controllers/userController.js";

const router = Router();

// GET /api/users/leaderboard
router.get("/leaderboard", getLeaderboard);

router.get("/:id", getUserById);

// POST /api/users/register
router.post("/register", registerUser);

// POST /api/users/login
router.post("/login", loginUser);

// PUT /api/users/:id  -> update username, avatarPath, ...
router.put("/:id", updateUserProfile);

// PUT /api/users/:id/password  -> change password
router.put("/:id/password", updateUserPassword);

// PUT /api/users/:id/scores  -> update points, highScore, totalPoints
router.put('/:id/scores', updateUserScores);

export default router;