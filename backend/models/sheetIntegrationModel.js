import mongoose from "mongoose";

const sheetTabSchema = new mongoose.Schema(
  {
    tabName: { type: String, default: "" },
    range: { type: String, default: "A:AZ" },
    headerRow: { type: Number, default: 1 },
  },
  { _id: false }
);

const sheetIntegrationSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    spreadsheetId: { type: String, required: true },
    autoDiscoverTabs: { type: Boolean, default: true },
    defaultRange: { type: String, default: "A:AZ" },
    defaultHeaderRow: { type: Number, default: 1 },
    tabs: { type: [sheetTabSchema], default: [] },
    syncIntervalSeconds: { type: Number, default: 120 },
    createdByUserId: { type: String, default: "" },
  },
  { timestamps: true }
);

sheetIntegrationSchema.index({ spreadsheetId: 1 }, { unique: true });

export const SheetIntegration =
  mongoose.models.SheetIntegration || mongoose.model("SheetIntegration", sheetIntegrationSchema);
