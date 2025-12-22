// backend/src/routes/challengeRoutes.js
import express from "express";
import { getChallenges } from "../controllers/challengeController.js";

const router = express.Router();

// GET /api/challenges
router.get("/", getChallenges);

export default router;