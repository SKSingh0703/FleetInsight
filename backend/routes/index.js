import express from "express";

import uploadRoutes from "./uploadRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import searchRoutes from "./searchRoutes.js";
import authRoutes from "./authRoutes.js";
import adminRoutes from "./adminRoutes.js";
import sheetSyncRoutes from "./sheetSyncRoutes.js";

const router = express.Router();

router.use(authRoutes);
router.use(uploadRoutes);
router.use(dashboardRoutes);
router.use(searchRoutes);
router.use(adminRoutes);
router.use(sheetSyncRoutes);

export default router;

