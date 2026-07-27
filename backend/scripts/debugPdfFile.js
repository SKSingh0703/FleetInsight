import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { connectDB } from "../config/db.js";
import { PaymentAdviceFile } from "../models/paymentAdviceFileModel.js";
import { PaymentAdviceRecord } from "../models/paymentAdviceRecordModel.js";
import { parsePdfPaymentAdvice, processPaymentAdviceFile } from "../services/paymentAdviceParserService.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function debug() {
  await connectDB();
  console.log("Connected to MongoDB");

  const doc = await PaymentAdviceFile.findOne({ fileId: "pa_527f08afb47db0fcaced0492" }).lean();
  console.log("DB File doc for pa_527f08afb47db0fcaced0492:", doc);

  // Clear 0-row failed file record so re-upload works cleanly
  await PaymentAdviceFile.deleteMany({ extractedRowCount: 0 });
  console.log("Deleted old 0-row PaymentAdviceFile entries from MongoDB.");

  process.exit(0);
}

debug().catch(err => {
  console.error("Debug failed:", err);
  process.exit(1);
});
