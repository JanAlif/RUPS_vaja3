import { Powerplant } from "../modules/backend/src/models/Powerplant.js";

export const getAllPowerplants = async (req, res) => {
  try {
    const powerplants = await Powerplant.find({});
    res.json(powerplants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
