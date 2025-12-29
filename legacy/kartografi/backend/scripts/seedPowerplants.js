import dotenv from "dotenv";
import mongoose from "mongoose";

import { Powerplant } from "../modules/backend/src/models/Powerplant.js";

dotenv.config();

async function seed() {
  const MONGO_URI =
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/kartografi";

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB (seed powerplants)");

    await Powerplant.deleteMany({});

    const powerplants = [
      {
        region: "Europe",
        name: "Danube Hydro",
        type: "hydro",
        coolingNeeds: "river",
        capacityMW: 800,
        constraints: ["seasonal_flow_variation"],
      },
      {
        region: "Europe",
        name: "Coastal Wind Belt",
        type: "wind",
        coolingNeeds: "none",
        capacityMW: 450,
        constraints: ["grid_stability_priority"],
      },
      {
        region: "Africa",
        name: "Sahel Solar Field",
        type: "solar",
        coolingNeeds: "low",
        capacityMW: 320,
        constraints: ["desert_resource_profile"],
      },
      {
        region: "Asia",
        name: "Island LNG Plant",
        type: "gas",
        coolingNeeds: "sea",
        capacityMW: 600,
        constraints: ["fuel_import_dependency"],
      },
      {
        region: "North America",
        name: "Northern Nuclear",
        type: "nuclear",
        coolingNeeds: "river",
        capacityMW: 1200,
        constraints: ["cold_season_peak"],
      },
    ];

    await Powerplant.insertMany(powerplants);

    console.log(`✅ Seeded ${powerplants.length} powerplants.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding powerplants:", err);
    process.exit(1);
  }
}

seed();
