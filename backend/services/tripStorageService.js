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

    const spreadsheetId =
      cleaned?.sheet && typeof cleaned.sheet.spreadsheetId === "string" ? cleaned.sheet.spreadsheetId.trim() : "";
    const tabName =
      cleaned?.sheet && typeof cleaned.sheet.tabName === "string" ? cleaned.sheet.tabName.trim() : "";

    const hasSno = typeof cleaned.sno === "string" && cleaned.sno.trim().length > 0;
    const scope = {
      ...(spreadsheetId ? { "sheet.spreadsheetId": spreadsheetId } : {}),
      ...(tabName ? { "sheet.tabName": tabName } : {}),
    };

    const filter = hasSno ? { ...scope, sno: cleaned.sno } : { tripKey };

    return {
      updateOne: {
        filter,
        update: { $set: rest, $setOnInsert: { tripKey } },
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

      const spreadsheetId =
        cleaned?.sheet && typeof cleaned.sheet.spreadsheetId === "string" ? cleaned.sheet.spreadsheetId.trim() : "";
      const tabName =
        cleaned?.sheet && typeof cleaned.sheet.tabName === "string" ? cleaned.sheet.tabName.trim() : "";

      const hasSno = typeof cleaned.sno === "string" && cleaned.sno.trim().length > 0;
      const scope = {
        ...(spreadsheetId ? { "sheet.spreadsheetId": spreadsheetId } : {}),
        ...(tabName ? { "sheet.tabName": tabName } : {}),
      };

      const filter = hasSno ? { ...scope, sno: cleaned.sno } : { tripKey };
      const update = { $set: rest, $setOnInsert: { tripKey } };

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
