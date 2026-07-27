import { connectDB } from "../config/db.js";
import { scanAllDriveFolderTrees } from "../services/driveScannerService.js";
import { processAllPendingAnnexures } from "../services/annexureExtractorService.js";
import { AnnexureRecord } from "../models/annexureRecordModel.js";
import { DriveFolder } from "../models/driveFolderModel.js";
import { DriveFile } from "../models/driveFileModel.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  await connectDB();
  console.log("Connected to MongoDB. Scanning ALL connected root Drive folders (2026-27 & 2025-26)...");

  const scanResults = await scanAllDriveFolderTrees();
  console.log("Drive Trees Scanned:", scanResults);

  console.log("Extracting all pending Annexure files into DB...");
  const extractResult = await processAllPendingAnnexures();
  console.log("Extraction Finished:", extractResult);

  const totalFolders = await DriveFolder.countDocuments({});
  const totalBillFolders = await DriveFolder.countDocuments({ isBillFolder: true });
  const totalFiles = await DriveFile.countDocuments({});
  const totalExtracted = await AnnexureRecord.countDocuments({});

  console.log(`SUMMARY: Total Folders = ${totalFolders}, Bill Folders = ${totalBillFolders}, Total Files = ${totalFiles}, Extracted Rows = ${totalExtracted}`);

  process.exit(0);
}

main().catch(err => {
  console.error("Multi-Drive Scan Error:", err);
  process.exit(1);
});
