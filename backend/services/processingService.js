import {
  extractTripFields,
  getDefaultRatePerTon,
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
    const { spreadsheetId, tabName, sheetName, rowNumber, raw } = entry || {};
    try {
      const extracted = extractTripFields(raw);

      const sno = requiredString(extracted.sno);
      const invoiceNumber = requiredString(extracted.invoiceNumber);
      const deliveryNumber = requiredString(extracted.deliveryNumber);
      const chassisNumber = requiredString(extracted.chassisNumber);
      const rawVehicleNumber = requiredString(extracted.vehicleNumber);
      const { vehicleNumber, vehicleSuffix } = normalizeVehicle(rawVehicleNumber);
      const tripType = extracted.tripType || "OWN";
      const partyType = extracted.partyType || "OTHER";
      const partyName = requiredString(extracted.partyName) || undefined;
      const tripNumber = requiredString(extracted.tripNumber);
      const marketVehicleBookNumber = requiredString(extracted.marketVehicleBookNumber);

      const loadingDate = extracted.loadingDate;
      const unloadingDate = extracted.unloadingDate;
      const loadingPoint = normalizeLocationName(extracted.loadingPoint);
      const unloadingPoint = normalizeLocationName(extracted.unloadingPoint);

      const loadingWeightTons = extracted.loadingWeightTons;
      const unloadingWeightTons = extracted.unloadingWeightTons;

      const ratePerTon = isFiniteNonNegative(extracted.ratePerTon) && extracted.ratePerTon > 0
        ? extracted.ratePerTon
        : 0;

      const cash = isFiniteNonNegative(extracted.cash) ? extracted.cash : 0;
      const cardAccount = requiredString(extracted.cardAccount) || undefined;
      const cashDate = isValidDate(extracted.cashDate) ? extracted.cashDate : undefined;

      const diesel = isFiniteNonNegative(extracted.diesel) ? extracted.diesel : 0;
      const pumpCard = requiredString(extracted.pumpCard) || undefined;
      const dieselDate = isValidDate(extracted.dieselDate) ? extracted.dieselDate : undefined;

      const fastag = isFiniteNonNegative(extracted.fastag) ? extracted.fastag : 0;
      const fastagDate = isValidDate(extracted.fastagDate) ? extracted.fastagDate : undefined;

      const totalAdvance = isFiniteNonNegative(extracted.totalAdvance) ? extracted.totalAdvance : 0;
      const otherExpenses = isFiniteNonNegative(extracted.otherExpenses) ? extracted.otherExpenses : 0;

      const challanDate = isValidDate(extracted.challanDate) ? extracted.challanDate : undefined;
      const billBookNumber = requiredString(extracted.billBookNumber) || undefined;
      const marketPaymentDate = isValidDate(extracted.marketPaymentDate) ? extracted.marketPaymentDate : undefined;
      const remarks = requiredString(extracted.remarks) || undefined;
      const tripStatus = requiredString(extracted.tripStatus) || undefined;

      const rowIssues = [];

      const hasVehicleNumber = Boolean(vehicleNumber);
      const hasLoadingDate = isValidDate(loadingDate);

      // vehicleNumber and loadingDate are individually optional.
      // Reject only if both are missing (so we still preserve most entries).
      if (!hasVehicleNumber && !hasLoadingDate) {
        rowIssues.push("Missing both vehicleNumber and loading date");
      }

      if (!sno) rowIssues.push("Missing S.No");

      // Optional fields: keep if present, otherwise fill safe defaults so schema compatibility is preserved.
      const effectiveTripType = isValidTripType(tripType) ? tripType : "OWN";
      const effectivePartyType = isValidPartyType(partyType) ? partyType : "OTHER";

      const effectiveLoadingWeightTons = isFiniteNonNegative(loadingWeightTons) ? loadingWeightTons : undefined;
      const effectiveUnloadingWeightTons = isFiniteNonNegative(unloadingWeightTons) ? unloadingWeightTons : undefined;

      // If unloading is missing, we do NOT compute shortage (it stays 0).
      const shortageTons = (() => {
        if (isFiniteNonNegative(extracted.shortageTons)) return extracted.shortageTons;
        if (!isFiniteNonNegative(effectiveUnloadingWeightTons)) return 0;
        if (!isFiniteNonNegative(effectiveLoadingWeightTons)) return 0;
        return effectiveLoadingWeightTons - effectiveUnloadingWeightTons;
      })();

      // totalFreight: prefer sheet value if provided, else compute
      // computedWeight = U.Weight if present else L.Weight
      const computedTotalFreight = (() => {
        if (!Number.isFinite(ratePerTon) || ratePerTon <= 0) return 0;
        const w = isFiniteNonNegative(effectiveUnloadingWeightTons)
          ? effectiveUnloadingWeightTons
          : isFiniteNonNegative(effectiveLoadingWeightTons)
            ? effectiveLoadingWeightTons
            : 0;
        return w * ratePerTon;
      })();

      // Persist totalFreight only if Excel explicitly provided a value.
      // Otherwise keep it undefined so it can be computed dynamically in aggregations/UI.
      const totalFreight = isFiniteNonNegative(extracted.totalFreight) ? extracted.totalFreight : undefined;

      const finalTripType = effectiveTripType;

      if (!Number.isFinite(computedTotalFreight)) rowIssues.push("Failed to compute totalFreight");

      // Identity strategy:
      // Uniqueness is enforced by: spreadsheetId + tabName + S.No
      const effectiveSpreadsheetId = typeof spreadsheetId === "string" ? spreadsheetId.trim() : "";
      const effectiveTabName = typeof tabName === "string" ? tabName.trim() : typeof sheetName === "string" ? sheetName.trim() : "";

      const tripKeyPayload = {
        v: 5,
        spreadsheetId: effectiveSpreadsheetId,
        tabName: effectiveTabName,
        sno,
      };
      const tripKey = crypto
        .createHash("sha256")
        .update(JSON.stringify(tripKeyPayload))
        .digest("hex");

      if (rowIssues.length > 0) {
        errors.push({
          sheetName: effectiveTabName,
          rowNumber,
          invoiceNumber: invoiceNumber || undefined,
          tripKey,
          issues: rowIssues,
          raw,
        });
        continue;
      }

      const list = keyOccurrences.get(tripKey) || [];
      list.push({ sheetName: effectiveTabName, rowNumber, invoiceNumber: invoiceNumber || undefined });
      keyOccurrences.set(tripKey, list);

      const trip = {
        tripKey,
        sno,
        invoiceNumber,
        deliveryNumber,
        chassisNumber,
        vehicleNumber,
        ...(vehicleSuffix ? { vehicleSuffix } : {}),
        ...(tripNumber ? { tripNumber } : {}),
        tripType: finalTripType,
        ...(marketVehicleBookNumber ? { marketVehicleBookNumber } : {}),
        loadingDate: isValidDate(loadingDate) ? loadingDate : undefined,
        unloadingDate: isValidDate(unloadingDate) ? unloadingDate : undefined,
        ...(challanDate ? { challanDate } : {}),
        loadingPoint,
        unloadingPoint,
        ...(isFiniteNonNegative(effectiveLoadingWeightTons) ? { loadingWeightTons: effectiveLoadingWeightTons } : {}),
        ...(isFiniteNonNegative(effectiveUnloadingWeightTons) ? { unloadingWeightTons: effectiveUnloadingWeightTons } : {}),
        shortageTons,
        ratePerTon,
        ...(Number.isFinite(totalFreight) ? { totalFreight } : {}),
        cash,
        ...(cardAccount ? { cardAccount } : {}),
        ...(cashDate ? { cashDate } : {}),
        diesel,
        ...(pumpCard ? { pumpCard } : {}),
        ...(dieselDate ? { dieselDate } : {}),
        fastag,
        ...(fastagDate ? { fastagDate } : {}),
        totalAdvance,
        otherExpenses,
        partyType: effectivePartyType,
        ...(partyName ? { partyName } : {}),
        ...(billBookNumber ? { billBookNumber } : {}),
        ...(marketPaymentDate ? { marketPaymentDate } : {}),
        ...(remarks ? { remarks } : {}),
        ...(tripStatus ? { tripStatus } : {}),
        sheet: {
          spreadsheetId: effectiveSpreadsheetId,
          tabName: effectiveTabName,
          rowNumber,
          raw,
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

