const DEFAULT_RATE_PER_TON = 250;

function normalizeHeader(header) {
  if (header == null) return "";
  return String(header)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9./ ]+/g, "")
    .replace(/\.+/g, ".");
}

export function normalizeHeaderKey(header) {
  return normalizeHeader(header);
}

export function buildNormalizedRow(rawRow) {
  const out = {};
  for (const [key, value] of Object.entries(rawRow || {})) {
    const nk = normalizeHeader(key);
    if (!nk) continue;
    if (out[nk] == null || String(out[nk]).trim() === "") out[nk] = value;
  }
  return out;
}

function buildHeaderIndex(rawRow) {
  const index = new Map();
  for (const [key, value] of Object.entries(rawRow || {})) {
    const nk = normalizeHeader(key);
    if (!nk) continue;
    if (!index.has(nk)) index.set(nk, { originalKey: key, value });
  }
  return index;
}

function getFirstValue(rawRow, aliases) {
  const idx = buildHeaderIndex(rawRow);
  for (const alias of aliases) {
    const n = normalizeHeader(alias);
    const hit = idx.get(n);
    if (hit && hit.value != null && String(hit.value).trim() !== "") return hit.value;
  }
  return undefined;
}

function getAllValues(rawRow, aliases) {
  const idx = buildHeaderIndex(rawRow);
  const values = [];
  for (const alias of aliases) {
    const n = normalizeHeader(alias);
    const hit = idx.get(n);
    if (hit && hit.value != null && String(hit.value).trim() !== "") values.push(hit.value);
  }
  return values;
}

function toNumber(value, { defaultValue = 0 } = {}) {
  if (value == null) return defaultValue;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = String(value).trim();
  if (!s) return defaultValue;
  const cleaned = s.replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : defaultValue;
}

function toUpperToken(value) {
  if (value == null) return "";
  return String(value).trim().toUpperCase();
}

function normalizeTripType(value) {
  const t = toUpperToken(value);
  if (t.includes("MARK")) return "MARKET";
  if (t.includes("OWN")) return "OWN";
  return "";
}

function normalizePartyType(value) {
  const t = toUpperToken(value);
  if (t.includes("TPT")) return "TPT";
  if (t.includes("LOG")) return "LOGISTICS";
  if (!t) return "OTHER";
  return "OTHER";
}

function toDate(value) {
  if (value == null || value === "") return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === "number") {
    // Excel serial date (days since 1899-12-30)
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + value * 24 * 60 * 60 * 1000);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  const s = String(value).trim();
  if (!s) return undefined;

  // Prefer explicit day-first parsing for common sheet formats (avoids runtime-dependent parsing).
  // Supports: dd.mm.yyyy, dd/mm/yyyy, dd-mm-yyyy, and also 1/3/26.
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    let yy = Number(m[3]);
    if (yy < 100) yy += 2000;
    const d = new Date(Date.UTC(yy, mm - 1, dd));
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  // ISO-like formats are safe to delegate to Date.
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  return undefined;
}

