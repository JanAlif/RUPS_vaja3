// legacy/kartografi/backend/modules/backend/server.js
import express from "express";

import userRoutes from "./src/routes/elektroUserRoutes.js";
import challengeRoutes from "./src/routes/challengeRoutes.js";

const router = express.Router();

// če hočeš, lahko rups2 dobi svoj "health"
router.get("/health", (_req, res) => res.json({ status: "ok-rups2" }));

// IMPORTANT: tukaj NE daj app.listen() in NE connectDB()
router.use("/users", userRoutes);
router.use("/challenges", challengeRoutes);

export default router;