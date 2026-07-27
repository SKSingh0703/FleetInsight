import express from "express";
import { verifyToken, requireApproved, requireAdmin } from "../middleware/auth.js";
import {
  getDriveSyncStatus,
  addDriveSyncRoot,
  deleteDriveSyncRoot,
  listAnnexureRecords,
  triggerDriveSyncNow,
} from "../controllers/driveSyncController.js";

const router = express.Router();

router.get("/admin/drivesync", verifyToken, requireApproved, requireAdmin, getDriveSyncStatus);
router.post("/admin/drivesync/roots", verifyToken, requireApproved, requireAdmin, addDriveSyncRoot);
router.delete("/admin/drivesync/roots/:folderId", verifyToken, requireApproved, requireAdmin, deleteDriveSyncRoot);
router.post("/admin/drivesync/run", verifyToken, requireApproved, requireAdmin, triggerDriveSyncNow);
router.get("/admin/drivesync/annexures", verifyToken, requireApproved, listAnnexureRecords);

export default router;
