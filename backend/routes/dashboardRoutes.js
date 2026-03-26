import express from "express";

import { getDashboard } from "../controllers/dashboardController.js";

const router = express.Router();

// Basic dashboard summary (skeleton).
router.get("/dashboard", getDashboard);

export default router;

