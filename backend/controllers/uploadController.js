import { parseFile } from "../services/parserService.js";
import { processRows } from "../services/processingService.js";
import { saveTrips } from "../services/tripStorageService.js";
import { clearDashboardCache } from "../services/dashboardCacheService.js";
import fs from "fs/promises";

export async function upload(req, res) {
  if (!req.file) {
    return res.status(400).json({
      message: "No file uploaded. Use form-data with key 'file' and a .xlsx file.",
    });
  }

  const uploadedPath = req.file.path;
  try {
    const rawRows = await parseFile(uploadedPath);
    const { trips, errors, duplicates, duplicateHandling } = await processRows(rawRows);
    const storage = await saveTrips(trips);

    if ((storage?.modified || 0) > 0 || (storage?.upserted || 0) > 0) {
      clearDashboardCache();
    }

    return res.status(201).json({
      message: "File uploaded and processed successfully",
      file: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        filename: req.file.filename,
        path: uploadedPath,
      },
      summary: {
        rawRows: rawRows.length,
        processedTrips: trips.length,
        rejectedRows: errors.length,
        // Backward-compatible field name (duplicates are now tripKey-based)
        duplicateInvoiceNumbers: duplicates.length,
      },
      errorRows: errors || [],
      storage,
    });
  } finally {
    if (typeof uploadedPath === "string" && uploadedPath.trim()) {
      try {
        await fs.unlink(uploadedPath);
      } catch {
        // ignore
      }
    }
  }
}
