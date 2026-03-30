import express from "express";
import { postSearch } from "../controllers/searchController.js";
import { verifyToken, requireApproved } from "../middleware/auth.js";

const router = express.Router();

router.post("/search", verifyToken, requireApproved, postSearch);

export default router;
