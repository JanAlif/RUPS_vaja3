import express from "express";
import { getAllPowerplants } from "../controllers/powerplantController.js";

const router = express.Router();

router.get("/", getAllPowerplants);

export default router;
