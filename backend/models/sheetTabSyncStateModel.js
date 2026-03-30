import mongoose from "mongoose";

const sheetTabSyncStateSchema = new mongoose.Schema(
  {
    spreadsheetId: { type: String, required: true },
    tabName: { type: String, required: true },
    rowHashes: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastRunAt: { type: Date },
    lastStats: {
      type: Object,
      default: {
        processed: 0,
        changed: 0,
        upsertRequested: 0,
        upsertMatched: 0,
        upsertModified: 0,
        upsertUpserted: 0,
        skippedEmpty: 0,
        skippedIncomplete: 0,
        rejected: 0,
      },
    },
    lastError: { type: String, default: "" },
  },
  { timestamps: true }
);

sheetTabSyncStateSchema.index({ spreadsheetId: 1, tabName: 1 }, { unique: true });

export const SheetTabSyncState =
  mongoose.models.SheetTabSyncState ||
  mongoose.model("SheetTabSyncState", sheetTabSyncStateSchema);
