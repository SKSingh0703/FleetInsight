const DEFAULT_RATE_PER_TON = 250;

const DEFAULT_JHARKHAND_DIESEL_PRICE_PER_LITER = 93.5;

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

  const tryParsePlusSum = (expr) => {
    const normalized = String(expr).replace(/\s+/g, "");
    if (!normalized.includes("+")) return undefined;
    if (!/^[0-9+.-]+$/.test(normalized)) return undefined;
    const parts = normalized.split("+").filter((p) => p.length > 0);
    if (parts.length < 2) return undefined;
    const nums = parts.map((p) => Number(p));
    if (nums.some((n) => !Number.isFinite(n))) return undefined;
    return nums.reduce((sum, n) => sum + n, 0);
  };

  const sumValue = tryParsePlusSum(cleaned);
  if (typeof sumValue === "number" && Number.isFinite(sumValue)) return sumValue;

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : defaultValue;
}

function parseDieselCost(value) {
  if (value == null) return 0;

  // If explicitly marked as liters (e.g. "20 LTR"), treat as liters.
  const s = typeof value === "string" ? value.trim() : "";
  if (s) {
    const normalized = s.toLowerCase().replace(/\s+/g, " ");
    const hasLitersUnit = /\b(ltr|litre|liter|liters|litres|l)\b/.test(normalized);
    if (hasLitersUnit) {
      const m = normalized.match(/-?\d+(?:\.\d+)?/);
      const liters = m ? Number(m[0]) : Number.NaN;
      if (Number.isFinite(liters) && liters >= 0) return liters * DEFAULT_JHARKHAND_DIESEL_PRICE_PER_LITER;
      return 0;
    }
  }

  // Otherwise parse as numeric. If it's a small number, assume it is liters.
  const n = toNumber(value, { defaultValue: 0 });
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 0 && n <= 300) return n * DEFAULT_JHARKHAND_DIESEL_PRICE_PER_LITER;
  return n;
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
  deliveryNumber: [
    "DELIVERY NO.",
    "DELIVERY NO",
    "DELIVERY",
    "DELIVERY NUMBER",
    "DEL NO",
    "DEL.NO",
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
  marketVehicleBookNumber: [
    "MARKET VEHICLE BOOK No.",
    "MARKET VEHICLE BOOK NO.",
    "MARKET VEHICLE BOOK NO",
    "MARKET VEHICLE BOOK",
    "BOOK No.",
    "BOOK NO",
    "BOOK",
    "bookNumber",
  ],

  tripNumber: ["TRIP NO.", "TRIP NO", "TRIP NUMBER", "TRIP"],

  loadingDate: ["L.Date", "L DATE", "LOADING DATE", "LOAD DATE"],
  unloadingDate: ["U.Date", "U DATE", "UNLOADING DATE", "UNLOAD DATE"],

  loadingPoint: ["L.Point", "L POINT", "LOADING POINT", "L.POINT"],
  unloadingPoint: ["U.Point", "U POINT", "UNLOADING POINT", "U.POINT"],

  loadingWeight: ["L.Weight", "L WEIGHT", "LOADING WEIGHT", "LOAD WEIGHT"],
  unloadingWeight: ["U.Weight", "U WEIGHT", "UNLOADING WEIGHT", "UNLOAD WEIGHT"],

  shortageTons: ["SHORTAGE", "SHORTAGE(T)", "SHORTAGE T", "SHORT"],

  ratePerTon: ["RATE", "RATE/TON", "RATE PER TON", "ratePerTon"],

  totalFreight: ["T.F.", "T.F", "TF", "TOTAL FREIGHT", "FREIGHT"],

  cash: ["CASH", "CASH(P)", "CASH P", "CASH(P/C/O)", "CASH P/C/O", "CASH PCO"],
  cardAccount: ["CARD/ACCOUNT", "CARD ACCOUNT", "CARD", "ACCOUNT"],
  cashDate: ["CASH DATE", "CASH DT", "CASH DT."],

  diesel: ["DIESEL", "DIESEL(P)", "DIESEL P"],
  pumpCard: ["PUMP/CARD", "PUMP CARD", "PUMP", "DIESEL CARD"],
  dieselDate: ["DIESEL DATE", "DIESEL DT", "DIESEL DT."],

  fastag: ["FASTAG"],
  fastagDate: ["FASTAG DATE", "FASTAG DT", "FASTAG DT."],

  otherExpenses: ["OTHER", "OTHER EXP", "OTHER EXPENSE", "OTHER EXPENSES"],

  totalAdvance: ["TOTAL ADV.", "TOTAL ADV", "ADVANCE", "TOTAL ADVANCE"],

  party: ["OTHER", "PARTY.", "PARTY", "PARTY TYPE", "partyType"],
  partyOtherName: ["OTHER TPT.", "OTHER TPT", "OTHER TPT NAME", "OTHER PARTY", "OTHER PARTY NAME"],
  partyName: ["PARTY NAME", "PARTY NAME.", "PARTYNAME", "CUSTOMER", "CUSTOMER NAME"],

  challanDate: ["CHALLAN DATE", "CHALAN DATE", "CHALLAN DT", "CHALAN DT"],
  billBookNumber: ["BILL BOOK NO.", "BILL BOOK NO", "BILL BOOK", "BILL NO.", "BILL NO", "BILL"],
  marketPaymentDate: ["MARKET PAYMENT DATE", "MKT PAYMENT DATE", "MARKET PAY DATE", "PAYMENT DATE"],
  remarks: ["REMARKS", "REMARK", "NARRATION"],
  tripStatus: ["TRIP STATUS", "STATUS"],
};

