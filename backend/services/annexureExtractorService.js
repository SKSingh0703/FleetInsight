import xlsx from "xlsx";
import crypto from "crypto";
import { downloadFileBuffer } from "./googleDriveService.js";
import { DriveFile } from "../models/driveFileModel.js";
import { DriveFolder } from "../models/driveFolderModel.js";
import { AnnexureRecord } from "../models/annexureRecordModel.js";
import { normalizeVehicle } from "../utils/vehicleNormalization.js";

function cleanString(val) {
  if (val == null) return "";
  let s = String(val).trim();
  if (s.toLowerCase() === "invalid date" || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") {
    return "";
  }
  // Strip trailing .0 from numeric strings (e.g. "910181559.0" -> "910181559")
  if (/^\d+\.0$/.test(s)) {
    s = s.slice(0, -2);
  }
  return s;
}

function parseNumber(val) {
  if (val == null) return 0;
  if (typeof val === "number" && Number.isFinite(val)) return val;
  const cleaned = String(val).replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(val) {
  if (val == null || val === "") return undefined;
  if (val instanceof Date && !Number.isNaN(val.getTime())) return val;
  if (typeof val === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + val * 24 * 60 * 60 * 1000);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const s = String(val).trim();
  if (!s) return undefined;

  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    let yy = Number(m[3]);
    if (yy < 100) yy += 2000;
    const d = new Date(Date.UTC(yy, mm - 1, dd));
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function normalizeHeader(h) {
  if (h == null) return "";
  return String(h)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9./ ]+/g, "");
}

// Find title line (e.g. "Annexure to Tax Invoice/ Bill No: NPMT/179/26-27")
function extractTitleBillNumber(sheetData) {
  for (let i = 0; i < Math.min(5, sheetData.length); i++) {
    const row = sheetData[i] || [];
    const text = row.map((c) => String(c || "")).join(" ");

    // Check for "Bill No: NPMT/179/26-27" or "Bill No : NPMT/179/26-27"
    const match = text.match(/bill\s*no\s*:?\s*([A-Za-z0-9/_.-]+)/i);
    if (match && match[1] && match[1].length > 2 && !match[1].toLowerCase().includes("annexure")) {
      return match[1].replace(/^-+/, "").trim();
    }

    const altMatch = text.match(/(NPMT\/[A-Za-z0-9/_.-]+)/i);
    if (altMatch) return altMatch[1].replace(/^-+/, "").trim();
  }
  return "";
}

// Search for the header row among top 10 rows
function detectHeaderRowIndex(sheetData) {
  const keywords = ["sl", "vehicle", "consignment", "lr", "invoice", "delivery", "weight", "freight", "rate"];
  let bestIndex = 0;
  let maxScore = -1;

  for (let i = 0; i < Math.min(10, sheetData.length); i++) {
    const row = sheetData[i] || [];
    let score = 0;
    for (const cell of row) {
      const norm = normalizeHeader(cell);
      if (!norm) continue;
      for (const kw of keywords) {
        if (norm.includes(kw)) score += 1;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestIndex = i;
    }
  }

  return maxScore >= 2 ? bestIndex : 0;
}

// Mapping of schema field -> candidate header aliases
const FIELD_ALIASES = {
  sno: ["sl. no.", "sl no", "sl.no.", "s.no.", "sno", "sr no"],
  lrNumber: ["consignment no/ lorry receipt no.", "consignment no", "lorry receipt no", "lr no", "lr number", "consignment"],
  lrDate: ["consignment date", "lr date", "lorry receipt date"],
  childVendorCode: ["child vendor code", "vendor code"],
  vehicleNumber: ["vehicle no.", "vehicle no", "vehicle number", "truck no", "v.no."],
  materialType: ["material type", "material", "item type"],
  invoiceNumber: ["invoice no. tsl", "invoice no.", "invoice no", "invoice number", "inv no"],
  deliveryNumber: ["delivery no.", "delivery no", "delivery number", "del no"],
  deliveryDate: ["delivery date", "del date", "u date", "unloading date"],
  consignorName: ["consignor/ shipper name", "consignor name", "shipper name", "consignor"],
  consigneeName: ["consignee/ receiving name", "consignee name", "receiving name", "consignee"],
  destination: ["destination", "unloading point", "dest"],
  netWeight: ["net weight", "net wt", "n.w."],
  grossWeight: ["gross weight", "gross wt", "g.w."],
  chargeWeight: ["charge weight", "charged weight", "charge wt"],
  ratePerUnit: ["rate/ unit rs", "rate/ unit", "rate per ton", "rate/ton", "rate"],
  freightBaseAmount: ["freight-base amt rs", "freight-base amt", "freight base amt", "freight amount", "t.f.", "freight"],
  sgst: ["sgst rs", "sgst"],
  cgst: ["cgst rs", "cgst"],
  igst: ["igst rs", "igst"],
  totalAmount: ["total amount", "total amt", "grand total", "net amount"],
};

function mapHeaderColumns(headerRow) {
  const mapping = {}; // fieldName -> columnIndex
  const headerNames = {}; // fieldName -> original header string

  headerRow.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    if (!norm) return;

    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (!mapping[field]) {
        for (const alias of aliases) {
          if (norm.includes(alias)) {
            mapping[field] = idx;
            headerNames[field] = String(h).trim();
            break;
          }
        }
      }
    }
  });

  return { mapping, headerNames };
}

