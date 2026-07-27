import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "../config/db.js";
import { DriveFile } from "../models/driveFileModel.js";
import { DriveFolder } from "../models/driveFolderModel.js";
import { AnnexureRecord } from "../models/annexureRecordModel.js";
import { processAllPendingAnnexures } from "../services/annexureExtractorService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function check() {
  await connectDB();
  console.log("Connected to MongoDB");

  const candidates = await DriveFile.find({ isAnnexureCandidate: true }).lean();
  console.log("Found annexure candidates in DB:", candidates.length);

  const pending = candidates.filter(c => c.extractionStatus === "PENDING");
  const failed = candidates.filter(c => c.extractionStatus === "FAILED");
  const success = candidates.filter(c => c.extractionStatus === "SUCCESS");

  console.log(`Status breakdown: PENDING=${pending.length}, FAILED=${failed.length}, SUCCESS=${success.length}`);

  if (failed.length > 0) {
    console.log("Sample failed file errors:", failed.slice(0, 5).map(f => ({ name: f.name, error: f.extractionError })));
  }

  if (pending.length > 0) {
    console.log("Running processAllPendingAnnexures now...");
    const res = await processAllPendingAnnexures();
    console.log("Result:", res);
  }

  const totalExtracted = await AnnexureRecord.countDocuments({});
  console.log("Total extracted annexure records in DB:", totalExtracted);

  process.exit(0);
}

check().catch(err => {
  console.error("Check failed:", err);
  process.exit(1);
});