export const COLUMN_ALIASES = {
  sno: [
    "S.NO.",
    "S.NO",
    "S. NO.",
    "S. NO",
    "S NO",
    "SNO",
    "SR NO",
    "SR. NO.",
    "SR.NO",
    "SERIAL NO",
    "SERIAL NO.",
    "SERIAL NUMBER",
  ],
  invoiceNumber: [
    "INVOICE NO.",
    "INVOICE NO",
    "INVOICE",
    "INVOICE NUMBER",
    "INV NO",
    "INV.NO",
    "INV.NO.",
    "invoiceNumber",
  ],
  chassisNumber: [
    "CH.NO.",
    "CH NO",
    "CHASSIS",
    "CHASSIS NO",
    "CHASSIS NO.",
    "CHASSIS NUMBER",
    "chassisNumber",
  ],
  vehicleNumber: [
    "V.NO.",
    "V.NO",
    "V. NO.",
    "V. NO",
    "VNO",
    "V NO",
    "VEHICLE",
    "VEHICLE NO",
    "VEHICLE NO.",
    "VEHICLE NUMBER",
    "vehicleNumber",
  ],
  tripType: ["OWN/MARKET", "OWN MARKET", "TRIP TYPE", "TYPE", "tripType"],
  bookNumber: ["BOOK No.", "BOOK NO", "BOOK", "bookNumber"],

  loadingDate: ["L.Date", "L DATE", "LOADING DATE", "LOAD DATE"],
  unloadingDate: ["U.Date", "U DATE", "UNLOADING DATE", "UNLOAD DATE"],

  loadingPoint: ["L.Point", "L POINT", "LOADING POINT", "L.POINT"],
  unloadingPoint: ["U.Point", "U POINT", "UNLOADING POINT", "U.POINT"],

  loadingWeight: ["L.Weight", "L WEIGHT", "LOADING WEIGHT", "LOAD WEIGHT"],
  unloadingWeight: ["U.Weight", "U WEIGHT", "UNLOADING WEIGHT", "UNLOAD WEIGHT"],

  ratePerTon: ["RATE", "RATE/TON", "RATE PER TON", "ratePerTon"],

  cash1: ["CASH(P)", "CASH P", "CASH"],
  cash2: ["CASH(P/C/O)", "CASH P/C/O", "CASH PCO"],
  diesel: ["DIESEL(P)", "DIESEL P", "DIESEL"],
  other: ["C.DETAILS", "C DETAILS", "DETAILS", "OTHER", "EXPENSE", "EXPENSES"],

  totalAdvance: ["TOTAL ADV.", "TOTAL ADV", "ADVANCE", "TOTAL ADVANCE"],

  party: ["PARTY.", "PARTY", "PARTY TYPE", "partyType"],
  partyName: ["PARTY NAME", "PARTY NAME.", "PARTYNAME", "CUSTOMER", "CUSTOMER NAME"],

  challanDate: ["CHALLAN DATE", "CHALAN DATE", "CHALLAN DT", "CHALAN DT"],
  challanNumber: ["CHALLAN", "CHALAN", "CHALLAN NO", "CHALAN NO", "CHALLAN NO.", "CHALAN NO."],
  billNumber: ["BILL NO.", "BILL NO", "BILL", "BILL NUMBER"],
  billDate: ["BILL DATE", "BILL DT", "BILL DT.", "BILLDATE"],
  marketPaymentDate: ["MARKET PAYMENT DATE", "MKT PAYMENT DATE", "MARKET PAY DATE", "PAYMENT DATE"],
  bank: ["BANK", "BANK NAME"],
  account: ["ACCT", "ACCT.", "ACCOUNT", "A/C", "A/C NO", "ACCOUNT NO"],
  amount: ["AMT.", "AMT", "AMOUNT"],
  detailsText: ["DETAILS", "DETAIL", "NARRATION", "REMARK", "REMARKS"],
};

