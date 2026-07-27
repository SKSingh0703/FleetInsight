import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "../config/db.js";
import { DriveFile } from "../models/driveFileModel.js";
import { AnnexureRecord } from "../models/annexureRecordModel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  await connectDB();
  const totalAnnexures = await AnnexureRecord.countDocuments({});
  const successFiles = await DriveFile.countDocuments({ isAnnexureCandidate: true, extractionStatus: "SUCCESS" });
  const failedFiles = await DriveFile.countDocuments({ isAnnexureCandidate: true, extractionStatus: "FAILED" });
  const pendingFiles = await DriveFile.countDocuments({ isAnnexureCandidate: true, extractionStatus: "PENDING" });

  console.log({
    totalAnnexureRowsExtracted: totalAnnexures,
    successFiles,
    failedFiles,
    pendingFiles,
  });

  const sample = await AnnexureRecord.findOne({}).lean();
  if (sample) {
    console.log("Sample extracted AnnexureRecord:", {
      billNumber: sample.billNumber,
      vehicleNumber: sample.vehicleNumber,
      invoiceNumber: sample.invoiceNumber,
      deliveryNumber: sample.deliveryNumber,
      lrNumber: sample.lrNumber,
      consignorName: sample.consignorName,
      totalAmount: sample.totalAmount,
      fileName: sample.fileName,
      headerMapping: sample.headerMapping,
    });
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
