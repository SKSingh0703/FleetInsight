import {
  extractTripFields,
  computeTotalFreight,
  getDefaultRatePerTon,
  buildNormalizedRow,
} from "./mappingService.js";

import { normalizeVehicle } from "../utils/vehicleNormalization.js";
import crypto from "crypto";

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
  const keyOccurrences = new Map();
  const duplicatesSkipped = [];
  const keyIndex = new Map();

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
      const partyName = requiredString(extracted.partyName) || undefined;
      const bookNumber = requiredString(extracted.bookNumber);

      const loadingDate = extracted.loadingDate;
      const unloadingDate = extracted.unloadingDate;
      const loadingPoint = normalizeLocationName(extracted.loadingPoint);
      const unloadingPoint = normalizeLocationName(extracted.unloadingPoint);

      const loadingWeightTons = extracted.loadingWeightTons;
      const rawUnloadingWeightTons = extracted.unloadingWeightTons;

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

      if (!vehicleNumber) rowIssues.push("Missing vehicleNumber");

      // Required fields (as per relaxed rules)
      if (!isValidDate(loadingDate)) rowIssues.push("Invalid or missing loading date");
      if (!isFiniteNonNegative(loadingWeightTons)) rowIssues.push("Invalid loading weight");

      const unloadingWeightAssumed =
        !isFiniteNonNegative(rawUnloadingWeightTons) && isFiniteNonNegative(loadingWeightTons);

      const unloadingWeightTons = unloadingWeightAssumed ? loadingWeightTons : rawUnloadingWeightTons;

      if (!isFiniteNonNegative(unloadingWeightTons)) rowIssues.push("Invalid unloading weight");

      // Optional fields: keep if present, otherwise fill safe defaults so schema compatibility is preserved.
      const effectiveTripType = isValidTripType(tripType) ? tripType : "OWN";
      const effectivePartyType = isValidPartyType(partyType) ? partyType : "OTHER";
      const effectiveUnloadingDate = isValidDate(unloadingDate) ? unloadingDate : loadingDate;

      // When trip is MARKET but book number is missing, downgrade to OWN to avoid rejecting the row.
      const finalTripType = effectiveTripType === "MARKET" && !bookNumber ? "OWN" : effectiveTripType;

      const totalFreight = computeTotalFreight({ unloadingWeightTons, ratePerTon });
      if (!Number.isFinite(totalFreight)) rowIssues.push("Failed to compute totalFreight");

      const tripKeyPayload = {
        vehicleNumber,
        chassisNumber,
        tripType: finalTripType,
        partyType: effectivePartyType,
        bookNumber: finalTripType === "MARKET" ? bookNumber : "",
        loadingDate: isValidDate(loadingDate) ? loadingDate.toISOString().slice(0, 10) : "",
        unloadingDate: isValidDate(effectiveUnloadingDate) ? effectiveUnloadingDate.toISOString().slice(0, 10) : "",
        loadingPoint,
        unloadingPoint,
        loadingWeightTons,
        unloadingWeightTons,
        ratePerTon,
      };
      const tripKey = crypto
        .createHash("sha256")
        .update(JSON.stringify(tripKeyPayload))
        .digest("hex");

      if (rowIssues.length > 0) {
        errors.push({
          sheetName,
          rowNumber,
          invoiceNumber: invoiceNumber || undefined,
          tripKey,
          issues: rowIssues,
          raw,
        });
        continue;
      }

      const list = keyOccurrences.get(tripKey) || [];
      list.push({ sheetName, rowNumber, invoiceNumber: invoiceNumber || undefined });
      keyOccurrences.set(tripKey, list);

      const trip = {
        tripKey,
        invoiceNumber,
        chassisNumber,
        vehicleNumber,
        ...(vehicleSuffix ? { vehicleSuffix } : {}),
        tripType: finalTripType,
        partyType: effectivePartyType,
        ...(partyName ? { partyName } : {}),
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
        extensions: {
          ...(extensions || {}),
          ...(unloadingWeightAssumed ? { unloadingWeightAssumed: true } : {}),
        },
        sheet: {
          sheetName,
          rowNumber,
          raw,
          normalized: buildNormalizedRow(raw),
        },
      };

      // If duplicates exist within the same upload, keep the *latest* row as authoritative.
      const existingIndex = keyIndex.get(tripKey);
      if (existingIndex !== undefined) {
        duplicatesSkipped.push({ tripKey, replacedWith: { sheetName, rowNumber } });
        trips[existingIndex] = trip;
      } else {
        keyIndex.set(tripKey, trips.length);
        trips.push(trip);
      }
    } catch (err) {
      errors.push({
        sheetName,
        rowNumber,
        raw,
        issues: [typeof err?.message === "string" ? err.message : "Unknown processing error"],
      });
    }
  }

  const duplicates = [];
  for (const [tripKey, occurrences] of keyOccurrences.entries()) {
    if ((occurrences?.length || 0) > 1) {
      duplicates.push({ tripKey, count: occurrences.length, occurrences });
    }
  }

  duplicates.sort((a, b) => b.count - a.count || String(a.tripKey).localeCompare(String(b.tripKey)));

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

