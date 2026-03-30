import express from "express";
import { googleAuth, me } from "../controllers/authController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/auth/google", googleAuth);
router.get("/auth/me", verifyToken, me);

export default router;
