import { connectDB } from "../config/db.js";
import { AnnexureRecord } from "../models/annexureRecordModel.js";
import { DriveFile } from "../models/driveFileModel.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  await connectDB();
  const totalExtracted = await AnnexureRecord.countDocuments({});
  const totalCandidates = await DriveFile.countDocuments({ isAnnexureCandidate: true });
  const processedCount = await DriveFile.countDocuments({ isAnnexureCandidate: true, extractionStatus: "SUCCESS" });
  const failedCount = await DriveFile.countDocuments({ isAnnexureCandidate: true, extractionStatus: "FAILED" });
  const pendingCount = await DriveFile.countDocuments({ isAnnexureCandidate: true, extractionStatus: "PENDING" });

  console.log({ totalExtracted, totalCandidates, processedCount, failedCount, pendingCount });
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
