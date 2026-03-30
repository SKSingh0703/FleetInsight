import mongoose from "mongoose";

const sheetSyncRunSchema = new mongoose.Schema(
  {
    spreadsheetId: { type: String, required: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date },
    status: { type: String, default: "SUCCESS" },
    results: { type: Array, default: [] },
    message: { type: String, default: "" },
  },
  { timestamps: true }
);

sheetSyncRunSchema.index({ spreadsheetId: 1, startedAt: -1 });

export const SheetSyncRun =
  mongoose.models.SheetSyncRun || mongoose.model("SheetSyncRun", sheetSyncRunSchema);
