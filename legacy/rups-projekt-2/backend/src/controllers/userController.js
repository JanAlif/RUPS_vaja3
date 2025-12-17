// backend/src/controllers/userController.js
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";

const SALT_ROUNDS = 10;

// POST /api/users/register
export async function registerUser(req, res) {
  try {
    const { username, password, avatarPath } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Manjka uporabniško ime ali geslo." });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res
        .status(400)
        .json({ message: "Uporabniško ime je že zasedeno." });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create({
      username,
      passwordHash,
      avatarPath: avatarPath || null,
    });

    res.status(201).json(user);
  } catch (err) {
    console.error("registerUser error:", err);
    res.status(500).json({ message: "Napaka pri registraciji." });
  }
}

// POST /api/users/login
export async function loginUser(req, res) {
  try {
    const { email, username, password } = req.body;

    if (!password || (!email && !username)) {
      return res
        .status(400)
        .json({ message: "Manjka uporabniško ime/email ali geslo." });
    }

    let user;
    if (email) {
      user = await User.findOne({ email });
    } else if (username) {
      user = await User.findOne({ username });
    }

    if (!user) {
      return res.status(400).json({ message: "Uporabnik ne obstaja." });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ message: "Napačno geslo." });
    }

    res.json(user);
  } catch (err) {
    console.error("loginUser error:", err);
    res.status(500).json({ message: "Napaka pri prijavi." });
  }
}

// PUT /api/users/:id  (posodobitev profila – avatar, username ipd.)
export async function updateUserProfile(req, res) {
  try {
    const { id } = req.params;
    const { username, avatarPath } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Uporabnik ni najden." });
    }

    if (username) user.username = username;
    if (avatarPath) user.avatarPath = avatarPath;

    const updated = await user.save();
    res.json(updated);
  } catch (err) {
    console.error("updateUserProfile error:", err);
    res.status(500).json({ message: "Napaka pri posodobitvi profila." });
  }
}

// PUT /api/users/:id/password  (zamenjava gesla)
export async function updateUserPassword(req, res) {
  try {
    const { id } = req.params;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Manjka staro ali novo geslo." });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Uporabnik ni najden." });
    }

    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ message: "Staro geslo ni pravilno." });
    }

    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.save();

    res.json({ message: "Geslo uspešno posodobljeno." });
  } catch (err) {
    console.error("updateUserPassword error:", err);
    res.status(500).json({ message: "Napaka pri posodobitvi gesla." });
  }
}

// PUT /api/users/:id/scores  (posodobitev točk uporabnika po končanem sessionu)
export async function updateUserScores(req, res) {
  try {
    const userId = req.params.id;
    const { sessionScore } = req.body;

    if (typeof sessionScore !== 'number' || sessionScore < 0) {
      return res.status(400).json({ message: 'Neveljaven sessionScore.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Uporabnik ne obstaja.' });
    }

    // points = score prejšnjega sessiona
    user.points = sessionScore;

    // totalPoints = kumulativno
    user.totalPoints = (user.totalPoints || 0) + sessionScore;

    // highScore = največ v enem sessionu
    const currentHigh = user.highScore || 0;
    if (sessionScore > currentHigh) {
      user.highScore = sessionScore;
    }

    await user.save();
    res.json(user);
  } catch (err) {
    console.error('updateUserScores error:', err);
    res.status(500).json({ message: 'Napaka pri posodobitvi točk.' });
  }
}

// GET /api/users/leaderboard
export async function getLeaderboard(req, res) {
  try {
    const users = await User.find()
      .sort({ highScore: -1 })        // najvišji highScore najprej
      .limit(10)                      // npr. top 10
      .select("username avatarPath highScore"); // ne pošiljamo passwordHash itd.

    res.json(users);
  } catch (err) {
    console.error("getLeaderboard error:", err);
    res.status(500).json({ message: "Napaka pri pridobivanju lestvice." });
  }
}

export async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "Uporabnik ne obstaja." });
    }
    res.json(user);
  } catch (err) {
    console.error("getUserById error:", err);
    res.status(500).json({ message: "Napaka pri pridobivanju uporabnika." });
  }
}