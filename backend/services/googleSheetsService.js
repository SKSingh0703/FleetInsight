import { google } from "googleapis";

function readServiceAccountJson() {
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
    throw new Error("Missing GOOGLE_SHEETS_SA_JSON_BASE64 or GOOGLE_SHEETS_SA_JSON");
  }

  const parsed = JSON.parse(jsonText);
  if (!parsed?.client_email || !parsed?.private_key) {
    throw new Error("Invalid service account JSON (missing client_email/private_key)");
  }
  return parsed;
}

function createSheetsClient() {
  const sa = readServiceAccountJson();

  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
}

export async function fetchSheetValues({ spreadsheetId, tabName, range }) {
  const sheets = createSheetsClient();
  const r = range && String(range).trim() ? String(range).trim() : "A:AZ";
  const fullRange = `${tabName}!${r}`;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: fullRange,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const values = Array.isArray(res.data?.values) ? res.data.values : [];
  return values;
}
