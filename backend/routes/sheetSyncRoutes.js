import express from "express";
import { verifyToken, requireApproved, requireAdmin } from "../middleware/auth.js";
import {
  getSheetSyncStatus,
  getSheetSyncSuggestions,
  listSheetSyncRuns,
  runSheetSyncNow,
  upsertSheetIntegration,
} from "../controllers/sheetSyncController.js";

const router = express.Router();

router.get("/admin/sheetsync", verifyToken, requireApproved, requireAdmin, getSheetSyncStatus);
router.get(
  "/admin/sheetsync/suggest",
  verifyToken,
  requireApproved,
  requireAdmin,
  getSheetSyncSuggestions
);
router.get("/admin/sheetsync/runs", verifyToken, requireApproved, requireAdmin, listSheetSyncRuns);
router.post("/admin/sheetsync/config", verifyToken, requireApproved, requireAdmin, upsertSheetIntegration);
router.post("/admin/sheetsync/run", verifyToken, requireApproved, requireAdmin, runSheetSyncNow);

export default router;
