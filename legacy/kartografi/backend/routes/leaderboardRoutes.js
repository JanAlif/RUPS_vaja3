// backend/routes/leaderboardRoutes.js
import express from 'express';
import {
  submitScore,
  getLeaderboard,
  getUserBestScores,
  getSloLeaderboard,
  getQuizLeaderboard,
  getSloHighScore,
  updateSloHighScore
} from '../controllers/leaderboardController.js';

const router = express.Router();

// Legacy routes for backward compatibility
// @route   GET /api/leaderboard/slo
// @desc    Get Slovenian cities leaderboard (old system)
// @access  Public
router.get('/slo', getSloLeaderboard);

// @route   GET /api/leaderboard/quiz
// @desc    Get quiz leaderboard (old system)
// @access  Public
router.get('/quiz', getQuizLeaderboard);

// Slovenian cities high score routes
// @route   GET /api/leaderboard/slo-highscore
// @desc    Get user's Slovenian cities high score
// @access  Private (cookie-based)
router.get('/slo-highscore', getSloHighScore);

// @route   POST /api/leaderboard/slo-highscore
// @desc    Update user's Slovenian cities high score
// @access  Private (cookie-based)
router.post('/slo-highscore', updateSloHighScore);

// @route   GET /api/leaderboard/my-scores
// @desc    Get user's best scores
// @access  Private (cookie-based)
router.get('/my-scores', getUserBestScores);

// @route   POST /api/leaderboard/submit
// @desc    Submit a score
// @access  Public (expects userId and username in body)
router.post('/submit', submitScore);

// @route   GET /api/leaderboard
// @desc    Get leaderboard
// @access  Public
// NOTE: This must be LAST because it matches '/' which would override other routes
router.get('/', getLeaderboard);

export default router;
