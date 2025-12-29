// backend/modules/backend/src/models/Powerplant.js
import mongoose from "mongoose";

const powerplantSchema = new mongoose.Schema(
  {
    region: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    coolingNeeds: {
      type: String,
      default: "none",
      trim: true,
    },
    capacityMW: {
      type: Number,
      default: 0,
      min: 0,
    },
    constraints: {
      type: [String],
      default: [],
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Powerplant = mongoose.model("Powerplant", powerplantSchema);
