import City from "../models/City.js";

// GET /api/cities/random
export const getRandomCity = async (req, res) => {
  try {
    const [randomCity] = await City.aggregate([{ $sample: { size: 1 } }]);
    if (!randomCity) return res.status(404).json({ error: "No cities found" });
    res.json({ city: randomCity.city });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/cities/coords?name=CityName
export const getCityCoordinates = async (req, res) => {
  try {
    const cityName = req.query.name;
    if (!cityName) return res.status(400).json({ error: "City name required" });

    const city = await City.findOne({ city: cityName }).lean();
    if (!city) return res.status(404).json({ error: "City not found" });

    res.json({ lat: parseFloat(city.lat), lng: parseFloat(city.lng) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};
