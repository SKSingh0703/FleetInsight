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

function createAuth() {
  const sa = readServiceAccountJson();
  return new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

export async function listSpreadsheetTabs(spreadsheetId) {
  const auth = createAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
    fields: "sheets(properties(title))",
  });

  const tabs = (res.data?.sheets || [])
    .map((s) => s?.properties?.title)
    .filter((t) => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.trim());

  return tabs;
}

const MONTHS = [
  { idx: 0, keys: ["JAN", "JANUARY"] },
  { idx: 1, keys: ["FEB", "FEBRUARY"] },
  { idx: 2, keys: ["MAR", "MARCH"] },
  { idx: 3, keys: ["APR", "APRIL"] },
  { idx: 4, keys: ["MAY"] },
  { idx: 5, keys: ["JUN", "JUNE"] },
  { idx: 6, keys: ["JUL", "JULY"] },
  { idx: 7, keys: ["AUG", "AUGUST"] },
  { idx: 8, keys: ["SEP", "SEPT", "SEPTEMBER"] },
  { idx: 9, keys: ["OCT", "OCTOBER"] },
  { idx: 10, keys: ["NOV", "NOVEMBER"] },
  { idx: 11, keys: ["DEC", "DECEMBER"] },
];

function normalizeTitle(title) {
  return String(title || "")
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseYearToken(title) {
  const t = normalizeTitle(title);
  const m4 = t.match(/\b(20\d{2})\b/);
  if (m4) return Number(m4[1]);

  const m2 = t.match(/\b(\d{2})\b/);
  if (m2) {
    const yy = Number(m2[1]);
    if (yy >= 0 && yy <= 99) return 2000 + yy;
  }

  return null;
}

function parseMonthIndex(title) {
  const t = normalizeTitle(title);
  for (const m of MONTHS) {
    for (const k of m.keys) {
      if (t.includes(k)) return m.idx;
    }
  }
  return null;
}

function scoreTabForMonthYear(title, monthIdx, year) {
  const t = normalizeTitle(title);
  const y = parseYearToken(t);
  const m = parseMonthIndex(t);

  if (m == null) return -1;

  let score = 0;
  if (m === monthIdx) score += 50;
  if (y === year) score += 30;
  if (y == null) score += 5;

  // prefer cleaner titles
  score -= Math.max(0, t.length - 15) * 0.1;

  return score;
}

function monthYearFor(date) {
  const d = date instanceof Date ? date : new Date();
  return { monthIdx: d.getMonth(), year: d.getFullYear() };
}

export function suggestCurrentAndPreviousTabs(tabTitles, now = new Date()) {
  const titles = Array.isArray(tabTitles) ? tabTitles : [];
  const cur = monthYearFor(now);
  const prevDate = new Date(Date.UTC(cur.year, cur.monthIdx - 1, 1));
  const prev = monthYearFor(prevDate);

  const pick = ({ monthIdx, year }) => {
    let best = null;
    let bestScore = -Infinity;
    for (const t of titles) {
      const s = scoreTabForMonthYear(t, monthIdx, year);
      if (s > bestScore) {
        bestScore = s;
        best = t;
      }
    }
    return bestScore > 0 ? best : null;
  };

  const currentTab = pick(cur);
  const previousTab = pick(prev);

  return {
    current: currentTab,
    previous: previousTab,
    meta: { cur, prev },
  };
}
