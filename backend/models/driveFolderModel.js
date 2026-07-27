import mongoose from "mongoose";

const driveFolderSchema = new mongoose.Schema(
  {
    folderId: { type: String, required: true, unique: true, index: true, trim: true },
    name: { type: String, required: true, trim: true, index: true },
    parentFolderId: { type: String, trim: true, index: true },
    path: { type: String, default: "", trim: true },
    isBillFolder: { type: Boolean, default: false, index: true },
    billNumber: { type: String, trim: true, index: true },
    mimeType: { type: String, default: "application/vnd.google-apps.folder" },
    driveModifiedTime: { type: Date },
    lastScannedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

driveFolderSchema.index({ parentFolderId: 1, name: 1 });

export const DriveFolder =
  mongoose.models.DriveFolder || mongoose.model("DriveFolder", driveFolderSchema);
