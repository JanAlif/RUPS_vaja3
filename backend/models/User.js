// backend/models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema(
  {
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
      select: false, // don't return by default
    },
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
    quiz_points:{
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// Hash password ONLY if it was modified/created
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to compare plain vs hashed password
UserSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Clean JSON output (make double-sure password never leaks)
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.model("User", UserSchema);
export default User;