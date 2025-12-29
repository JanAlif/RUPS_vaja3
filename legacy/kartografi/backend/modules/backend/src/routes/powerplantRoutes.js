// backend/modules/backend/src/routes/powerplantRoutes.js
import express from "express";
import { getPowerplants } from "../controllers/powerplantController.js";

const router = express.Router();

// GET /api/rups2/powerplants
router.get("/", getPowerplants);

export default router;
