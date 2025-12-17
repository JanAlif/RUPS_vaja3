import express from "express";
import cookieParser from "cookie-parser";
import User from "../models/User.js";

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username }).select("+password");
    if (!user) return res.status(401).json({ message: "invalid credentials" });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: "invalid credentials" });

    console.log("Logging in user:", user._id.toString());
    res.cookie( "userId",user._id.toString(), {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
      secure: false,
    });

    return res.json(user);
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ message: "server error" });
  }
};

export const createUser = async (req, res) => {
  try {
    console.log("HERE");
    const { username, password, points } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "username and password are required" });
    }

    const exists = await User.findOne({ username });
    if (exists) {
      return res.status(409).json({ message: "username already taken" });
    }

    const user = await User.create({ username, password, points });
    
    res.cookie("userId", user._id.toString(), {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
      secure: false,
    });
    
    return res.status(201).json(user);
  } catch (err) {
    console.error("createUser error:", err);
    return res.status(500).json({ message: "server error" });
  }
};

export const listUsers = async (_req, res) => {
  try {
    const users = await User.find().select("-password");
    return res.json(users);
  } catch (err) {
    console.error("listUsers error:", err);
    return res.status(500).json({ message: "server error" });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "user not found" });
    return res.json(user);
  } catch (err) {
    console.error("getUserById error:", err);
    return res.status(500).json({ message: "server error" });
  }
};

export const updateUserPoints = async (req, res) => {
  try {
    const { points } = req.body;
    if (points == null || Number.isNaN(Number(points))) {
      return res.status(400).json({ message: "points must be a number" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { points: Number(points) } },
      { new: true, runValidators: true, select: "-password" }
    );
    if (!user) return res.status(404).json({ message: "user not found" });
    return res.json(user);
  } catch (err) {
    console.error("updateUserPoints error:", err);
    return res.status(500).json({ message: "server error" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const out = await User.findByIdAndDelete(req.params.id);
    if (!out) return res.status(404).json({ message: "user not found" });
    return res.json({ message: "user deleted" });
  } catch (err) {
    console.error("deleteUser error:", err);
    return res.status(500).json({ message: "server error" });
  }
};

export const updateUserBasics = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || username.length < 3) {
      return res.status(400).json({ message: "username must be 3+ characters" });
    }
    // ensure unique username
    const taken = await User.findOne({ username, _id: { $ne: req.params.id } });
    if (taken) return res.status(409).json({ message: "username already taken" });

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { username } },
      { new: true, runValidators: true, select: "-password" }
    );
    if (!updated) return res.status(404).json({ message: "user not found" });
    return res.json(updated);
  } catch (err) {
    console.error("updateUserBasics error:", err);
    return res.status(500).json({ message: "server error" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword and newPassword required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "newPassword must be at least 6 characters" });
    }

    const user = await User.findById(req.params.id).select("+password");
    if (!user) return res.status(404).json({ message: "user not found" });

    const ok = await user.comparePassword(currentPassword);
    if (!ok) return res.status(401).json({ message: "current password incorrect" });

    user.password = newPassword;
    await user.save();
    return res.json({ message: "password updated" });
  } catch (err) {
    console.error("changePassword error:", err);
    return res.status(500).json({ message: "server error" });
  }
};

export const verifySession = async (req, res) => {
  try {
    const userId = req.cookies.userId;
    if (!userId) {
      return res.status(401).json({ message: "not authenticated" });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(401).json({ message: "user not found" });
    }

    return res.json(user);
  } catch (err) {
    console.error("verifySession error:", err);
    return res.status(500).json({ message: "server error" });
  }
};

export const logoutUser = async (req, res) => {
  try {
    res.clearCookie("userId");
    return res.json({ message: "logged out" });
  } catch (err) {
    console.error("logout error:", err);
    return res.status(500).json({ message: "server error" });
  }
};


