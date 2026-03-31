import { google } from "googleapis";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableSheetsError(err) {
  const status = err?.response?.status;
  const code = err?.code;
  if (status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  if (code === "ETIMEDOUT" || code === "ECONNRESET" || code === "EAI_AGAIN") return true;
  return false;
}

async function withRetry(fn, { retries = 4, baseDelayMs = 500, maxDelayMs = 10_000 } = {}) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > retries || !isRetryableSheetsError(err)) throw err;
      const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * Math.min(250, exp));
      await sleep(exp + jitter);
    }
  }
}

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
      "Missing GOOGLE_SHEETS_CLIENT_EMAIL/GOOGLE_SHEETS_PRIVATE_KEY or GOOGLE_SHEETS_SA_JSON_BASE64/GOOGLE_SHEETS_SA_JSON"
    );
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

  const res = await withRetry(() => {
    return sheets.spreadsheets.values.get({
      spreadsheetId,
      range: fullRange,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
  });

  const values = Array.isArray(res.data?.values) ? res.data.values : [];
  return values;
}
