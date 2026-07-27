import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "../config/db.js";
import { DriveFile } from "../models/driveFileModel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function inspect() {
  await connectDB();
  const candidates = await DriveFile.find({ isAnnexureCandidate: true }).lean();
  console.log("Total Annexure Candidates in DB:", candidates.length);

  const mimeTypes = {};
  const extensions = {};
  const nonExcelNames = [];

  for (const f of candidates) {
    const mt = f.mimeType || "unknown";
    mimeTypes[mt] = (mimeTypes[mt] || 0) + 1;

    const ext = path.extname(f.name).toLowerCase() || "(no ext)";
    extensions[ext] = (extensions[ext] || 0) + 1;

    const isExcelExt = ext === ".xlsx" || ext === ".xls" || ext === ".csv";
    const isGSheet = mt === "application/vnd.google-apps.spreadsheet";

    if (!isExcelExt && !isGSheet) {
      nonExcelNames.push({ name: f.name, mimeType: mt });
    }
  }

  console.log("MimeTypes breakdown:", mimeTypes);
  console.log("Extensions breakdown:", extensions);
  console.log("Non-Excel files found in candidate list:", nonExcelNames.length);

  if (nonExcelNames.length > 0) {
    console.log("Sample non-excel candidates:", nonExcelNames.slice(0, 10));
  }

  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