function isTotalRow(rawRowValues, vehicleNo, invoiceNo) {
  const text = rawRowValues.map((v) => String(v || "").toLowerCase()).join(" ");
  if (text.includes("total") || text.includes("grand total") || text.includes("sub total") || text.includes("summary")) {
    return true;
  }
  // Skip if both vehicle number and invoice number are missing
  if (!vehicleNo && !invoiceNo) {
    return true;
  }
  return false;
}

export async function processAnnexureFile(fileId) {
  const driveFile = await DriveFile.findOne({ fileId }).lean();
  if (!driveFile) {
    throw new Error(`DriveFile record not found for id: ${fileId}`);
  }

  const folder = await DriveFolder.findOne({ folderId: driveFile.billFolderId }).lean();
  const folderName = driveFile.billFolderName || folder?.name || "";
  const billFolderPath = driveFile.path || "";
  const folderBillNumber = folder?.billNumber || "";

  let buffer;
  try {
    buffer = await downloadFileBuffer(fileId, driveFile.mimeType);
  } catch (err) {
    await DriveFile.updateOne(
      { fileId },
      {
        $set: {
          extractionStatus: "FAILED",
          extractionError: `Failed to download file: ${err.message}`,
        },
      }
    );
    throw err;
  }

  let workbook;
  try {
    workbook = xlsx.read(buffer, { type: "buffer", cellDates: false, raw: false });
  } catch (err) {
    await DriveFile.updateOne(
      { fileId },
      {
        $set: {
          extractionStatus: "FAILED",
          extractionError: `Failed to parse Excel workbook: ${err.message}`,
        },
      }
    );
    throw err;
  }

  const recordsToSave = [];
  let totalExtracted = 0;

  for (const sheetName of workbook.SheetNames || []) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    // Convert sheet to array of arrays
    const sheetData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
    if (!sheetData || sheetData.length === 0) continue;

    const titleBillNumber = extractTitleBillNumber(sheetData);
    const effectiveBillNumber = titleBillNumber || folderBillNumber || folderName;

    // Financial year extraction (e.g., 2026-27 or 26-27)
    const fyMatch = (titleBillNumber || folderName || billFolderPath).match(/\b(20\d{2}[-_]\d{2,4}|\d{2}[-_]\d{2})\b/);
    const financialYear = fyMatch ? fyMatch[1] : "2026-27";

    const headerIdx = detectHeaderRowIndex(sheetData);
    const headerRow = (sheetData[headerIdx] || []).map((c) => String(c || "").trim());
    const { mapping, headerNames } = mapHeaderColumns(headerRow);

    for (let r = headerIdx + 1; r < sheetData.length; r++) {
      const rowCells = sheetData[r] || [];
      if (!rowCells || rowCells.every((c) => String(c || "").trim() === "")) continue;

      const getValue = (field) => {
        const colIdx = mapping[field];
        if (colIdx == null) return undefined;
        return rowCells[colIdx];
      };

      const rawVehicleNumber = cleanString(getValue("vehicleNumber"));
      const invoiceNumber = cleanString(getValue("invoiceNumber"));
      const deliveryNumber = cleanString(getValue("deliveryNumber"));

      if (isTotalRow(rowCells, rawVehicleNumber, invoiceNumber)) continue;

      const { vehicleNumber, vehicleSuffix } = normalizeVehicle(rawVehicleNumber);
      const lrNumber = cleanString(getValue("lrNumber"));
      const lrDate = parseDate(getValue("lrDate"));
      const deliveryDate = parseDate(getValue("deliveryDate"));

      const materialType = cleanString(getValue("materialType"));
      const consignorName = cleanString(getValue("consignorName"));
      const consigneeName = cleanString(getValue("consigneeName"));
      const destination = cleanString(getValue("destination"));

      const netWeight = parseNumber(getValue("netWeight"));
      const grossWeight = parseNumber(getValue("grossWeight"));
      const chargeWeight = parseNumber(getValue("chargeWeight"));
      const ratePerUnit = parseNumber(getValue("ratePerUnit"));
      const freightBaseAmount = parseNumber(getValue("freightBaseAmount"));
      const sgst = parseNumber(getValue("sgst"));
      const cgst = parseNumber(getValue("cgst"));
      const igst = parseNumber(getValue("igst"));

      const calculatedTotal = freightBaseAmount + sgst + cgst + igst;
      const totalAmount = parseNumber(getValue("totalAmount")) || calculatedTotal;

      // Construct full raw object using header names
      const rawObj = {};
      headerRow.forEach((h, idx) => {
        if (h) {
          rawObj[h] = rowCells[idx] ?? "";
        }
      });

      const rowNumber = r + 1;
      const keyPayload = `${fileId}:${sheetName}:${rowNumber}`;
      const annexureKey = crypto.createHash("sha256").update(keyPayload).digest("hex");

      recordsToSave.push({
        annexureKey,
        fileId,
        fileName: driveFile.name,
        folderId: driveFile.billFolderId,
        folderName,
        billFolderPath,
        fileModifiedTime: driveFile.driveModifiedTime,
        sheetName,
        rowNumber,
        headerMapping: headerNames,
        raw: rawObj,
        billNumber: effectiveBillNumber,
        invoiceNumber,
        deliveryNumber,
        vehicleNumber: vehicleNumber || rawVehicleNumber,
        vehicleSuffix,
        lrNumber,
        lrDate,
        deliveryDate,
        materialType,
        consignorName,
        consigneeName,
        destination,
        netWeight,
        grossWeight,
        chargeWeight,
        ratePerUnit,
        freightBaseAmount,
        sgst,
        cgst,
        igst,
        totalAmount,
        financialYear,
        processingStatus: "SUCCESS",
      });

      totalExtracted += 1;
    }
  }

  if (recordsToSave.length > 0) {
    const ops = recordsToSave.map((rec) => ({
      updateOne: {
        filter: { annexureKey: rec.annexureKey },
        update: { $set: rec },
        upsert: true,
      },
    }));

    await AnnexureRecord.bulkWrite(ops, { ordered: false });
  }

  await DriveFile.updateOne(
    { fileId },
    {
      $set: {
        extractionStatus: "SUCCESS",
        extractionError: "",
        extractedRowCount: totalExtracted,
      },
    }
  );

  return totalExtracted;
}

export async function processAllPendingAnnexures() {
  const pendingFiles = await DriveFile.find({
    isAnnexureCandidate: true,
    extractionStatus: { $in: ["PENDING", "FAILED"] },
  }).lean();

  let processedCount = 0;
  let totalRowsExtracted = 0;
  const errors = [];

  for (const f of pendingFiles) {
    try {
      const count = await processAnnexureFile(f.fileId);
      processedCount += 1;
      totalRowsExtracted += count;
    } catch (err) {
      errors.push({ fileId: f.fileId, fileName: f.name, error: err.message });
    }
  }

  return {
    processedCount,
    totalRowsExtracted,
    errors,
  };
}