export function extractTripFields(rawRow) {
  const sno = getFirstValue(rawRow, COLUMN_ALIASES.sno);
  const invoiceNumber = getFirstValue(rawRow, COLUMN_ALIASES.invoiceNumber);
  const chassisNumber = getFirstValue(rawRow, COLUMN_ALIASES.chassisNumber);
  const deliveryNumber = getFirstValue(rawRow, COLUMN_ALIASES.deliveryNumber);
  const vehicleNumber = getFirstValue(rawRow, COLUMN_ALIASES.vehicleNumber);
  const tripNumber = getFirstValue(rawRow, COLUMN_ALIASES.tripNumber);

  const tripTypeRaw = getFirstValue(rawRow, COLUMN_ALIASES.tripType);
  const marketVehicleBookNumber = getFirstValue(rawRow, COLUMN_ALIASES.marketVehicleBookNumber);

  const normalizedTripType = normalizeTripType(tripTypeRaw);
  const tripType = normalizedTripType;

  const loadingDate = toDate(getFirstValue(rawRow, COLUMN_ALIASES.loadingDate));
  const unloadingDate = toDate(getFirstValue(rawRow, COLUMN_ALIASES.unloadingDate));

  const loadingPoint = getFirstValue(rawRow, COLUMN_ALIASES.loadingPoint);
  const unloadingPoint = getFirstValue(rawRow, COLUMN_ALIASES.unloadingPoint);

  const loadingWeightTons = toNumber(getFirstValue(rawRow, COLUMN_ALIASES.loadingWeight), {
    defaultValue: undefined,
  });
  const unloadingWeightTons = toNumber(getFirstValue(rawRow, COLUMN_ALIASES.unloadingWeight), {
    defaultValue: undefined,
  });

  const ratePerTon = toNumber(getFirstValue(rawRow, COLUMN_ALIASES.ratePerTon), {
    defaultValue: undefined,
  });

  const shortageTons = toNumber(getFirstValue(rawRow, COLUMN_ALIASES.shortageTons), { defaultValue: undefined });
  const totalFreight = toNumber(getFirstValue(rawRow, COLUMN_ALIASES.totalFreight), { defaultValue: undefined });

  const cash = toNumber(getFirstValue(rawRow, COLUMN_ALIASES.cash), { defaultValue: 0 });
  const cardAccount = getFirstValue(rawRow, COLUMN_ALIASES.cardAccount);
  const cashDate = toDate(getFirstValue(rawRow, COLUMN_ALIASES.cashDate));

  const diesel = parseDieselCost(getFirstValue(rawRow, COLUMN_ALIASES.diesel));
  const pumpCard = getFirstValue(rawRow, COLUMN_ALIASES.pumpCard);
  const dieselDate = toDate(getFirstValue(rawRow, COLUMN_ALIASES.dieselDate));

  const fastag = toNumber(getFirstValue(rawRow, COLUMN_ALIASES.fastag), { defaultValue: 0 });
  const fastagDate = toDate(getFirstValue(rawRow, COLUMN_ALIASES.fastagDate));

  const otherExpenses = toNumber(getFirstValue(rawRow, COLUMN_ALIASES.otherExpenses), { defaultValue: 0 });

  const totalAdvance = toNumber(getFirstValue(rawRow, COLUMN_ALIASES.totalAdvance), { defaultValue: 0 });

  const partyType = normalizePartyType(getFirstValue(rawRow, COLUMN_ALIASES.party));
  const partyOtherName = getFirstValue(rawRow, COLUMN_ALIASES.partyOtherName);
  const partyNameFallback = getFirstValue(rawRow, COLUMN_ALIASES.partyName);
  const partyName = (() => {
    if (partyType === "OTHER") {
      return partyOtherName ?? partyNameFallback;
    }
    if (partyType === "TPT" || partyType === "LOGISTICS") return partyType;
    return partyNameFallback;
  })();

  const challanDate = toDate(getFirstValue(rawRow, COLUMN_ALIASES.challanDate));
  const billBookNumber = getFirstValue(rawRow, COLUMN_ALIASES.billBookNumber);
  const marketPaymentDate = toDate(getFirstValue(rawRow, COLUMN_ALIASES.marketPaymentDate));
  const remarks = getFirstValue(rawRow, COLUMN_ALIASES.remarks);
  const tripStatus = getFirstValue(rawRow, COLUMN_ALIASES.tripStatus);

  return {
    sno,
    invoiceNumber,
    deliveryNumber,
    chassisNumber,
    vehicleNumber,
    tripType,
    marketVehicleBookNumber,
    tripNumber,
    loadingDate,
    unloadingDate,
    loadingPoint,
    unloadingPoint,
    loadingWeightTons,
    unloadingWeightTons,
    shortageTons,
    ratePerTon,
    totalFreight,
    cash,
    cardAccount,
    cashDate,
    diesel,
    pumpCard,
    dieselDate,
    fastag,
    fastagDate,
    totalAdvance,
    otherExpenses,
    partyType,
    partyName,
    challanDate,
    billBookNumber,
    marketPaymentDate,
    remarks,
    tripStatus,
  };
}

export function getDefaultRatePerTon() {
  return DEFAULT_RATE_PER_TON;
}
