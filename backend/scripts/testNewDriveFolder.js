import { listFolderContents } from "../services/googleDriveService.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  const folderId = "1blzU74ahtix8bTSl6MpCjCSCG03lIVaG";
  console.log(`Listing contents for new 2025-26 Drive Folder: ${folderId}`);

  try {
    const contents = await listFolderContents(folderId);
    console.log(`Success! Retrieved ${contents.length} items from 2025-26 folder:`);
    console.log("Sample child items:", contents.slice(0, 10).map(item => ({
      id: item.id,
      name: item.name,
      mimeType: item.mimeType,
    })));
  } catch (err) {
    console.error("Failed to list folder contents:", err.message);
  }

  process.exit(0);
}

main().catch(err => console.error(err));
