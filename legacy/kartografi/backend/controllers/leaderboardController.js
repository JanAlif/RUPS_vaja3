// backend/controllers/leaderboardController.js
import Leaderboard from '../models/Leaderboard.js';
import User from '../models/User.js';

// Get user's Slovenian cities high score
export const getSloHighScore = async (req, res) => {
  try {
    const userId = req.cookies.userId;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    
    const entry = await Leaderboard.findOne({ 
      userId, 
      gameType: "slovenian-cities" 
    }).sort({ score: -1 }); 

    if (!entry) {
      return res.json({ slo_points: 0 });
    }

    return res.json({ slo_points: entry.score || 0 });
  } catch (err) {
    console.error("Error getting slo_points:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Update user's Slovenian cities high score
export const updateSloHighScore = async (req, res) => {
  try {
    const userId = req.cookies.userId; 
    const { score } = req.body;

    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    if (typeof score !== "number") return res.status(400).json({ error: "score must be a number" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    let newHighScore = false;

    if (score > (user.slo_points || 0)) {
      user.slo_points = score;
      await user.save();
      newHighScore = true;
    }

    return res.json({
      updated: newHighScore,
      slo_points: user.slo_points,
    });
  } catch (err) {
    console.error("Error updating slo_points:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Legacy functions for old leaderboard system (backward compatibility)
export const getSloLeaderboard = async (req, res) => {
  try {
    const users = await User.find({}, "username slo_points")
      .sort({ slo_points: -1 })
      .limit(100);
    res.json(users);
  } catch (err) {
    console.error("Error fetching SLO leaderboard:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getQuizLeaderboard = async (req, res) => {
  try {
    const users = await User.find({}, "username quiz_points")
      .sort({ quiz_points: -1 })
      .limit(100);
    res.json(users);
  } catch (err) {
    console.error("Error fetching quiz leaderboard:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Submit a score (creates or updates user's best score)
export const submitScore = async (req, res) => {
  try {
    let { gameType, continent, score, maxScore, percentage, userId, username } = req.body;

    // Validate required fields
    if (!gameType || score === undefined || maxScore === undefined || percentage === undefined) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!userId) {
      return res.status(400).json({ message: 'userId and username are required' });
    }
    if(!username){
      const user = await User.findById(userId);
      if (!user) return res.status(400).json({ error: "User not found" });
      username = user.username;
    }
    // For countries game, continent is required
    if (gameType === 'countries' && !continent) {
      return res.status(400).json({ message: 'Continent is required for countries game' });
    }

    // Find existing entry for this user, game type, and continent
    const query = { 
      userId, 
      gameType,
    };
    
    if (gameType === 'countries') {
      query.continent = continent;
    }

    const existingEntry = await Leaderboard.findOne(query);

    if (existingEntry) {
      // Only update if new score is better
      if (score > existingEntry.score) {
        existingEntry.score = score;
        existingEntry.maxScore = maxScore;
        existingEntry.percentage = percentage;
        existingEntry.completedAt = new Date();
        await existingEntry.save();
        return res.json({ 
          message: 'New high score!', 
          entry: existingEntry,
          isNewRecord: true 
        });
      } else {
        return res.json({ 
          message: 'Score recorded but not a new high score', 
          entry: existingEntry,
          isNewRecord: false 
        });
      }
    } else {
      // Create new entry
      const newEntry = new Leaderboard({
        userId,
        username,
        gameType,
        continent: gameType === 'countries' ? continent : undefined,
        score,
        maxScore,
        percentage,
        completedAt: new Date()
      });
      await newEntry.save();
      return res.status(201).json({ 
        message: 'Score submitted successfully', 
        entry: newEntry,
        isNewRecord: true 
      });
    }
  } catch (error) {
    console.error('Submit score error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get leaderboard (top scores)
export const getLeaderboard = async (req, res) => {
  try {
    const { gameType, continent, limit = 100 } = req.query;

    if (!gameType) {
      return res.status(400).json({ message: 'gameType is required' });
    }

    const query = { gameType };
    
    // Always filter by continent for countries game
    if (gameType === 'countries' && continent) {
      query.continent = continent;
    }

    // Get top scores, only best score per user
    const leaderboard = await Leaderboard.find(query)
      .sort({ score: -1 })
      .limit(parseInt(limit))
      .select('username score maxScore percentage completedAt continent')
      .lean();

    res.json(leaderboard);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user's personal best scores
export const getUserBestScores = async (req, res) => {
  try {
    const userId = req.cookies.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const scores = await Leaderboard.find({ userId })
      .sort({ score: -1 })
      .select('gameType continent score maxScore percentage completedAt')
      .lean();

    res.json(scores);
  } catch (error) {
    console.error('Get user best scores error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
