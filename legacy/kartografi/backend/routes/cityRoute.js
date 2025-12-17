import express from "express";
import { getRandomCity, getCityCoordinates } from "../controllers/cityController.js";

const router = express.Router();


router.get("/random", getRandomCity);


router.get("/coords", getCityCoordinates);

export default router;
