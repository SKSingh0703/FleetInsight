import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import multer from "multer";

import { upload } from "../controllers/uploadController.js";

const router = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "..", "uploads");

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
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

// MVP skeleton: upload endpoint will parse/process Excel later.
router.post("/upload", uploadMiddleware.single("file"), upload);

export default router;

