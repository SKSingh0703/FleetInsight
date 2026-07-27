import mongoose from "mongoose";

const driveCrawlStateSchema = new mongoose.Schema(
  {
    rootFolderId: { type: String, required: true, unique: true, index: true, trim: true },
    lastCrawlStartedAt: { type: Date },
    lastCrawlFinishedAt: { type: Date },
    status: {
      type: String,
      enum: ["IDLE", "RUNNING", "SUCCESS", "FAILED"],
      default: "IDLE",
      index: true,
    },
    stats: {
      type: Object,
      default: {
        foldersCount: 0,
        filesCount: 0,
        billFoldersCount: 0,
        annexuresFound: 0,
        annexuresProcessed: 0,
        rowsExtracted: 0,
      },
    },
    lastError: { type: String, default: "" },
  },
  { timestamps: true }
);

export const DriveCrawlState =
  mongoose.models.DriveCrawlState || mongoose.model("DriveCrawlState", driveCrawlStateSchema);
