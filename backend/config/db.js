import mongoose from "mongoose";
import { MONGO_URI } from "./env.js";
import { Trip } from "../models/tripModel.js";
import crypto from "crypto";

function toDateOnlyIso(value) {
  const d = value instanceof Date ? value : value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function safeString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function buildTripKeyPayloadFromDoc(doc) {
  const sno = safeString(doc?.sno);
  const invoiceNumber = safeString(doc?.invoiceNumber);
  const sheetName = safeString(doc?.sheet?.sheetName);

  const identityValue = sno || invoiceNumber;
  const identityType = sno ? "SNO" : invoiceNumber ? "INVOICE" : "";

  return {
    v: 4,
    sheetName,
    type: identityType,
    value: identityValue,
  };
}

function computeTripKeyFromDoc(doc) {
  const payload = buildTripKeyPayloadFromDoc(doc);
  const hasIdentity = typeof payload?.value === "string" && payload.value.trim().length > 0;
  const base = hasIdentity
    ? payload
    : { legacy: true, id: String(doc?._id || ""), existingTripKey: safeString(doc?.tripKey) };
  return crypto.createHash("sha256").update(JSON.stringify(base)).digest("hex");
}

async function backfillTripKeys() {
  const query = {
    $or: [{ tripKey: { $exists: false } }, { tripKey: null }, { tripKey: "" }],
  };

  const cursor = Trip.find(query).lean().cursor();
  let batch = [];
  let processed = 0;
  // eslint-disable-next-line no-console
  console.log("[db] Backfilling tripKey for legacy Trip documents...");

  for await (const doc of cursor) {
    const tripKey = computeTripKeyFromDoc(doc);
    batch.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { tripKey } },
      },
    });
    processed += 1;

    if (batch.length >= 500) {
      // ordered:false keeps going even if some docs change concurrently
      await Trip.bulkWrite(batch, { ordered: false });
      batch = [];
      if (processed % 5000 === 0) {
        // eslint-disable-next-line no-console
        console.log(`[db] Backfill progress: ${processed}`);
      }
    }
  }

  if (batch.length > 0) {
    await Trip.bulkWrite(batch, { ordered: false });
  }

  // eslint-disable-next-line no-console
  console.log(`[db] Backfill complete. Updated: ${processed}`);
}

export async function connectDB() {
  // Mongoose defaults are fine for MVP; keep this as a single place to tweak later.
  mongoose.set("strictQuery", true);
  mongoose.set("bufferCommands", false);
  mongoose.set("bufferTimeoutMS", 2000);
  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 20000,
  });

  const shouldBackfill = String(process.env.BACKFILL_TRIPKEYS || "").toLowerCase() === "true";
  if (shouldBackfill) {
    const missingCount = await Trip.countDocuments({
      $or: [{ tripKey: { $exists: false } }, { tripKey: null }, { tripKey: "" }],
    });
    if (missingCount > 0) {
      await backfillTripKeys();
    }
  }
  await Trip.syncIndexes();
  return mongoose.connection;
}

