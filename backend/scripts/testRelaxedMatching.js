import { connectDB } from "../config/db.js";
import { DriveFile } from "../models/driveFileModel.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

export function isAnnexureCandidateRelaxed(fileName, mimeType) {
  if (!fileName) return false;
  const name = String(fileName).trim().toLowerCase();

  // Reject non-excel extensions
  if (name.endsWith(".pdf") || name.endsWith(".txt") || name.endsWith(".docx") || name.endsWith(".doc") || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return false;
  }

  // Reject non-excel mimeTypes
  if (mimeType && (mimeType.includes("pdf") || mimeType.includes("text/plain") || mimeType.includes("image"))) {
    return false;
  }

  const isExcelExt = name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv");
  const isGSheet = mimeType === "application/vnd.google-apps.spreadsheet" || mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || mimeType === "application/vnd.ms-excel";

  if (!isExcelExt && !isGSheet) return false;

  // Reject draft upload files strictly (e.g. 1st & 2nd Upload.xlsx)
  if ((name.includes("1st") || name.includes("2nd") || name.includes("upload")) && !name.includes("annex")) {
    return false;
  }

  // Reject generic "untitled spreadsheet" unless no other excel exists
  if (name.includes("untitled spreadsheet")) {
    return false;
  }

  return true;
}

async function main() {
  await connectDB();
  const files = await DriveFile.find({}).lean();

  let accepted = 0;
  let rejectedUpload = 0;
  let rejectedOther = 0;

  const acceptedNames = {};
  const rejectedNames = {};

  for (const f of files) {
    const isCand = isAnnexureCandidateRelaxed(f.name, f.mimeType);
    if (isCand) {
      accepted++;
      acceptedNames[f.name] = (acceptedNames[f.name] || 0) + 1;
    } else {
      const name = String(f.name).toLowerCase();
      if (name.includes("upload") || name.includes("1st")) {
        rejectedUpload++;
      } else {
        rejectedOther++;
      }
      rejectedNames[f.name] = (rejectedNames[f.name] || 0) + 1;
    }
  }

  console.log(`TOTAL DRIVE FILES = ${files.length}`);
  console.log(`ACCEPTED ANNEXURE CANDIDATES = ${accepted}`);
  console.log(`REJECTED UPLOAD/DRAFT FILES = ${rejectedUpload}`);
  console.log(`REJECTED NON-EXCEL/OTHER FILES = ${rejectedOther}`);

  console.log("\nTop Accepted Annexure Candidate File Names:");
  const sortedAcc = Object.entries(acceptedNames).sort((a, b) => b[1] - a[1]);
  for (const [name, count] of sortedAcc.slice(0, 30)) {
    console.log(` ${count.toString().padStart(4, " ")}x | "${name}"`);
  }

  console.log("\nTop Rejected File Names:");
  const sortedRej = Object.entries(rejectedNames).sort((a, b) => b[1] - a[1]);
  for (const [name, count] of sortedRej.slice(0, 20)) {
    console.log(` ${count.toString().padStart(4, " ")}x | "${name}"`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
