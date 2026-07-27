import express from "express";
import multer from "multer";
import path from "path";
import { verifyToken, requireApproved } from "../middleware/auth.js";
import { verifyPaymentAdviceFile } from "../controllers/paymentAdviceController.js";

const router = express.Router();

const uploadDir = path.join(process.cwd(), "uploads");
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `advice-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post("/payment-advice/verify", verifyToken, requireApproved, upload.single("file"), verifyPaymentAdviceFile);

export default router;
