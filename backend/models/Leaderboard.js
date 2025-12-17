// backend/models/Leaderboard.js
import mongoose from 'mongoose';

const leaderboardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  gameType: {
    type: String,
    enum: ['countries', 'slovenian-cities'],
    required: true
  },
  continent: {
    type: String,
    enum: ['all', 'Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'],
    required: function() {
      return this.gameType === 'countries';
    }
  },
  score: {
    type: Number,
    required: true,
    min: 0
  },
  maxScore: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  completedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
leaderboardSchema.index({ gameType: 1, continent: 1, score: -1 });
leaderboardSchema.index({ userId: 1, gameType: 1, continent: 1 });

export default mongoose.model('Leaderboard', leaderboardSchema);
