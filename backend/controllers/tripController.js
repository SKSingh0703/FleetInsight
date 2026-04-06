import mongoose from "mongoose";
import { Trip } from "../models/tripModel.js";
import { SheetTabSyncState } from "../models/sheetTabSyncStateModel.js";
import { SheetIntegration } from "../models/sheetIntegrationModel.js";
import { clearDashboardCache } from "../services/dashboardCacheService.js";

export async function deleteTripById(req, res) {
  const id = req.params?.id;

  if (typeof id !== "string" || !id.trim()) {
    return res.status(400).json({ message: "Missing trip id" });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid trip id" });
  }

  const deletedTrip = await Trip.findByIdAndDelete(id).lean();
  if (!deletedTrip) {
    return res.status(404).json({ message: "Trip not found" });
  }

  const sheetName = typeof deletedTrip?.sheet?.tabName === "string" ? deletedTrip.sheet.tabName : "";
  const rowNumber =
    typeof deletedTrip?.sheet?.rowNumber === "number" && Number.isFinite(deletedTrip.sheet.rowNumber)
      ? deletedTrip.sheet.rowNumber
      : undefined;

  if (sheetName && rowNumber) {
    const integration = await SheetIntegration.findOne({}).select({ spreadsheetId: 1 }).lean();
    const spreadsheetId = typeof integration?.spreadsheetId === "string" ? integration.spreadsheetId : "";
    if (spreadsheetId) {
      await SheetTabSyncState.updateOne(
        { spreadsheetId, tabName: sheetName },
        { $unset: { [`rowHashes.${String(rowNumber)}`]: "" } }
      );
    }

    // Safety net: if spreadsheetId changed or state docs were created with a different spreadsheetId,
    // still clear the row hash for the tab so the next sync can restore the deleted row from Excel.
    await SheetTabSyncState.updateMany(
      { tabName: sheetName },
      { $unset: { [`rowHashes.${String(rowNumber)}`]: "" } }
    );
  }

  clearDashboardCache();

  return res.json({ message: "Trip deleted" });
}
