// backend/models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema(
  {
    // === IDENTITETA ===
    username: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      minlength: 3,
      maxlength: 50,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    avatarPath: {
      type: String,
      default: null,
    },

    // === KARTOGRAFI TOČKE ===
    points: {
      type: Number,
      default: 0,
      min: 0,
    },
    slo_points: {
      type: Number,
      default: 0,
      min: 0,
    },
    quiz_points: {
      type: Number,
      default: 0,
      min: 0,
    },

    // === RUPS2 / ELEKTRO TOČKE ===
    elektro_points: {
      type: Number,
      default: 0,
      min: 0,
    },
    elektro_highScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    elektro_totalPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// === PASSWORD HASH ===
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// === PASSWORD CHECK ===
UserSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

// === SAFE JSON ===
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.model("User", UserSchema);
export default User;