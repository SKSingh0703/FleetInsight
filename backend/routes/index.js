import express from "express";

import uploadRoutes from "./uploadRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import searchRoutes from "./searchRoutes.js";

const router = express.Router();

router.use(uploadRoutes);
router.use(dashboardRoutes);
router.use(searchRoutes);

export default router;

