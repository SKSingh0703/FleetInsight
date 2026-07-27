import { connectDB } from "../config/db.js";
import { DriveFile } from "../models/driveFileModel.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  await connectDB();
  console.log("Connected to MongoDB.");

  // Get all Excel / GSheet files
  const files = await DriveFile.find({}).lean();
  console.log(`Total Drive files in DB = ${files.length}`);

  const excelFiles = files.filter((f) => {
    const name = String(f.name || "").trim().toLowerCase();
    if (name.endsWith(".pdf") || name.endsWith(".txt") || name.endsWith(".docx") || name.endsWith(".doc") || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
      return false;
    }
    const isExcelExt = name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv");
    const isGSheet = f.mimeType === "application/vnd.google-apps.spreadsheet" || f.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || f.mimeType === "application/vnd.ms-excel";
    return isExcelExt || isGSheet;
  });

  console.log(`Total Excel/GSheet files in DB = ${excelFiles.length}`);

  // Count frequencies of Excel file names
  const nameCounts = {};
  for (const f of excelFiles) {
    const name = String(f.name).trim();
    nameCounts[name] = (nameCounts[name] || 0) + 1;
  }

  // Sort by count descending
  const sortedNames = Object.entries(nameCounts).sort((a, b) => b[1] - a[1]);

  console.log("\nTop 50 Most Common Excel File Names across all Bill Folders:");
  console.log("==============================================================");
  for (const [name, count] of sortedNames.slice(0, 50)) {
    console.log(`${count.toString().padStart(4, " ")}x | "${name}"`);
  }

  console.log("\nSample 100 Random Excel File Names across all Bill Folders:");
  console.log("==============================================================");
  for (const [name] of sortedNames.slice(50, 150)) {
    console.log(`     | "${name}"`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error analyzing Excel file names:", err);
  process.exit(1);
});
