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
    const { tripKey, ...rest } = cleaned;
    const hasInvoice = typeof cleaned.invoiceNumber === "string" && cleaned.invoiceNumber.trim().length > 0;
    return {
      updateOne: {
        filter: hasInvoice ? { invoiceNumber: cleaned.invoiceNumber } : { tripKey },
        update: hasInvoice
          ? { $set: rest, $setOnInsert: { tripKey } }
          : { $set: cleaned },
        upsert: true,
      },
    };
  });

  try {
    const result = await Trip.bulkWrite(ops, { ordered: false });

    return {
      requested: docs.length,
      matched: result.matchedCount || 0,
      modified: result.modifiedCount || 0,
      upserted: result.upsertedCount || 0,
    };
  } catch (err) {
    const hasDupKey =
      err &&
      typeof err === "object" &&
      (("code" in err && err.code === 11000) ||
        (Array.isArray(err.writeErrors) && err.writeErrors.some((e) => e?.code === 11000)));

    if (!hasDupKey) throw err;

    let matched = 0;
    let modified = 0;
    let upserted = 0;

    for (const trip of docs) {
      const cleaned = removeUndefinedDeep(trip);
      const { tripKey, ...rest } = cleaned;
      const hasInvoice = typeof cleaned.invoiceNumber === "string" && cleaned.invoiceNumber.trim().length > 0;

      const filter = hasInvoice ? { invoiceNumber: cleaned.invoiceNumber } : { tripKey };
      const update = hasInvoice ? { $set: rest, $setOnInsert: { tripKey } } : { $set: cleaned };

      try {
        const r = await Trip.updateOne(filter, update, { upsert: true });
        matched += r.matchedCount || 0;
        modified += r.modifiedCount || 0;
        upserted += r.upsertedCount || 0;
      } catch (e) {
        const isDup = e && typeof e === "object" && "code" in e && e.code === 11000;
        if (!isDup) throw e;

        const r = await Trip.updateOne(filter, update, { upsert: false });
        matched += r.matchedCount || 0;
        modified += r.modifiedCount || 0;
      }
    }

    return { requested: docs.length, matched, modified, upserted };
  }
}
