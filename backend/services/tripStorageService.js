import { Trip } from "../models/tripModel.js";

function removeUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedDeep);
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      out[k] = removeUndefinedDeep(v);
    }
    return out;
  }
  return value;
}

export async function saveTrips(trips) {
  const docs = Array.isArray(trips) ? trips : [];
  if (docs.length === 0) {
    return {
      requested: 0,
      matched: 0,
      modified: 0,
      upserted: 0,
    };
  }

  const ops = docs.map((trip) => {
    const cleaned = removeUndefinedDeep(trip);
    return {
      updateOne: {
        filter: { invoiceNumber: cleaned.invoiceNumber },
        update: { $set: cleaned },
        upsert: true,
      },
    };
  });

  const result = await Trip.bulkWrite(ops, { ordered: false });

  return {
    requested: docs.length,
    matched: result.matchedCount || 0,
    modified: result.modifiedCount || 0,
    upserted: result.upsertedCount || 0,
  };
}
