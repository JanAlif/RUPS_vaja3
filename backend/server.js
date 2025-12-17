// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB } from "./src/config/db.js";
import userRoutes from "./src/routes/userRoutes.js";
import challengeRoutes from "./src/routes/challengeRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

// povezava na bazo
connectDB();

// API routes (MVC)
app.use("/api/users", userRoutes);
app.use("/api/challenges", challengeRoutes);

// health-check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// zagon
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});