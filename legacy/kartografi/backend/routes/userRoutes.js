import { Router } from "express";
import {
  createUser,
  listUsers,
  getUserById,
  updateUserPoints,
  login,
  deleteUser,
  updateUserBasics,
  changePassword,
  verifySession,
  logoutUser
} from "../controllers/userController.js";

const router = Router();

router.post("/", createUser);
router.get("/", listUsers);
router.post("/login", login);
router.post("/logout", logoutUser);
router.get("/me", verifySession);
router.get("/:id", getUserById);
router.patch("/:id/points", updateUserPoints);
router.delete("/:id", deleteUser);
router.patch("/:id", updateUserBasics);
router.post("/:id/password", changePassword);

export default router;