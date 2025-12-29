// backend/modules/backend/src/controllers/powerplantController.js
import { Powerplant } from "../models/Powerplant.js";

// GET /api/rups2/powerplants?region=Europe
export async function getPowerplants(req, res) {
  try {
    console.log("getPowerplants called with query:", req.query);
    const region = (req.query.region || "").toString().trim();
    const filter = { isActive: true };
    if (region) filter.region = region;

    const powerplants = await Powerplant.find(filter)
      .sort({ region: 1, name: 1 })
      .select("region name type coolingNeeds capacityMW constraints meta")
      .lean();

    res.json(powerplants);
  } catch (err) {
    console.error("getPowerplants error:", err);
    res.status(500).json({ message: "Napaka pri pridobivanju elektrarn." });
  }
}
