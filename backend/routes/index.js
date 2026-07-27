import express from "express";

import uploadRoutes from "./uploadRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import searchRoutes from "./searchRoutes.js";
import authRoutes from "./authRoutes.js";
import adminRoutes from "./adminRoutes.js";
import sheetSyncRoutes from "./sheetSyncRoutes.js";
import tripRoutes from "./tripRoutes.js";
import driveSyncRoutes from "./driveSyncRoutes.js";
import paymentAdviceRoutes from "./paymentAdviceRoutes.js";

const router = express.Router();

router.use(authRoutes);
router.use(uploadRoutes);
router.use(dashboardRoutes);
router.use(searchRoutes);
router.use(adminRoutes);
router.use(sheetSyncRoutes);
router.use(tripRoutes);
router.use(driveSyncRoutes);
router.use(paymentAdviceRoutes);

export default router;
