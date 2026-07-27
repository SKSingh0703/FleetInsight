import { createDriveClient } from "../services/googleDriveService.js";
import { connectDB } from "../config/db.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  await connectDB();
  const drive = createDriveClient();

  const folderId = "1blzU74ahtix8bTSl6MpCjCSCG03lIVaG"; // All Bill 2025-26
  console.log(`Querying Drive API for 2025-26 folder ${folderId} with supportsAllDrives: true...`);

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size, md5Checksum, parents, shortcutDetails)",
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = res.data.files || [];
  console.log(`Retrieved ${files.length} items from 2025-26 folder.`);

  let shortcuts = 0;
  let folders = 0;
  let regularFiles = 0;

  for (const f of files) {
    if (f.mimeType === "application/vnd.google-apps.shortcut") shortcuts++;
    else if (f.mimeType === "application/vnd.google-apps.folder") folders++;
    else regularFiles++;
  }

  console.log({ shortcuts, folders, regularFiles });
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
