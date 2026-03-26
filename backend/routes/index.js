import express from "express";

import uploadRoutes from "./uploadRoutes.js";
import vehicleRoutes from "./vehicleRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";

const router = express.Router();

router.use(uploadRoutes);
router.use(vehicleRoutes);
router.use(dashboardRoutes);

export default router;

