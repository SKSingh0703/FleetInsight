import { connectDB } from "../config/db.js";
import { processAllPendingAnnexures } from "../services/annexureExtractorService.js";
import { AnnexureRecord } from "../models/annexureRecordModel.js";
import { DriveFile } from "../models/driveFileModel.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  await connectDB();
  console.log("Connected to MongoDB. Starting direct extraction of all pending Annexure files...");

  const res = await processAllPendingAnnexures();
  console.log("Extraction Completed Result:", res);

  const totalExtracted = await AnnexureRecord.countDocuments({});
  const processedFiles = await DriveFile.countDocuments({ isAnnexureCandidate: true, extractionStatus: "SUCCESS" });
  console.log(`Total Extracted Rows in DB = ${totalExtracted}, Processed Files = ${processedFiles}`);

  process.exit(0);
}

main().catch(err => {
  console.error("Direct Extraction Error:", err);
  process.exit(1);
});
