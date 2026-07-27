import mongoose from "mongoose";

const driveRootConfigSchema = new mongoose.Schema(
  {
    folderId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    financialYear: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    addedBy: { type: String, default: "system" },
  },
  { timestamps: true }
);

export const DriveRootConfig = mongoose.model("DriveRootConfig", driveRootConfigSchema);
