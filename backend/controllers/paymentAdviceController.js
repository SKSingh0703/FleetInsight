import { parsePdfPaymentAdvice, parseXlsxPaymentAdvice, tallyPaymentAdviceRecords } from "../services/paymentAdviceParserService.js";
import fs from "fs/promises";

export async function verifyPaymentAdviceFile(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded. Please upload a Payment Advice PDF or XLSX file." });
  }

  const uploadedPath = req.file.path;
  const originalName = req.file.originalname;
  const mimeType = req.file.mimetype || "";

  try {
    const buffer = await fs.readFile(uploadedPath);

    const isPdf = mimeType.includes("pdf") || originalName.toLowerCase().endsWith(".pdf");
    const isXlsx = mimeType.includes("spreadsheet") || mimeType.includes("excel") || originalName.toLowerCase().endsWith(".xlsx") || originalName.toLowerCase().endsWith(".xls");

    if (!isPdf && !isXlsx) {
      return res.status(400).json({ message: "Unsupported file format. Please upload a PDF or XLSX Payment Advice file." });
    }

    const { meta, records } = isPdf
      ? await parsePdfPaymentAdvice(buffer, "temp_file", originalName)
      : await parseXlsxPaymentAdvice(buffer, "temp_file", originalName);

    console.log(`[VERIFY_PAYMENT_ADVICE] File: ${originalName}, IsPDF: ${isPdf}, Extracted Records Count: ${records.length}`);

    if (records.length === 0) {
      return res.status(422).json({
        message: "No line items could be extracted from the uploaded Payment Advice file.",
        originalName,
      });
    }

    // Instantly compare extracted Payment Advice line items against Google Drive Annexure database
    const tallyReport = await tallyPaymentAdviceRecords(records);

    return res.json({
      message: "Payment Advice processed and tallied successfully",
      originalName,
      extractedRowCount: records.length,
      meta,
      report: tallyReport,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to process Payment Advice file" });
  } finally {
    try {
      await fs.unlink(uploadedPath);
    } catch {
      // ignore
    }
  }
}
