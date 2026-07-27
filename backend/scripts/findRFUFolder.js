import { connectDB } from "../config/db.js";
import { DriveFile } from "../models/driveFileModel.js";
import { DriveFolder } from "../models/driveFolderModel.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function check() {
  await connectDB();

  const folders = await DriveFolder.find({ name: { $regex: /260715|715/i } }).lean();
  console.log("Matching Drive folders for 260715:", folders.map(f => ({ id: f.folderId, name: f.name, path: f.folderPath })));

  const files = await DriveFile.find({ name: { $regex: /260715|715/i } }).lean();
  console.log("Matching Drive files for 260715:", files.map(f => ({ name: f.name, path: f.billFolderPath })));

  process.exit(0);
}

check();
