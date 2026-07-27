import mongoose from "mongoose";

const driveFileSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true, unique: true, index: true, trim: true },
    name: { type: String, required: true, trim: true, index: true },
    parentFolderId: { type: String, required: true, trim: true, index: true },
    path: { type: String, default: "", trim: true },
    billFolderId: { type: String, trim: true, index: true },
    billFolderName: { type: String, trim: true, index: true },
    mimeType: { type: String, trim: true },
    size: { type: Number, default: 0 },
    md5Checksum: { type: String, trim: true },
    driveModifiedTime: { type: Date },
    isAnnexureCandidate: { type: Boolean, default: false, index: true },
    extractionStatus: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED", "SKIPPED"],
      default: "PENDING",
      index: true,
    },
    extractionError: { type: String, default: "" },
    extractedRowCount: { type: Number, default: 0 },
    lastScannedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

driveFileSchema.index({ parentFolderId: 1, name: 1 });
driveFileSchema.index({ isAnnexureCandidate: 1, extractionStatus: 1 });

export const DriveFile =
  mongoose.models.DriveFile || mongoose.model("DriveFile", driveFileSchema);
