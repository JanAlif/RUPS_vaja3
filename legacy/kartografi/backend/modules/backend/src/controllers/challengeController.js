// backend/src/controllers/challengeController.js
import { Challenge } from "../models/Challenge.js";

// GET /api/challenges
export async function getChallenges(req, res) {
  try {
    const challenges = await Challenge.find({ isActive: true })
      .sort({ orderIndex: 1 });

    res.json(challenges);
  } catch (err) {
    console.error("getChallenges error:", err);
    res.status(500).json({ message: "Napaka pri pridobivanju izzivov." });
  }
}