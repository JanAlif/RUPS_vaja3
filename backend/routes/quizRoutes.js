import { Router } from "express";
import { handleQuiz } from "../controllers/quizController.js";

const router = Router();

router.post("/", handleQuiz);

export default router;
