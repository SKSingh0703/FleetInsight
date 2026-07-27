import { connectDB } from "../config/db.js";
import { AnnexureRecord } from "../models/annexureRecordModel.js";
import { DriveFile } from "../models/driveFileModel.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function check() {
  await connectDB();
  console.log("Connected to MongoDB");

  // Check if Bill NPMT/319/26-27 exists in AnnexureRecord
  const bill319 = await AnnexureRecord.find({ billNumber: { $regex: /319/i } }).lean();
  console.log(`Annexure records for Bill 319: count = ${bill319.length}`);
  if (bill319.length > 0) {
    console.log("Sample Bill 319 record:", {
      billNumber: bill319[0].billNumber,
      invoiceNumber: bill319[0].invoiceNumber,
      deliveryNumber: bill319[0].deliveryNumber,
      fileName: bill319[0].fileName,
    });
  }

  // Check if 911052339 or 2146560313 exists in AnnexureRecord
  const delSearch = await AnnexureRecord.find({
    $or: [
      { deliveryNumber: "911052339" },
      { invoiceNumber: "2146560313" },
      { deliveryNumber: "0911052339" },
    ]
  }).lean();
  console.log(`Search for 911052339 / 2146560313: matches = ${delSearch.length}`);

  // Check DriveFile for any Excel file with 319 in name or folder
  const driveFiles319 = await DriveFile.find({
    $or: [
      { name: { $regex: /319/i } },
      { billFolderPath: { $regex: /319/i } },
    ]
  }).lean();
  console.log("Drive files for 319:", driveFiles319.map(f => ({ fileId: f.fileId, name: f.name, status: f.extractionStatus })));

  process.exit(0);
}

check(); 
