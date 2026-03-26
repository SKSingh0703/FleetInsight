import express from "express";

import { getVehicle } from "../controllers/vehicleController.js";

const router = express.Router();

// MVP hero feature (skeleton): fetch trips + summary for a vehicle.
router.get("/vehicle/:vehicleNumber", getVehicle);

export default router;

