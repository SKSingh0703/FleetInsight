import { parseFile } from "../services/parserService.js";
import { processRows } from "../services/processingService.js";
import { saveTrips } from "../services/tripStorageService.js";

export async function upload(req, res) {
  if (!req.file) {
    return res.status(400).json({
      message: "No file uploaded. Use form-data with key 'file' and a .xlsx file.",
    });
  }

  const rawRows = await parseFile(req.file.path);
  const { trips, errors, duplicates, duplicateHandling } = await processRows(rawRows);
  const storage = await saveTrips(trips);

  return res.status(201).json({
    message: "File uploaded and processed successfully",
    file: {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      filename: req.file.filename,
      path: req.file.path,
    },
    summary: {
      rawRows: rawRows.length,
      processedTrips: trips.length,
      rejectedRows: errors.length,
      duplicateInvoiceNumbers: duplicates.length,
    },
    trips,
    errors,
    duplicates,
    duplicateHandling,
    storage,
  });
}

