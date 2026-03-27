import {
  extractTripFields,
  computeTotalFreight,
  getDefaultRatePerTon,
} from "./mappingService.js";

import { normalizeVehicle } from "../utils/vehicleNormalization.js";

const UNKNOWN_TEXT = "UNKNOWN";

function requiredString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeLocationName(value) {
  const s = requiredString(value);
  return s || UNKNOWN_TEXT;
}

function isValidTripType(value) {
  return value === "OWN" || value === "MARKET";
}

function isValidPartyType(value) {
  return value === "TPT" || value === "LOGISTICS" || value === "OTHER";
}

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function isFiniteNonNegative(n) {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export async function processRows(rawRows) {
  const trips = [];
  const errors = [];
  const invoiceOccurrences = new Map();
  const duplicatesSkipped = [];
  const invoiceIndex = new Map();

  for (const entry of rawRows || []) {
    const { sheetName, rowNumber, raw } = entry || {};
    try {
      const extracted = extractTripFields(raw);

      const invoiceNumber = requiredString(extracted.invoiceNumber);
      const chassisNumber = requiredString(extracted.chassisNumber) || UNKNOWN_TEXT;
      const rawVehicleNumber = requiredString(extracted.vehicleNumber);
      const { vehicleNumber, vehicleSuffix } = normalizeVehicle(rawVehicleNumber);
      const tripType = extracted.tripType || "OWN";
      const partyType = extracted.partyType || "OTHER";
      const bookNumber = requiredString(extracted.bookNumber);

      const loadingDate = extracted.loadingDate;
      const unloadingDate = extracted.unloadingDate;
      const loadingPoint = normalizeLocationName(extracted.loadingPoint);
      const unloadingPoint = normalizeLocationName(extracted.unloadingPoint);

      const loadingWeightTons = extracted.loadingWeightTons;
      const unloadingWeightTons = extracted.unloadingWeightTons;

      const ratePerTon = isFiniteNonNegative(extracted.ratePerTon)
        ? extracted.ratePerTon
        : getDefaultRatePerTon();

      const expenses = {
        cash: isFiniteNonNegative(extracted.expenses?.cash) ? extracted.expenses.cash : 0,
        diesel: isFiniteNonNegative(extracted.expenses?.diesel) ? extracted.expenses.diesel : 0,
        other: isFiniteNonNegative(extracted.expenses?.other) ? extracted.expenses.other : 0,
      };

      const extensions = {
        ...(extracted.extensions || {}),
      };

      const rowIssues = [];

      if (!invoiceNumber) rowIssues.push("Missing invoiceNumber");
      if (!vehicleNumber) rowIssues.push("Missing vehicleNumber");

      // Required fields (as per relaxed rules)
      if (!isValidDate(loadingDate)) rowIssues.push("Invalid or missing loading date");
      if (!isFiniteNonNegative(loadingWeightTons)) rowIssues.push("Invalid loading weight");
      if (!isFiniteNonNegative(unloadingWeightTons)) rowIssues.push("Invalid unloading weight");

      if (invoiceNumber) {
        const list = invoiceOccurrences.get(invoiceNumber) || [];
        list.push({ sheetName, rowNumber });
        invoiceOccurrences.set(invoiceNumber, list);
      }

      // Optional fields: keep if present, otherwise fill safe defaults so schema compatibility is preserved.
      const effectiveTripType = isValidTripType(tripType) ? tripType : "OWN";
      const effectivePartyType = isValidPartyType(partyType) ? partyType : "OTHER";
      const effectiveUnloadingDate = isValidDate(unloadingDate) ? unloadingDate : loadingDate;

      // When trip is MARKET but book number is missing, downgrade to OWN to avoid rejecting the row.
      const finalTripType = effectiveTripType === "MARKET" && !bookNumber ? "OWN" : effectiveTripType;

      const totalFreight = computeTotalFreight({ unloadingWeightTons, ratePerTon });
      if (!Number.isFinite(totalFreight)) rowIssues.push("Failed to compute totalFreight");

      if (rowIssues.length > 0) {
        errors.push({ sheetName, rowNumber, invoiceNumber: invoiceNumber || undefined, issues: rowIssues });
        continue;
      }

      const trip = {
        invoiceNumber,
        chassisNumber,
        vehicleNumber,
        ...(vehicleSuffix ? { vehicleSuffix } : {}),
        tripType: finalTripType,
        partyType: effectivePartyType,
        ...(finalTripType === "MARKET" && bookNumber ? { bookNumber } : {}),
        loading: {
          date: loadingDate,
          location: { name: loadingPoint },
          weightTons: loadingWeightTons,
        },
        unloading: {
          date: effectiveUnloadingDate,
          location: { name: unloadingPoint },
          weightTons: unloadingWeightTons,
        },
        ratePerTon,
        expenses,
        extensions,
      };

      // If duplicates exist within the same upload, keep the *latest* row as authoritative.
      const existingIndex = invoiceIndex.get(invoiceNumber);
      if (existingIndex !== undefined) {
        duplicatesSkipped.push({ invoiceNumber, replacedWith: { sheetName, rowNumber } });
        trips[existingIndex] = trip;
      } else {
        invoiceIndex.set(invoiceNumber, trips.length);
        trips.push(trip);
      }
    } catch (err) {
      errors.push({
        sheetName,
        rowNumber,
        issues: [typeof err?.message === "string" ? err.message : "Unknown processing error"],
      });
    }
  }

  const duplicates = [];
  for (const [invoiceNumber, occurrences] of invoiceOccurrences.entries()) {
    if ((occurrences?.length || 0) > 1) {
      duplicates.push({ invoiceNumber, count: occurrences.length, occurrences });
    }
  }

  duplicates.sort((a, b) => b.count - a.count || String(a.invoiceNumber).localeCompare(String(b.invoiceNumber)));

  return {
    trips,
    errors,
    duplicates,
    duplicateHandling: {
      strategy: "keep_last_row",
      overwritten: duplicatesSkipped.length,
    },
  };
}

