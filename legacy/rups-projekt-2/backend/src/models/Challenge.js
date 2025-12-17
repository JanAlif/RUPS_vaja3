// backend/src/models/Challenge.js
import mongoose from "mongoose";

const challengeSchema = new mongoose.Schema(
  {
    prompt: {
      type: String,
      required: true,
      trim: true,
    },
    requiredComponents: {
      type: [String],
      required: true,
    },
    theory: {
      type: [String], // lahko več odstavkov razlage
      default: [],
    },
    difficulty: {
      type: String,
      enum: ["demo", "easy", "medium", "hard"],
      default: "easy",
    },
    pointsMultiplier: {
      type: Number,
      default: 1, // npr. easy = 1, medium = 1.5, hard = 2
    },
    orderIndex: {
      type: Number,
      default: 0, // za vrstni red (0,1,2,...)
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Challenge = mongoose.model("Challenge", challengeSchema);