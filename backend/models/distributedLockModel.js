import mongoose from "mongoose";

const distributedLockSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    lockedUntil: { type: Date, required: true },
    owner: { type: String, default: "" },
  },
  { timestamps: true }
);

distributedLockSchema.index({ key: 1 }, { unique: true });
distributedLockSchema.index({ lockedUntil: 1 });

export const DistributedLock =
  mongoose.models.DistributedLock || mongoose.model("DistributedLock", distributedLockSchema);