export function extractTripFields(rawRow) {
  const invoiceNumber = getFirstValue(rawRow, COLUMN_ALIASES.invoiceNumber);
  const chassisNumber = getFirstValue(rawRow, COLUMN_ALIASES.chassisNumber);
  const vehicleNumber = getFirstValue(rawRow, COLUMN_ALIASES.vehicleNumber);

  const tripTypeRaw = getFirstValue(rawRow, COLUMN_ALIASES.tripType);
  const bookNumber = getFirstValue(rawRow, COLUMN_ALIASES.bookNumber);

  const normalizedTripType = normalizeTripType(tripTypeRaw);
  const tripType = (() => {
    // Priority 1: explicit OWN/MARKET column (if present and valid)
    if (normalizedTripType) return normalizedTripType;

    // Priority 2: infer from book number
    const bn = bookNumber != null ? String(bookNumber).trim() : "";
    return bn ? "MARKET" : "OWN";
  })();

  const loadingDate = toDate(getFirstValue(rawRow, COLUMN_ALIASES.loadingDate));
  const unloadingDate = toDate(getFirstValue(rawRow, COLUMN_ALIASES.unloadingDate));

  const loadingPoint = getFirstValue(rawRow, COLUMN_ALIASES.loadingPoint);
  const unloadingPoint = getFirstValue(rawRow, COLUMN_ALIASES.unloadingPoint);

  const loadingWeightTons = toNumber(getFirstValue(rawRow, COLUMN_ALIASES.loadingWeight), {
    defaultValue: 0,
  });
  const unloadingWeightTons = toNumber(getFirstValue(rawRow, COLUMN_ALIASES.unloadingWeight), {
    defaultValue: 0,
  });

  const ratePerTon = (() => {
    const r = toNumber(getFirstValue(rawRow, COLUMN_ALIASES.ratePerTon), {
      defaultValue: DEFAULT_RATE_PER_TON,
    });
    return r > 0 ? r : DEFAULT_RATE_PER_TON;
  })();

  const cashPValues = getAllValues(rawRow, COLUMN_ALIASES.cash1);
  const cashPCOValues = getAllValues(rawRow, COLUMN_ALIASES.cash2);
  const cashP = cashPValues.reduce((sum, v) => sum + toNumber(v, { defaultValue: 0 }), 0);
  const cashPCO = cashPCOValues.reduce((sum, v) => sum + toNumber(v, { defaultValue: 0 }), 0);
  const cash = cashP + cashPCO;

  const dieselValues = getAllValues(rawRow, COLUMN_ALIASES.diesel);
  const diesel = dieselValues.reduce(
    (sum, v) => sum + toNumber(v, { defaultValue: 0 }),
    0
  );

  const otherValues = getAllValues(rawRow, COLUMN_ALIASES.other);
  const other = otherValues.reduce(
    (sum, v) => sum + toNumber(v, { defaultValue: 0 }),
    0
  );

  const totalAdvance = toNumber(getFirstValue(rawRow, COLUMN_ALIASES.totalAdvance), { defaultValue: 0 });

  const partyType = normalizePartyType(getFirstValue(rawRow, COLUMN_ALIASES.party));
  const partyName = getFirstValue(rawRow, COLUMN_ALIASES.partyName);

  const challanDate = toDate(getFirstValue(rawRow, COLUMN_ALIASES.challanDate));
  const challanNumber = getFirstValue(rawRow, COLUMN_ALIASES.challanNumber);
  const billNumber = getFirstValue(rawRow, COLUMN_ALIASES.billNumber);
  const billDate = toDate(getFirstValue(rawRow, COLUMN_ALIASES.billDate));
  const marketPaymentDate = toDate(getFirstValue(rawRow, COLUMN_ALIASES.marketPaymentDate));
  const bank = getFirstValue(rawRow, COLUMN_ALIASES.bank);
  const account = getFirstValue(rawRow, COLUMN_ALIASES.account);
  const amount = toNumber(getFirstValue(rawRow, COLUMN_ALIASES.amount), { defaultValue: 0 });
  const detailsText = getFirstValue(rawRow, COLUMN_ALIASES.detailsText);

  return {
    invoiceNumber,
    chassisNumber,
    vehicleNumber,
    tripType,
    bookNumber,
    loadingDate,
    unloadingDate,
    loadingPoint,
    unloadingPoint,
    loadingWeightTons,
    unloadingWeightTons,
    ratePerTon,
    expenses: { cash, diesel, other },
    extensions: {
      totalAdvance,
      expensesBreakdown: {
        cashP,
        cashPCO,
        diesel,
        other,
        otherRaw: otherValues,
      },
      challanDate,
      challanNumber,
      billNumber,
      billDate,
      marketPaymentDate,
      bank,
      account,
      amount,
      detailsText,
    },
    partyType,
    partyName,
  };
}

export function computeTotalFreight({ unloadingWeightTons, ratePerTon }) {
  const w = Number.isFinite(unloadingWeightTons) ? unloadingWeightTons : 0;
  const r = Number.isFinite(ratePerTon) ? ratePerTon : DEFAULT_RATE_PER_TON;
  return w * r;
}

export function getDefaultRatePerTon() {
  return DEFAULT_RATE_PER_TON;
}
