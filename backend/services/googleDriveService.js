import { google } from "googleapis";

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
    throw new Error(
      "Missing Google credentials (GOOGLE_SHEETS_SA_JSON_BASE64 or GOOGLE_SHEETS_CLIENT_EMAIL)"
    );
  }

  const parsed = JSON.parse(jsonText);
  if (!parsed?.client_email || !parsed?.private_key) {
    throw new Error("Invalid service account JSON (missing client_email/private_key)");
  }
  return parsed;
}

export function createDriveClient() {
  const sa = readServiceAccountJson();
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  return google.drive({ version: "v3", auth });
}

export async function listFolderContents(folderId) {
  const drive = createDriveClient();
  const items = [];
  let pageToken = undefined;

  const q = `'${folderId}' in parents and trashed = false`;

  do {
    try {
      const res = await drive.files.list({
        q,
        fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size, md5Checksum, parents, shortcutDetails)",
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const files = Array.isArray(res.data?.files) ? res.data.files : [];
      for (const f of files) {
        if (f.mimeType === "application/vnd.google-apps.shortcut" && f.shortcutDetails?.targetId) {
          items.push({
            ...f,
            id: f.shortcutDetails.targetId,
            mimeType: f.shortcutDetails.targetMimeType || f.mimeType,
          });
        } else {
          items.push(f);
        }
      }
      pageToken = res.data?.nextPageToken || undefined;
    } catch (err) {
      if (err?.message?.includes("Google Drive API has not been used") || err?.code === 403) {
        throw new Error(
          `Google Drive API is disabled in your Google Cloud Console. Enable it at: https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=242773855902`
        );
      }
      throw err;
    }
  } while (pageToken);

  return items;
}

export async function downloadFileBuffer(fileId, mimeType) {
  const drive = createDriveClient();

  if (mimeType === "application/vnd.google-apps.spreadsheet") {
    const res = await drive.files.export(
      { fileId, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      { responseType: "arraybuffer" }
    );
    return Buffer.from(res.data);
  }

  try {
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );
    return Buffer.from(res.data);
  } catch (err) {
    if (err?.message?.includes("export") || err?.code === 400) {
      const res = await drive.files.export(
        { fileId, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
        { responseType: "arraybuffer" }
      );
      return Buffer.from(res.data);
    }
    throw err;
  }
}
