import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import multer from "multer";

import { upload } from "../controllers/uploadController.js";
import { verifyToken, requireApproved } from "../middleware/auth.js";

const router = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "..", "uploads");

function getMaxUploadBytes() {
  const raw = process.env.UPLOAD_MAX_MB;
  const mb = Number(raw);
  const safeMb = Number.isFinite(mb) && mb > 0 ? mb : 25;
  return Math.trunc(safeMb * 1024 * 1024);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeBase = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .slice(0, 40);

    const ext = path.extname(file.originalname).toLowerCase() || ".xlsx";
    const id = crypto.randomUUID();
    cb(null, `${Date.now()}-${safeBase}-${id}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== ".xlsx") {
    return cb(new Error("Only .xlsx files are allowed"), false);
  }
  cb(null, true);
}

const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: getMaxUploadBytes() },
});

// MVP skeleton: upload endpoint will parse/process Excel later.
router.post("/upload", verifyToken, requireApproved, (req, res, next) => {
  uploadMiddleware.single("file")(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      const maxMb = Math.max(1, Math.round(getMaxUploadBytes() / (1024 * 1024)));
      return res.status(413).json({
        message: `File is too large. Please upload a file up to ${maxMb}MB.`,
      });
    }

    const message = typeof err?.message === "string" ? err.message : "Upload failed";
    return res.status(400).json({ message });
  });
}, upload);

export default router;

