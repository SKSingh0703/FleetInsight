import express from "express";

import { deleteTripById } from "../controllers/tripController.js";
import { verifyToken, requireApproved, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.delete("/trips/:id", verifyToken, requireApproved, requireAdmin, deleteTripById);

export default router;
