import express from "express";
import {
  listUsers,
  listPendingUsers,
  approveUser,
  rejectUser,
  makeAdmin,
  removeUser,
} from "../controllers/adminController.js";
import { verifyToken, requireApproved, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.get("/admin/users", verifyToken, requireApproved, requireAdmin, listUsers);
router.get("/admin/pending", verifyToken, requireApproved, requireAdmin, listPendingUsers);
router.post("/admin/approve/:userId", verifyToken, requireApproved, requireAdmin, approveUser);
router.post("/admin/reject/:userId", verifyToken, requireApproved, requireAdmin, rejectUser);
router.post("/admin/make-admin/:userId", verifyToken, requireApproved, requireAdmin, makeAdmin);
router.delete("/admin/remove/:userId", verifyToken, requireApproved, requireAdmin, removeUser);

export default router;
