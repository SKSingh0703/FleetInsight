import { Trip } from "../models/tripModel.js";
import {
  buildComputedFieldsStage,
  buildSummaryGroupStage,
  buildSummaryProjectStage,
  emptySummary,
} from "./aggregationService.js";

import { normalizeVehicle } from "../utils/vehicleNormalization.js";

function toDateIfProvided(value) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function buildDateRangeQuery(fieldPath, dateRange) {
  if (!dateRange || typeof dateRange !== "object") return undefined;
  const from = toDateIfProvided(dateRange.from);
  const to = toDateIfProvided(dateRange.to);

  if (!from && !to) return undefined;

  const q = {};
  if (from) q.$gte = from;
  if (to) q.$lte = to;
  return { [fieldPath]: q };
}

function buildGenericTripDateRange(dateRange) {
  if (!dateRange || typeof dateRange !== "object") return undefined;
  const from = toDateIfProvided(dateRange.from);
  const to = toDateIfProvided(dateRange.to);
  if (!from && !to) return undefined;

  const q = {};
  if (from) q.$gte = from;
  if (to) q.$lte = to;

  return {
    $or: [{ loadingDate: q }, { unloadingDate: q }],
  };
}

function normalizeToken(v) {
  if (v == null) return "";
  return String(v).trim();
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLooseSpacingRegex(normalized) {
  const s = String(normalized || "");
  if (!s) return "";
  return s
    .split("")
    .map((ch) => escapeRegex(ch))
    .join("\\s*");
}

export function buildMatchFromFilters(filters) {
  const f = filters && typeof filters === "object" ? filters : {};
  const match = {};

  const and = [];

  const tripKey = normalizeToken(f.tripKey);
  if (tripKey) match.tripKey = tripKey;

  const invoiceNumber = normalizeToken(f.invoiceNumber);
  if (invoiceNumber) match.invoiceNumber = invoiceNumber;

  const deliveryNumber = normalizeToken(f.deliveryNumber);
  if (deliveryNumber) match.deliveryNumber = { $regex: escapeRegex(deliveryNumber), $options: "i" };

  const tripNumber = normalizeToken(f.tripNumber);
  if (tripNumber) match.tripNumber = { $regex: escapeRegex(tripNumber), $options: "i" };

  const chassisNumber = normalizeToken(f.chassisNumber);
  if (chassisNumber) match.chassisNumber = chassisNumber;

  const partyName = normalizeToken(f.partyName);
  if (partyName) {
    match.partyName = { $regex: escapeRegex(partyName), $options: "i" };
  }

  // Unified party filter (dynamic dropdown):
  // - If value is TPT/LOGISTICS/OTHER => filter by partyType
  // - Else => filter by partyName
  const party = normalizeToken(f.party);
  if (party) {
    const p = party.toUpperCase();
    if (p === "TPT" || p === "LOGISTICS" || p === "OTHER") {
      match.partyType = p;
    } else {
      match.partyName = { $regex: escapeRegex(party), $options: "i" };
    }
  }

  const loadingPoint = normalizeToken(f.loadingPoint);
  if (loadingPoint) {
    match.loadingPoint = { $regex: escapeRegex(loadingPoint), $options: "i" };
  }

  const unloadingPoint = normalizeToken(f.unloadingPoint);
  if (unloadingPoint) {
    match.unloadingPoint = { $regex: escapeRegex(unloadingPoint), $options: "i" };
  }

  const vehicleNumberInput = normalizeToken(f.vehicleNumber);
  if (vehicleNumberInput) {
    const { vehicleNumber, vehicleSuffix } = normalizeVehicle(vehicleNumberInput);
    const or = [];

    // Exact normalized match
    if (vehicleNumber) or.push({ vehicleNumber });

    // Suffix match (fast if indexed)
    if (vehicleSuffix) or.push({ vehicleSuffix });

    // Flexible contains match (backward compatibility + partial matches)
    if (vehicleNumber) {
      or.push({ vehicleNumber: { $regex: escapeRegex(vehicleNumber), $options: "i" } });

      // Backward-compat: match stored values that may contain spaces (e.g. "JH 05 AC 0028")
      const loose = buildLooseSpacingRegex(vehicleNumber);
      if (loose) {
        or.push({ vehicleNumber: { $regex: loose, $options: "i" } });
      }
    }

    // Numeric-only searches like "28" or "0028": match end of string too.
    if (/^\d+$/.test(vehicleNumber) && vehicleSuffix) {
      or.push({ vehicleNumber: { $regex: `${escapeRegex(vehicleSuffix)}$`, $options: "i" } });
    }

    match.$or = [...(match.$or || []), ...or];
  }

  const tripType = normalizeToken(f.tripType).toUpperCase();
  if (tripType) match.tripType = tripType;

  const partyType = normalizeToken(f.partyType).toUpperCase();
  if (partyType) match.partyType = partyType;

  const bookNumber = normalizeToken(f.bookNumber);
  if (bookNumber) match.marketVehicleBookNumber = bookNumber;

  const loadingRange = buildDateRangeQuery("loadingDate", f.dateRange);
  if (loadingRange) Object.assign(match, loadingRange);

  const unloadingRange = buildDateRangeQuery("unloadingDate", f.unloadingDateRange);
  if (unloadingRange) Object.assign(match, unloadingRange);

  const genericTripRange = buildGenericTripDateRange(f.tripDateRange);
  if (genericTripRange) and.push(genericTripRange);

  // Month filtering (derived from loading.date)
  // Accepts: { month: 1-12, year?: 2026 }
  const month = Number(f.month);
  const year = f.year != null ? Number(f.year) : undefined;
  if (Number.isFinite(month) && month >= 1 && month <= 12) {
    const startYear = Number.isFinite(year) ? year : new Date().getUTCFullYear();
    const start = new Date(Date.UTC(startYear, month - 1, 1));
    const end = new Date(Date.UTC(startYear, month, 1));
    match.loadingDate = {
      ...(match.loadingDate || {}),
      $gte: start,
      $lt: end,
    };
  }

  if (and.length > 0) {
    match.$and = [...(match.$and || []), ...and];
  }

  return match;
}

export async function searchTrips(filters, { sort = { loadingDate: -1 }, limit = 500, skip = 0 } = {}) {
  const match = buildMatchFromFilters(filters);

  const pipeline = [
    { $match: match },
    buildComputedFieldsStage(),
    {
      $facet: {
        trips: [
          { $sort: sort },
          ...(skip > 0 ? [{ $skip: skip }] : []),
          ...(limit > 0 ? [{ $limit: limit }] : []),
        ],
        summary: [buildSummaryGroupStage(), buildSummaryProjectStage()],
      },
    },
  ];

  const [result] = await Trip.aggregate(pipeline);
  const summary = (result?.summary && result.summary[0]) || emptySummary();
  const trips = result?.trips || [];

  return { summary, trips };
}
