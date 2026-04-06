import { searchTrips } from "../services/searchService.js";
import { Trip } from "../models/tripModel.js";

export async function postSearch(req, res) {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const limit = Number.isFinite(Number(body.limit)) ? Number(body.limit) : undefined;
  const skip = Number.isFinite(Number(body.skip)) ? Number(body.skip) : undefined;

  const { limit: _limit, skip: _skip, ...filters } = body;

  const { summary, trips } = await searchTrips(filters, {
    ...(typeof limit === "number" ? { limit } : {}),
    ...(typeof skip === "number" ? { skip } : {}),
  });
  return res.json({ summary, trips });
}

export async function getPartyOptions(_req, res) {
  const staticTypes = ["TPT", "LOGISTICS", "OTHER"];

  const raw = await Trip.distinct("partyName", {
    partyName: { $exists: true, $ne: null, $ne: "" },
  });

  const seen = new Set();
  const dynamic = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    const s = typeof v === "string" ? v.trim() : String(v || "").trim();
    if (!s) continue;
    const k = s.toUpperCase();
    if (seen.has(k)) continue;
    if (staticTypes.includes(k)) continue;
    seen.add(k);
    dynamic.push(s);
  }

  dynamic.sort((a, b) => a.localeCompare(b));

  return res.json({
    options: ["", ...staticTypes, ...dynamic],
  });
}

export async function getPartyNameOptions(_req, res) {
  const raw = await Trip.distinct("partyName", {
    partyType: "OTHER",
    partyName: { $exists: true, $ne: null, $ne: "" },
  });

  const seen = new Set();
  const options = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    const s = typeof v === "string" ? v.trim() : String(v || "").trim();
    if (!s) continue;
    const k = s.toUpperCase();
    if (seen.has(k)) continue;
    seen.add(k);
    options.push(s);
  }

  options.sort((a, b) => a.localeCompare(b));

  return res.json({
    options: ["", ...options],
  });
}

export async function getDeliveryNumberOptions(_req, res) {
  const raw = await Trip.distinct("deliveryNumber", {
    deliveryNumber: { $exists: true, $ne: null, $ne: "" },
  });

  const seen = new Set();
  const options = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    const s = typeof v === "string" ? v.trim() : String(v || "").trim();
    if (!s) continue;
    const k = s.toUpperCase();
    if (seen.has(k)) continue;
    seen.add(k);
    options.push(s);
  }

  options.sort((a, b) => a.localeCompare(b));

  return res.json({
    options: ["", ...options],
  });
}

export async function getTripNumberOptions(_req, res) {
  const raw = await Trip.distinct("tripNumber", {
    tripNumber: { $exists: true, $ne: null, $ne: "" },
  });

  const seen = new Set();
  const options = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    const s = typeof v === "string" ? v.trim() : String(v || "").trim();
    if (!s) continue;
    const k = s.toUpperCase();
    if (seen.has(k)) continue;
    seen.add(k);
    options.push(s);
  }

  options.sort((a, b) => a.localeCompare(b));

  return res.json({
    options: ["", ...options],
  });
}

export async function getChassisNumberOptions(_req, res) {
  const raw = await Trip.distinct("chassisNumber", {
    chassisNumber: { $exists: true, $ne: null, $ne: "" },
  });

  const seen = new Set();
  const options = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    const s = typeof v === "string" ? v.trim() : String(v || "").trim();
    if (!s) continue;
    const k = s.toUpperCase();
    if (seen.has(k)) continue;
    seen.add(k);
    options.push(s);
  }

  options.sort((a, b) => a.localeCompare(b));

  return res.json({
    options: ["", ...options],
  });
}

export async function getBookNumberOptions(_req, res) {
  const raw = await Trip.distinct("marketVehicleBookNumber", {
    marketVehicleBookNumber: { $exists: true, $ne: null, $ne: "" },
  });

  const seen = new Set();
  const options = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    const s = typeof v === "string" ? v.trim() : String(v || "").trim();
    if (!s) continue;
    const k = s.toUpperCase();
    if (seen.has(k)) continue;
    seen.add(k);
    options.push(s);
  }

  options.sort((a, b) => a.localeCompare(b));

  return res.json({
    options: ["", ...options],
  });
}

export async function getLoadingPointOptions(_req, res) {
  const raw = await Trip.distinct("loadingPoint", {
    loadingPoint: { $exists: true, $ne: null, $ne: "" },
  });

  const seen = new Set();
  const options = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    const s = typeof v === "string" ? v.trim() : String(v || "").trim();
    if (!s) continue;
    const k = s.toUpperCase();
    if (seen.has(k)) continue;
    seen.add(k);
    options.push(s);
  }

  options.sort((a, b) => a.localeCompare(b));

  return res.json({
    options: ["", ...options],
  });
}

export async function getUnloadingPointOptions(_req, res) {
  const raw = await Trip.distinct("unloadingPoint", {
    unloadingPoint: { $exists: true, $ne: null, $ne: "" },
  });

  const seen = new Set();
  const options = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    const s = typeof v === "string" ? v.trim() : String(v || "").trim();
    if (!s) continue;
    const k = s.toUpperCase();
    if (seen.has(k)) continue;
    seen.add(k);
    options.push(s);
  }

  options.sort((a, b) => a.localeCompare(b));

  return res.json({
    options: ["", ...options],
  });
}
