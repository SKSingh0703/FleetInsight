import express from "express";

import { getDashboard } from "../controllers/dashboardController.js";
import { verifyToken, requireApproved } from "../middleware/auth.js";

const router = express.Router();

// Basic dashboard summary (skeleton).
router.get("/dashboard", verifyToken, requireApproved, getDashboard);

export default router;

