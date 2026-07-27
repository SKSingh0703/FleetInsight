import { google } from "googleapis";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

function readServiceAccountJson() {
  const envEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const envKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  if (typeof envEmail === "string" && envEmail.trim() && typeof envKey === "string" && envKey.trim()) {
    return {
      client_email: envEmail.trim(),
      private_key: envKey.includes("\\n") ? envKey.replace(/\\n/g, "\n") : envKey,
    };
  }

  const b64 = process.env.GOOGLE_SHEETS_SA_JSON_BASE64;
  const raw = process.env.GOOGLE_SHEETS_SA_JSON;

  const jsonText = (() => {
    if (typeof b64 === "string" && b64.trim()) {
      return Buffer.from(b64.trim(), "base64").toString("utf-8");
    }
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    return "";
  })();

  if (!jsonText) {
    throw new Error("Missing service account credentials");
  }

  const parsed = JSON.parse(jsonText);
  return parsed;
}

async function testDrive() {
  const sa = readServiceAccountJson();
  console.log("Service Account email:", sa.client_email);

  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  const drive = google.drive({ version: "v3", auth });
  const folderId = process.env.GOOGLE_DRIVE_BILL_FOLDER_ID || "1P4jxfnN6Uo_bhpONtpDwVqaAla303oL7";

  console.log("Testing access to folder:", folderId);

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size, md5Checksum)",
    pageSize: 20,
  });

  console.log("Found items:", res.data.files?.length);
  for (const f of res.data.files || []) {
    console.log(`- [${f.mimeType === "application/vnd.google-apps.folder" ? "FOLDER" : "FILE"}] ${f.name} (id: ${f.id})`);
  }
}

testDrive().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
