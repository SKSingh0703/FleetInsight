import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "../config/db.js";
import { DriveFile } from "../models/driveFileModel.js";
import { DriveCrawlState } from "../models/driveCrawlStateModel.js";
import { AnnexureRecord } from "../models/annexureRecordModel.js";
import { isAnnexureCandidateName } from "../services/driveScannerService.js";
import { processAllPendingAnnexures } from "../services/annexureExtractorService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function reprocess() {
  await connectDB();
  console.log("Connected to MongoDB");

  const allFiles = await DriveFile.find({}).lean();
  console.log("Total Drive Files in DB:", allFiles.length);

  let candidateCount = 0;

  for (const f of allFiles) {
    const isCand = isAnnexureCandidateName(f.name, f.mimeType);
    if (isCand) {
      candidateCount += 1;
      await DriveFile.updateOne(
        { _id: f._id },
        { $set: { isAnnexureCandidate: true, extractionStatus: "PENDING" } }
      );
    } else {
      await DriveFile.updateOne(
        { _id: f._id },
        { $set: { isAnnexureCandidate: false, extractionStatus: "SKIPPED" } }
      );
    }
  }

  console.log("Strict Annexure Excel candidates found:", candidateCount);

  // Clear previous records to ensure 100% clean Annexure-only data
  await AnnexureRecord.deleteMany({});
  console.log("Cleared old AnnexureRecord entries");

  console.log("Extracting strict Annexure Excel files now...");
  const res = await processAllPendingAnnexures();
  console.log("Extraction Result:", res);

  const totalExtracted = await AnnexureRecord.countDocuments({});
  const totalAnnexuresProcessed = await DriveFile.countDocuments({
    isAnnexureCandidate: true,
    extractionStatus: "SUCCESS",
  });

  console.log(`Final Stats: Annexure Files=${candidateCount}, Processed Files=${totalAnnexuresProcessed}, Extracted Rows=${totalExtracted}`);
  process.exit(0);
}

reprocess().catch(err => {
  console.error("Reprocess failed:", err);
  process.exit(1);
});
