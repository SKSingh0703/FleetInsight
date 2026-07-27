import { connectDB } from "../config/db.js";
import { AnnexureRecord } from "../models/annexureRecordModel.js";
import { DriveFile } from "../models/driveFileModel.js";
import { DriveFolder } from "../models/driveFolderModel.js";
import { scanAllDriveFolderTrees, isAnnexureCandidateName } from "../services/driveScannerService.js";
import { processAllPendingAnnexures } from "../services/annexureExtractorService.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  await connectDB();
  console.log("Connected to MongoDB.");

  console.log("1. Wiping polluted master AnnexureRecord database...");
  const deleteRes = await AnnexureRecord.deleteMany({});
  console.log(`Deleted ${deleteRes.deletedCount} old/polluted records from AnnexureRecord collection.`);

  console.log("2. Updating DriveFile records using candidate selection logic...");
  const allFiles = await DriveFile.find({}).lean();
  let candidateCount = 0;
  let skippedCount = 0;

  for (const f of allFiles) {
    const isCand = isAnnexureCandidateName(f.name, f.mimeType);

    if (isCand) {
      candidateCount++;
      await DriveFile.updateOne(
        { _id: f._id },
        { $set: { isAnnexureCandidate: true, extractionStatus: "PENDING", extractionError: "" } }
      );
    } else {
      skippedCount++;
      await DriveFile.updateOne(
        { _id: f._id },
        { $set: { isAnnexureCandidate: false, extractionStatus: "SKIPPED", extractionError: "" } }
      );
    }
  }
  console.log(`Updated DriveFiles: ${candidateCount} valid Annexure candidate files reset to PENDING. ${skippedCount} non-annexure files set to SKIPPED.`);

  console.log("3. Scanning drive folder trees across all connected roots...");
  const scanResults = await scanAllDriveFolderTrees();
  console.log("Drive scan results:", JSON.stringify(scanResults, null, 2));

  console.log("4. Extracting structured rows from all valid Annexure files...");
  const extractResult = await processAllPendingAnnexures();
  console.log("Extraction results:", JSON.stringify(extractResult, null, 2));

  const totalFolders = await DriveFolder.countDocuments({});
  const totalBillFolders = await DriveFolder.countDocuments({ isBillFolder: true });
  const totalFiles = await DriveFile.countDocuments({});
  const validAnnexureFiles = await DriveFile.countDocuments({ isAnnexureCandidate: true });
  const processedAnnexures = await DriveFile.countDocuments({ isAnnexureCandidate: true, extractionStatus: "SUCCESS" });
  const totalCleanExtractedRows = await AnnexureRecord.countDocuments({});

  console.log("==========================================");
  console.log("CLEAN MASTER DATABASE SYNC COMPLETE!");
  console.log(`- Total Folders: ${totalFolders}`);
  console.log(`- Bill Folders: ${totalBillFolders}`);
  console.log(`- Total Files: ${totalFiles}`);
  console.log(`- Valid Annexure Files: ${validAnnexureFiles}`);
  console.log(`- Successfully Processed Annexures: ${processedAnnexures}`);
  console.log(`- Total Clean Extracted Annexure Rows: ${totalCleanExtractedRows}`);
  console.log("==========================================");

  process.exit(0);
}

main().catch(err => {
  console.error("Clean & Sync Error:", err);
  process.exit(1);
});
