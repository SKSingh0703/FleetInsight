import crypto from "crypto";
import { DistributedLock } from "../models/distributedLockModel.js";

function ownerId() {
  const salt = `${process.pid}-${process.env.NODE_ENV || ""}-${Date.now()}`;
  return crypto.createHash("sha256").update(salt).digest("hex").slice(0, 12);
}

const OWNER = ownerId();

export async function withMongoLock({ key, ttlMs }, fn) {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + ttlMs);

  let lock = null;
  try {
    // First: acquire an existing lock only if it's expired.
    lock = await DistributedLock.findOneAndUpdate(
      {
        key,
        $or: [{ lockedUntil: { $lte: now } }, { lockedUntil: { $exists: false } }],
      },
      { $set: { key, lockedUntil, owner: OWNER } },
      { new: true }
    ).lean();

    // Second: if no lock doc exists at all, create it.
    if (!lock) {
      lock = await DistributedLock.create({ key, lockedUntil, owner: OWNER });
      lock = lock.toObject();
    }
  } catch (err) {
    // If another process created the lock doc concurrently, treat as "not acquired".
    if (err && typeof err === "object" && "code" in err && err.code === 11000) {
      return { ran: false };
    }
    throw err;
  }

  // If someone else already holds the lock (not expired), we didn't acquire it.
  if (!lock || lock.owner !== OWNER) {
    return { ran: false };
  }

  try {
    const result = await fn();
    return { ran: true, result };
  } finally {
    await DistributedLock.updateOne({ key, owner: OWNER }, { $set: { lockedUntil: new Date(0) } });
  }
}
