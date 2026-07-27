import { connectDB } from "../config/db.js";
import { scanAllDriveFolderTrees } from "../services/driveScannerService.js";
import { processAllPendingAnnexures } from "../services/annexureExtractorService.js";
import { DriveFolder } from "../models/driveFolderModel.js";
import { DriveFile } from "../models/driveFileModel.js";
import { AnnexureRecord } from "../models/annexureRecordModel.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  await connectDB();
  console.log("Connected to MongoDB. Starting full recursive crawl of all connected Drive folders...");

  const scanResults = await scanAllDriveFolderTrees();
  console.log("Scan Results:", JSON.stringify(scanResults, null, 2));

  const totalFolders = await DriveFolder.countDocuments({});
  const totalBillFolders = await DriveFolder.countDocuments({ isBillFolder: true });
  const totalFiles = await DriveFile.countDocuments({});
  const candidates = await DriveFile.countDocuments({ isAnnexureCandidate: true });

  console.log(`CRAWL COMPLETE: Folders = ${totalFolders}, Bill Folders = ${totalBillFolders}, Files = ${totalFiles}, Candidates = ${candidates}`);

  console.log("Starting extraction of all candidate Annexures into DB...");
  const extractRes = await processAllPendingAnnexures();
  console.log("Extraction Results:", JSON.stringify(extractRes, null, 2));

  const totalExtractedRows = await AnnexureRecord.countDocuments({});
  console.log(`FINAL TOTAL EXTRACTED ANNEXURE ROWS IN DB = ${totalExtractedRows}`);

  process.exit(0);
}

main().catch(err => {
  console.error("Full Crawl Error:", err);
  process.exit(1);
});
