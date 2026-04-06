import express from "express";
import {
  getBookNumberOptions,
  getChassisNumberOptions,
  getDeliveryNumberOptions,
  getLoadingPointOptions,
  getPartyNameOptions,
  getPartyOptions,
  getTripNumberOptions,
  getUnloadingPointOptions,
  postSearch,
} from "../controllers/searchController.js";
import { verifyToken, requireApproved } from "../middleware/auth.js";

const router = express.Router();

router.post("/search", verifyToken, requireApproved, postSearch);

router.get("/party-options", verifyToken, requireApproved, getPartyOptions);

router.get("/party-name-options", verifyToken, requireApproved, getPartyNameOptions);

router.get("/loading-point-options", verifyToken, requireApproved, getLoadingPointOptions);

router.get("/unloading-point-options", verifyToken, requireApproved, getUnloadingPointOptions);

router.get("/chassis-number-options", verifyToken, requireApproved, getChassisNumberOptions);

router.get("/book-number-options", verifyToken, requireApproved, getBookNumberOptions);

router.get("/delivery-number-options", verifyToken, requireApproved, getDeliveryNumberOptions);

router.get("/trip-number-options", verifyToken, requireApproved, getTripNumberOptions);

export default router;
