// modules/backend/src/controllers/elektroUserController.js
import User from "../../../../models/User.js";

// GET /api/rups2/users/leaderboard
export async function getElektroLeaderboard(req, res) {
  try {
    const users = await User.find()
      .sort({ elektro_highScore: -1 })
      .limit(10)
      .select("username avatarPath elektro_highScore");

    res.json(users);
  } catch (err) {
    console.error("getElektroLeaderboard error:", err);
    res.status(500).json({ message: "Napaka pri pridobivanju elektro lestvice." });
  }
}

// GET /api/rups2/users/:id
export async function getUserElektroProfile(req, res) {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select(
      "username avatarPath elektro_points elektro_highScore elektro_totalPoints"
    );

    if (!user) return res.status(404).json({ message: "Uporabnik ne obstaja." });

    res.json(user);
  } catch (err) {
    console.error("getUserElektroProfile error:", err);
    res.status(500).json({ message: "Napaka pri pridobivanju uporabnika." });
  }
}

// PUT /api/rups2/users/:id
export async function updateElektroProfile(req, res) {
  try {
    const { id } = req.params;
    const { avatarPath /*, username */ } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "Uporabnik ni najden." });

    // priporočilo: username naj ureja kartografi
    // if (username) user.username = username;

    if (typeof avatarPath !== "undefined") user.avatarPath = avatarPath;

    const updated = await user.save();

    // vrni samo “varno” podmnožico
    res.json({
      _id: updated._id,
      username: updated.username,
      avatarPath: updated.avatarPath,
      elektro_points: updated.elektro_points,
      elektro_highScore: updated.elektro_highScore,
      elektro_totalPoints: updated.elektro_totalPoints,
    });
  } catch (err) {
    console.error("updateElektroProfile error:", err);
    res.status(500).json({ message: "Napaka pri posodobitvi profila." });
  }
}

// PUT /api/rups2/users/:id/scores
export async function updateElektroScores(req, res) {
  try {
    const userId = req.params.id;
    const { sessionScore } = req.body;

    if (typeof sessionScore !== "number" || sessionScore < 0) {
      return res.status(400).json({ message: "Neveljaven sessionScore." });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Uporabnik ne obstaja." });

    // elektro_points = score trenutnega sessiona (kot prej points)
    user.elektro_points = sessionScore;

    // elektro_totalPoints = kumulativa
    user.elektro_totalPoints = (user.elektro_totalPoints || 0) + sessionScore;

    // elektro_highScore = max v enem sessionu
    const currentHigh = user.elektro_highScore || 0;
    if (sessionScore > currentHigh) {
      user.elektro_highScore = sessionScore;
    }

    await user.save();

    res.json({
      _id: user._id,
      username: user.username,
      avatarPath: user.avatarPath,
      elektro_points: user.elektro_points,
      elektro_highScore: user.elektro_highScore,
      elektro_totalPoints: user.elektro_totalPoints,
    });
  } catch (err) {
    console.error("updateElektroScores error:", err);
    res.status(500).json({ message: "Napaka pri posodobitvi točk." });
  }
}