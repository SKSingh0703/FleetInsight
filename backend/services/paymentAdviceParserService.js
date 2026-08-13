import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import xlsx from "xlsx";
import crypto from "crypto";
import { AnnexureRecord } from "../models/annexureRecordModel.js";
import { normalizeVehicle } from "../utils/vehicleNormalization.js";

function cleanString(val) {
  if (val == null) return "";
  let s = String(val).trim();
  if (/^\d+\.0$/.test(s)) {
    s = s.slice(0, -2);
  }
  return s;
}

function stripLeadingZeros(val) {
  if (val == null) return "";
  let s = String(val).trim();
  if (/^\d+\.0$/.test(s)) s = s.slice(0, -2);
  if (/^0+\d+$/.test(s)) {
    s = s.replace(/^0+/, "");
  }
  return s;
}

function normalizeBillNo(val) {
  if (!val) return "";
  let s = String(val).trim();
  s = s.replace(/^-+/, "");
  s = s.replace(/\/(\d{2})(\d{2})$/, "/$1-$2");
  return s;
}

function getBillBaseCode(val) {
  if (!val) return "";
  let s = normalizeBillNo(val);
  return s.replace(/\/\d{2}[-_]?\d{2}$/, "").trim();
}

function parseAmount(val) {
  if (val == null) return 0;
  if (typeof val === "number" && Number.isFinite(val)) return val;
  let s = String(val).replace(/,/g, "").trim();
  let isNegative = false;
  if (s.endsWith("-")) {
    isNegative = true;
    s = s.slice(0, -1);
  } else if (s.startsWith("-")) {
    isNegative = true;
    s = s.slice(1);
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return isNegative ? -Math.abs(n) : n;
}

function parseDate(val) {
  if (!val) return undefined;
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
    let p1 = Number(m[1]);
    let p2 = Number(m[2]);
    let yy = Number(m[3]);
    if (yy < 100) yy += 2000;

    let dd, mm;
    if (p1 <= 12 && p2 > 12) {
      // MM/DD/YYYY format (e.g. 7/22/2026)
      mm = p1;
      dd = p2;
    } else {
      // DD/MM/YYYY format (e.g. 22/07/2026 or 08/05/2026)
      dd = p1;
      mm = p2;
    }

    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      const d = new Date(Date.UTC(yy, mm - 1, dd));
      return Number.isNaN(d.getTime()) ? undefined : d;
    }
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// Extract PDF Header Info
function parsePdfHeaderMeta(text) {
  const meta = {
    paymentDocNo: "",
    valueDate: undefined,
    bankRefNo: "",
    vendorCode: "",
    vendorName: "",
    totalAmount: 0,
    currency: "INR",
  };

  const docNoMatch = text.match(/Payment Doc No\s*:?\s*(\d+)/i) || text.match(/Payment Document\s*:?\s*(\d+)/i) || text.match(/Payment doc(?:ument)?\s*:?\s*(\d+)/i);
  if (docNoMatch) meta.paymentDocNo = docNoMatch[1].trim();

  const valDateMatch = text.match(/Value date\s*:?\s*([\d./-]+)/i) || text.match(/Payment Date\s*:?\s*([\d./-]+)/i) || text.match(/Early Payment Date\s*:?\s*([\d./-]+)/i);
  if (valDateMatch) meta.valueDate = parseDate(valDateMatch[1]);

  const bankRefMatch = text.match(/Bank Ref No\s*:?\s*([\w\d]+)/i);
  if (bankRefMatch) meta.bankRefNo = bankRefMatch[1].trim();

  const vendorCodeMatch = text.match(/Beneficiary Code\s*:?\s*(\d+)/i) || text.match(/Vendor Code\s*:?\s*(\d+)/i);
  if (vendorCodeMatch) meta.vendorCode = vendorCodeMatch[1].trim();

  const totalAmtMatch = text.match(/Payment amount\s*([\d,.]+)/i) || text.match(/for Rs\s*\.?\s*([\d,.]+)/i);
  if (totalAmtMatch) meta.totalAmount = parseAmount(totalAmtMatch[1]);

  return meta;
}

// Parse 2-Line PDF Layout (Layout A - Tata Steel standard advice)
function parse2LinePdfRows(lines, meta, fileId, fileName) {
  const records = [];
  let pageNumber = 1;
  let rowIndex = 0;

  for (let i = 0; i < lines.length - 1; i++) {
    const line1 = lines[i].trim();
    const line2 = lines[i + 1].trim();

    if (line1.includes("Page ") && line1.includes(" of ")) {
      const pMatch = line1.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
      if (pMatch) pageNumber = Number(pMatch[1]);
      continue;
    }

    // Match Line 1: InvoiceNo (e.g. 0909221826, NPMT/91/2627, PLS REFER ATTACH), DocNo (8-12 digits), DocDate (DD/MM/YYYY), PostingDate (DD/MM/YYYY)
    const m1 = line1.match(/^(.+?)\s+(\d{8,12})\s+([\d./-]+)(?:\s+([\d./-]+))?$/i);
    if (!m1) continue;

    const invoiceNumber = cleanString(m1[1]);
    const documentNumber = cleanString(m1[2]);
    const documentDate = parseDate(m1[3]);
    const postingDate = parseDate(m1[4]);

    // Match Line 2: InvoiceAmount, Deductions, NetAmount
    const m2 = line2.match(/^([\d,. -]+)\s+([\d,. -]+)\s+([\d,. -]+)$/);
    if (!m2) continue;

    let deliveryNumber = "";
    let grossAmount = parseAmount(m2[1]);
    const deductionAmount = parseAmount(m2[2]);
    const netAmount = parseAmount(m2[3]);

    // If m2[1] looks like a delivery/invoice number (6-10 digits without decimal, e.g. 902998, 891023)
    if (/^\d{6,10}$/.test(m2[1].trim())) {
      deliveryNumber = m2[1].trim();
    }

    if (invoiceNumber.toLowerCase().includes("payment") || invoiceNumber.toLowerCase().includes("page") || invoiceNumber.toLowerCase().includes("invoice")) {
      continue;
    }

    rowIndex += 1;
    const docScope = meta.paymentDocNo ? `doc_${meta.paymentDocNo}` : fileId;
    const adviceKeyPayload = `${docScope}:${pageNumber}:${rowIndex}:${invoiceNumber}:${documentNumber}:${grossAmount}:${netAmount}`;
    const adviceKey = crypto.createHash("sha256").update(adviceKeyPayload).digest("hex");

    records.push({
      adviceKey,
      fileId,
      fileName,
      paymentDocNo: meta.paymentDocNo,
      paymentDate: meta.valueDate,
      bankRefNo: meta.bankRefNo,
      vendorCode: meta.vendorCode,

      invoiceNumber,
      deliveryNumber,
      documentNumber,
      documentDate,
      postingDate,

      grossAmount,
      deductionAmount,
      netAmount,
      currency: meta.currency,

      pageNumber,
      rowNumber: rowIndex,

      raw: {
        line1,
        line2,
        invoiceNumber,
        documentNumber,
        documentDate: m1[3],
        postingDate: m1[4],
        grossAmount: m2[1],
        deductionAmount: m2[2],
        netAmount: m2[3],
      },
      headerMapping: {
        invoiceNumber: "Invoice Number",
        documentNumber: "Document Number",
        documentDate: "Document Date",
        postingDate: "Posting Date",
        grossAmount: "Invoice Amount",
        deductionAmount: "Deductions",
        netAmount: "Net Amount",
      },
    });

    i += 1; // Skip line2
  }

  return records;
}

// Parse 2-Line Bill Reference PDF Layout (Layout A2 - Tata Steel Bill Reference Advice)
function parseBillReference2LinePdfRows(lines, meta, fileId, fileName) {
  const records = [];
  let pageNumber = 1;
  let rowIndex = 0;

  for (let i = 0; i < lines.length - 1; i++) {
    const line1 = lines[i].trim();
    const line2 = lines[i + 1].trim();

    if (line1.includes("Page ") && line1.includes(" of ")) {
      const pMatch = line1.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
      if (pMatch) pageNumber = Number(pMatch[1]);
      continue;
    }

    // Match Line 1: Document Number (8-12 digits), Bill Reference No (e.g. LOG/197/26-27), Invoice Amount, Deductions
    // Example: 1900014714 LOG/197/26-27 11305.34 96.00
    const m1 = line1.match(/^(\d{8,12})\s+([A-Za-z0-9\/_\-\.]+)\s+([\d,\.\-]+)\s+([\d,\.\-]+)$/);
    if (!m1) continue;

    const documentNumber = cleanString(m1[1]);
    const billRef = cleanString(m1[2]);
    const grossAmount = parseAmount(m1[3]);
    const deductionAmount = parseAmount(m1[4]);

    // Match Line 2: Net Amount, Deduction code (optional, e.g. KR)
    // Example: 11209.34 KR  or  11209.34
    const m2 = line2.match(/^([\d,\.\-]+)(?:\s+([A-Za-z0-9]+))?$/);
    if (!m2) continue;

    const netAmount = parseAmount(m2[1]);
    const deductionCode = cleanString(m2[2] || "");

    if (!billRef || billRef.toLowerCase().includes("reference") || billRef.toLowerCase().includes("bill") || billRef.toLowerCase().includes("document")) {
      continue;
    }

    if (grossAmount === 0 && netAmount === 0) continue;

    rowIndex += 1;
    const docScope = meta.paymentDocNo ? `doc_${meta.paymentDocNo}` : fileId;
    const adviceKeyPayload = `${docScope}:${pageNumber}:${rowIndex}:${billRef}:${documentNumber}:${grossAmount}:${netAmount}`;
    const adviceKey = crypto.createHash("sha256").update(adviceKeyPayload).digest("hex");

    records.push({
      adviceKey,
      fileId,
      fileName,
      paymentDocNo: meta.paymentDocNo,
      paymentDate: meta.valueDate,
      bankRefNo: meta.bankRefNo,
      vendorCode: meta.vendorCode,

      invoiceNumber: billRef,
      billNumber: billRef,
      documentNumber,
      deductionCode,

      grossAmount,
      deductionAmount,
      netAmount,
      currency: meta.currency,

      pageNumber,
      rowNumber: rowIndex,

      raw: {
        line1,
        line2,
        documentNumber,
        billReferenceNo: billRef,
        grossAmount: m1[3],
        deductionAmount: m1[4],
        netAmount: m2[1],
        deductionCode,
      },
      headerMapping: {
        documentNumber: "Document Number",
        invoiceNumber: "Bill Reference No",
        grossAmount: "Invoice Amount",
        deductionAmount: "Deductions",
        netAmount: "Net Amount",
        deductionCode: "Deduction Code",
      },
    });

    i += 1; // Skip line2
  }

  return records;
}

// Parse Single-Line Tabular PDF Layout (Layout B)
function parseSingleLinePdfRows(lines, meta, fileId, fileName) {
  const records = [];
  let rowIndex = 0;

  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;

    const tokens = s.split(/\s+/);
    if (tokens.length < 5) continue;

    let dateIdx = -1;
    for (let i = 0; i < tokens.length; i++) {
      if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(tokens[i])) {
        dateIdx = i;
        break;
      }
    }

    if (dateIdx < 1 || dateIdx + 3 >= tokens.length) continue;

    const invoiceNumber = cleanString(tokens[dateIdx - 1]);
    const documentDate = parseDate(tokens[dateIdx]);
    const grossAmount = parseAmount(tokens[dateIdx + 1]);
    const deductionAmount = parseAmount(tokens[dateIdx + 2]);
    const netAmount = parseAmount(tokens[dateIdx + 3]);
    const documentNumber = cleanString(tokens[dateIdx + 4] || "");
    const paymentReferenceNumber = cleanString(tokens[dateIdx + 5] || "");
    const discountAmount = parseAmount(tokens[dateIdx + 6] || "0");

    if (!invoiceNumber || invoiceNumber.toLowerCase().includes("number") || invoiceNumber.toLowerCase().includes("date") || invoiceNumber.toLowerCase().includes("invoice")) {
      continue;
    }

    rowIndex += 1;
    const docScope = meta.paymentDocNo ? `doc_${meta.paymentDocNo}` : fileId;
    const adviceKeyPayload = `${docScope}:1:${rowIndex}:${invoiceNumber}:${documentNumber}:${grossAmount}:${netAmount}`;
    const adviceKey = crypto.createHash("sha256").update(adviceKeyPayload).digest("hex");

    records.push({
      adviceKey,
      fileId,
      fileName,
      paymentDocNo: meta.paymentDocNo,
      paymentDate: meta.valueDate,
      bankRefNo: meta.bankRefNo,
      vendorCode: meta.vendorCode,

      invoiceNumber,
      documentNumber,
      paymentReferenceNumber,
      documentDate,

      grossAmount,
      deductionAmount,
      discountAmount,
      netAmount,
      currency: meta.currency,

      pageNumber: 1,
      rowNumber: rowIndex,

      raw: {
        line: s,
        invoiceNumber,
        documentDate: tokens[dateIdx],
        grossAmount: tokens[dateIdx + 1],
        deductionAmount: tokens[dateIdx + 2],
        netAmount: tokens[dateIdx + 3],
        documentNumber: tokens[dateIdx + 4],
        paymentReferenceNumber: tokens[dateIdx + 5],
        discountAmount: tokens[dateIdx + 6],
      },
      headerMapping: {
        invoiceNumber: "Vendor Invoice Number",
        grossAmount: "Gross Amount",
        deductionAmount: "Adjustments/ TDS",
        netAmount: "Net Amount",
        documentNumber: "FI Document No Details",
        paymentReferenceNumber: "Payment Reference Number",
        discountAmount: "Discount Amount",
      },
    });
  }

  return records;
}

// Parse Indexed Tabular PDF Layout (Layout C - Tata Steel 9-column indexed advice)
function parseTabularIndexedPdfRows(lines, meta, fileId, fileName) {
  const records = [];
  let rowIndex = 0;

  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;

    // Pattern: [Optional SrNo] [InvoiceNo] [Date] [Gross] [TDS] [Net] [DocumentNo] [RefNo] [Discount]
    const m = s.match(/^(?:\d+\.?\s+)?([A-Z0-9/_-]{6,25})\s+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)(?:\s+([A-Z0-9]+))?(?:\s+([A-Z0-9]+))?(?:\s+([\d,.]+))?/i);
    if (!m) continue;

    const invoiceNumber = cleanString(m[1]);
    if (!invoiceNumber || invoiceNumber.toLowerCase().includes("vendor") || invoiceNumber.toLowerCase().includes("number") || invoiceNumber.toLowerCase().includes("invoice")) {
      continue;
    }

    const documentDate = parseDate(m[2]);
    const grossAmount = parseAmount(m[3]);
    const deductionAmount = parseAmount(m[4]);
    const netAmount = parseAmount(m[5]);
    const documentNumber = cleanString(m[6] || "");
    const paymentReferenceNumber = cleanString(m[7] || "");
    const discountAmount = parseAmount(m[8] || "0");

    rowIndex += 1;
    const docScope = meta.paymentDocNo ? `doc_${meta.paymentDocNo}` : fileId;
    const adviceKeyPayload = `${docScope}:1:${rowIndex}:${invoiceNumber}:${documentNumber}:${grossAmount}:${netAmount}`;
    const adviceKey = crypto.createHash("sha256").update(adviceKeyPayload).digest("hex");

    records.push({
      adviceKey,
      fileId,
      fileName,
      paymentDocNo: meta.paymentDocNo,
      paymentDate: meta.valueDate,
      bankRefNo: meta.bankRefNo,
      vendorCode: meta.vendorCode,

      invoiceNumber,
      documentNumber,
      paymentReferenceNumber,
      documentDate,

      grossAmount,
      deductionAmount,
      discountAmount,
      netAmount,
      currency: meta.currency,

      pageNumber: 1,
      rowNumber: rowIndex,

      raw: {
        line: s,
        invoiceNumber,
        documentDate: m[2],
        grossAmount: m[3],
        deductionAmount: m[4],
        netAmount: m[5],
        documentNumber: m[6] || "",
        paymentReferenceNumber: m[7] || "",
        discountAmount: m[8] || "0",
      },
      headerMapping: {
        invoiceNumber: "Vendor Invoice Number",
        grossAmount: "Gross Amount",
        deductionAmount: "Adjustments/ TDS",
        netAmount: "Net Amount",
        documentNumber: "FI Document No Details",
        paymentReferenceNumber: "Payment Reference Number",
        discountAmount: "Discount Amount",
      },
    });
  }

  return records;
}

// Parse Universal Token Stream PDF Layout (Layout D)
function parseTokenStreamPdfRows(text, meta, fileId, fileName) {
  const records = [];
  if (!text) return records;

  const tokens = text.replace(/\u00a0/g, " ").split(/\s+/).map((t) => t.trim()).filter(Boolean);
  let rowIndex = 0;
  const dateRegex = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/;
  const seenKeys = new Set();

  for (let i = 0; i < tokens.length; i++) {
    if (dateRegex.test(tokens[i])) {
      const documentDate = parseDate(tokens[i]);
      if (!documentDate) continue;

      let invoiceNumber = "";
      for (let k = i - 1; k >= Math.max(0, i - 3); k--) {
        const tok = cleanString(tokens[k]);
        if (!tok) continue;
        const low = tok.toLowerCase();
        if (low.includes("date") || low.includes("number") || low.includes("code") || low.includes("sr") || low.includes("no") || low.includes("details") || low.includes("amount") || low.includes("payment")) {
          continue;
        }
        // Never accept dates or payment doc numbers as invoice number
        if (dateRegex.test(tok)) continue;
        if (meta.paymentDocNo && tok === meta.paymentDocNo) continue;
        if (/^0045\d{6}$/.test(tok) || /^0039\d{6}$/.test(tok) || /^0050\d{6}$/.test(tok)) continue;

        if (/^[A-Z0-9/_-]{6,25}$/i.test(tok) && /\d/.test(tok)) {
          invoiceNumber = tok;
          break;
        }
      }

      if (!invoiceNumber || dateRegex.test(invoiceNumber)) continue;

      const numTokens = [];
      let docNo = "";
      let refNo = "";

      for (let j = i + 1; j < Math.min(tokens.length, i + 8); j++) {
        const tok = tokens[j];
        if (dateRegex.test(tok)) break;
        if (/^\d{9,12}$/.test(tok) && !docNo) {
          docNo = tok;
          continue;
        }
        if (/^[A-Z0-9]{8,16}$/i.test(tok) && /[A-Z]/i.test(tok) && !refNo) {
          refNo = tok;
          continue;
        }
        if (/^-?[\d,.]+(\.\d+)?$/.test(tok) && !tok.includes("/")) {
          numTokens.push(parseAmount(tok));
        }
      }

      if (numTokens.length < 1) continue;

      let grossAmount = numTokens[0] || 0;
      let deductionAmount = numTokens.length >= 3 ? numTokens[1] : 0;
      let netAmount = numTokens.length >= 3 ? numTokens[2] : (numTokens[1] || numTokens[0] || 0);

      const dupKey = `${invoiceNumber}:${tokens[i]}:${netAmount}`;
      if (seenKeys.has(dupKey)) continue;
      seenKeys.add(dupKey);

      rowIndex += 1;
      const docScope = meta.paymentDocNo ? `doc_${meta.paymentDocNo}` : fileId;
      const adviceKeyPayload = `${docScope}:ts:${rowIndex}:${invoiceNumber}:${docNo}:${grossAmount}:${netAmount}`;
      const adviceKey = crypto.createHash("sha256").update(adviceKeyPayload).digest("hex");

      records.push({
        adviceKey,
        fileId,
        fileName,
        paymentDocNo: meta.paymentDocNo,
        paymentDate: meta.valueDate,
        bankRefNo: meta.bankRefNo,
        vendorCode: meta.vendorCode,

        invoiceNumber,
        documentNumber: docNo,
        paymentReferenceNumber: refNo,
        documentDate,

        grossAmount,
        deductionAmount,
        netAmount,
        currency: meta.currency,

        pageNumber: 1,
        rowNumber: rowIndex,

        raw: {
          invoiceNumber,
          documentDate: tokens[i],
          grossAmount,
          deductionAmount,
          netAmount,
          documentNumber: docNo,
          paymentReferenceNumber: refNo,
        },
        headerMapping: {
          invoiceNumber: "Vendor Invoice Number",
          grossAmount: "Gross Amount",
          deductionAmount: "Adjustments/ TDS",
          netAmount: "Net Amount",
          documentNumber: "FI Document No Details",
          paymentReferenceNumber: "Payment Reference Number",
        },
      });
    }
  }

  return records;
}

// Fallback Any-Format PDF Extractor (Layout E)
function parseFallbackAnyFormatPdfRows(rawText, meta, fileId, fileName) {
  const records = [];
  if (!rawText) return records;

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let rowIndex = 0;
  const seenInvoices = new Set();
  const dateRegex = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/;

  for (const line of lines) {
    const invMatches = [...line.matchAll(/\b([0-9]{8,12}|[A-Z0-9/_-]{8,25})\b/gi)];
    const dateMatch = line.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/);
    const amountMatches = [...line.matchAll(/\b(\d{3,7}\.\d{2})\b/g)];

    if (invMatches.length > 0 && amountMatches.length > 0) {
      let invoiceNumber = "";
      let documentNumber = "";

      for (const m of invMatches) {
        const val = cleanString(m[1]);
        const low = val.toLowerCase();
        if (low.includes("vendor") || low.includes("account") || low.includes("phone") || low.includes("code") || low.includes("total") || low.includes("amount") || low.includes("payment")) continue;
        if (dateRegex.test(val)) continue;
        if (meta.paymentDocNo && val === meta.paymentDocNo) continue;

        if (/^0039\d{6}$/.test(val) || /^0038\d{6}$/.test(val) || /^0050\d{6}$/.test(val) || /^0045\d{6}$/.test(val)) {
          documentNumber = val;
        } else if (!invoiceNumber && val.length >= 6) {
          invoiceNumber = val;
        }
      }

      if (!invoiceNumber || dateRegex.test(invoiceNumber) || seenInvoices.has(invoiceNumber)) continue;
      seenInvoices.add(invoiceNumber);

      const documentDate = dateMatch ? parseDate(dateMatch[1]) : undefined;
      const amounts = amountMatches.map((m) => parseAmount(m[1]));
      const grossAmount = amounts[0] || 0;
      const netAmount = amounts.length >= 2 ? amounts[amounts.length - 1] : grossAmount;

      rowIndex += 1;
      const docScope = meta.paymentDocNo ? `doc_${meta.paymentDocNo}` : fileId;
      const adviceKeyPayload = `${docScope}:fb:${rowIndex}:${invoiceNumber}:${documentNumber}:${grossAmount}:${netAmount}`;
      const adviceKey = crypto.createHash("sha256").update(adviceKeyPayload).digest("hex");

      records.push({
        adviceKey,
        fileId,
        fileName,
        paymentDocNo: meta.paymentDocNo,
        paymentDate: meta.valueDate,
        bankRefNo: meta.bankRefNo,
        vendorCode: meta.vendorCode,

        invoiceNumber,
        documentNumber,
        documentDate,

        grossAmount,
        deductionAmount: 0,
        netAmount,
        currency: meta.currency,

        pageNumber: 1,
        rowNumber: rowIndex,

        raw: {
          line,
          invoiceNumber,
          documentNumber,
          grossAmount,
          netAmount,
        },
        headerMapping: {
          invoiceNumber: "Invoice Number",
          grossAmount: "Gross Amount",
          netAmount: "Net Amount",
        },
      });
    }
  }

  return records;
}

function pageDataToText(pageData) {
  return pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
    .then(function(textContent) {
      let lastY = null;
      let text = '';
      for (const item of textContent.items) {
        if (!item || !item.str) continue;
        const currentY = Array.isArray(item.transform) ? Math.round(item.transform[5] * 10) / 10 : null;
        if (lastY === null || currentY === null) {
          text += (text ? ' ' : '') + item.str;
        } else if (Math.abs(lastY - currentY) < 3) {
          text += ' ' + item.str;
        } else {
          text += '\n' + item.str;
        }
        if (currentY !== null) lastY = currentY;
      }
      return text;
    });
}

function repairPdfXref(buffer) {
  try {
    const str = buffer.toString("binary");
    const xrefPos = str.lastIndexOf("xref");
    if (xrefPos !== -1) {
      const startXrefPos = str.lastIndexOf("startxref");
      if (startXrefPos !== -1) {
        const eofPos = str.lastIndexOf("%%EOF");
        if (eofPos !== -1 && eofPos > startXrefPos) {
          const header = str.substring(0, startXrefPos);
          const repairedStr = `${header}startxref\n${xrefPos}\n%%EOF\n`;
          return Buffer.from(repairedStr, "binary");
        }
      }
    }
  } catch {
    // ignore
  }
  return buffer;
}

export async function safePdfParse(buffer) {
  let textStandard = "";
  let textYBaseline = "";

  try {
    const dataStd = await pdfParse(buffer);
    textStandard = dataStd.text || "";
  } catch {
    let sanitized = repairPdfXref(buffer);
    try {
      const dataStd = await pdfParse(Buffer.from(sanitized));
      textStandard = dataStd.text || "";
    } catch {
      // ignore
    }
  }

  try {
    const dataY = await pdfParse(buffer, { pagerender: pageDataToText });
    textYBaseline = dataY.text || "";
  } catch {
    // ignore
  }

  return { textStandard, textYBaseline };
}

// Parse PDF File (Evaluates all layout strategies on both standard and Y-baseline texts)
export async function parsePdfPaymentAdvice(buffer, fileId, fileName) {
  const { textStandard, textYBaseline } = await safePdfParse(buffer);

  const metaStd = parsePdfHeaderMeta(textStandard);
  const metaY = parsePdfHeaderMeta(textYBaseline);
  const meta = metaStd.paymentDocNo ? metaStd : metaY;

  const linesStd = textStandard.replace(/\u00a0/g, " ").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const linesY = textYBaseline.replace(/\u00a0/g, " ").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const records2LineStd = parse2LinePdfRows(linesStd, meta, fileId, fileName);
  const records2LineY = parse2LinePdfRows(linesY, meta, fileId, fileName);

  const recordsBillRef2LineStd = parseBillReference2LinePdfRows(linesStd, meta, fileId, fileName);
  const recordsBillRef2LineY = parseBillReference2LinePdfRows(linesY, meta, fileId, fileName);

  const recordsSingleStd = parseSingleLinePdfRows(linesStd, meta, fileId, fileName);
  const recordsSingleY = parseSingleLinePdfRows(linesY, meta, fileId, fileName);

  const recordsIndexedStd = parseTabularIndexedPdfRows(linesStd, meta, fileId, fileName);
  const recordsIndexedY = parseTabularIndexedPdfRows(linesY, meta, fileId, fileName);

  const recordsTokenStd = parseTokenStreamPdfRows(textStandard, meta, fileId, fileName);
  const recordsTokenY = parseTokenStreamPdfRows(textYBaseline, meta, fileId, fileName);

  const recordsFallbackStd = parseFallbackAnyFormatPdfRows(textStandard, meta, fileId, fileName);
  const recordsFallbackY = parseFallbackAnyFormatPdfRows(textYBaseline, meta, fileId, fileName);

  // Structural parsers (2-line, single-line tabular, indexed tabular) have higher confidence
  // We score candidate record sets: valid records + structural boost (+1000)
  const scoreCandidate = (cand, isStructural) => {
    if (!Array.isArray(cand) || cand.length === 0) return 0;
    const valid = cand.filter(
      (r) => r.invoiceNumber && !/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(r.invoiceNumber) && r.invoiceNumber !== meta.paymentDocNo
    );
    if (valid.length === 0) return 0;
    return valid.length + (isStructural ? 1000 : 0);
  };

  const list = [
    { recs: recordsBillRef2LineStd, score: scoreCandidate(recordsBillRef2LineStd, true), name: "BillRef2LineStd" },
    { recs: recordsBillRef2LineY, score: scoreCandidate(recordsBillRef2LineY, true), name: "BillRef2LineY" },
    { recs: records2LineStd, score: scoreCandidate(records2LineStd, true), name: "2LineStd" },
    { recs: records2LineY, score: scoreCandidate(records2LineY, true), name: "2LineY" },
    { recs: recordsSingleStd, score: scoreCandidate(recordsSingleStd, true), name: "SingleStd" },
    { recs: recordsSingleY, score: scoreCandidate(recordsSingleY, true), name: "SingleY" },
    { recs: recordsIndexedStd, score: scoreCandidate(recordsIndexedStd, true), name: "IndexedStd" },
    { recs: recordsIndexedY, score: scoreCandidate(recordsIndexedY, true), name: "IndexedY" },
    { recs: recordsTokenStd, score: scoreCandidate(recordsTokenStd, false), name: "TokenStd" },
    { recs: recordsTokenY, score: scoreCandidate(recordsTokenY, false), name: "TokenY" },
    { recs: recordsFallbackStd, score: scoreCandidate(recordsFallbackStd, false), name: "FallbackStd" },
    { recs: recordsFallbackY, score: scoreCandidate(recordsFallbackY, false), name: "FallbackY" },
  ].sort((a, b) => b.score - a.score);

  const best = list[0];
  const records = best.recs || [];

  console.log(`[parsePdfPaymentAdvice] Winner: ${best.name} with ${records.length} valid records from PDF ${fileName}`);

  return { meta, records };
}

// Helper for exact and fuzzy column matching
function getColumnValue(row, exactKeys, aliasList, excludeList = []) {
  if (!row || typeof row !== "object") return undefined;
  const keys = Object.keys(row);

  // 1. Try exact equality match first (case-insensitive)
  for (const k of keys) {
    const nk = String(k).trim().toLowerCase().replace(/\s+/g, " ");
    if (exactKeys.includes(nk)) {
      const val = row[k];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return val;
      }
    }
  }

  // 2. Try substring matching with exclude filtering
  for (const k of keys) {
    const nk = String(k).trim().toLowerCase().replace(/\s+/g, " ");
    if (excludeList.some((ex) => nk.includes(ex.toLowerCase()))) {
      continue;
    }
    for (const alias of aliasList) {
      if (nk.includes(alias.toLowerCase())) {
        const val = row[k];
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          return val;
        }
      }
    }
  }

  return undefined;
}

// Parse XLSX Payment Advice File
export async function parseXlsxPaymentAdvice(buffer, fileId, fileName) {
  const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true, raw: false });
  const records = [];
  let meta = {
    paymentDocNo: "",
    valueDate: undefined,
    bankRefNo: "",
    vendorCode: "",
    vendorName: "",
    totalAmount: 0,
    currency: "INR",
  };

  const docNoExact = ["fu number", "fu no", "rfu number", "rfu no", "factoring unit number", "factoring unit no", "fi document no", "fi document number", "document number", "doc no", "document no"];
  const docNoAliases = ["fu number", "rfu number", "factoring unit", "fi document", "document no", "doc no", "rfu"];
  const docNoExcludes = ["date", "amount", "status", "remarks"];

  const invNoExact = ["vendor invoice number", "invoice number", "invoice no", "inv no", "bill number", "bill no"];
  const invNoAliases = ["vendor invoice number", "invoice number", "invoice no", "inv no", "bill number", "bill no"];
  const invNoExcludes = ["date", "amount", "gross", "net", "acceptance", "status", "remarks", "type", "description", "group", "tds", "fee", "rate"];

  const delNoExact = ["delivery number", "delivery no", "del no", "lr number", "lr no"];
  const delNoAliases = ["delivery number", "delivery no", "del no", "lr number"];

  const vehNoExact = ["vehicle number", "vehicle no", "truck number", "truck no", "lorry number", "lorry no"];
  const vehNoAliases = ["vehicle number", "vehicle no", "truck no"];

  const docDateExact = ["invoice date", "document date", "inv date", "bill date"];
  const docDateAliases = ["invoice date", "document date", "inv date", "bill date"];
  const docDateExcludes = ["acceptance", "posting", "value", "due"];

  const postDateExact = ["invoice acceptance date", "posting date", "value date", "payment date", "due date"];
  const postDateAliases = ["acceptance date", "posting date", "value date", "payment date"];

  const grossAmtExact = ["invoice gross amount", "fu amount", "gross amount", "gross amt", "invoice amount", "bill amount", "total invoice value", "total amount"];
  const grossAmtAliases = ["fu amount", "invoice gross", "gross amount", "gross amt", "invoice amount", "bill amount"];

  const netAmtExact = ["net pay in", "net pay", "net paid", "net amount", "payment amount", "net amt", "amount paid", "total paid"];
  const netAmtAliases = ["net pay in", "net pay", "net paid", "net amount", "payment amount", "net amt"];

  const dedAmtExact = ["adjustments/ tds", "adjustments", "deductions", "tds", "tds amount"];
  const dedAmtAliases = ["adjustment", "deduction", "tds"];

  const interestAmtExact = ["interest amount", "interest", "interest ar"];
  const interestAmtAliases = ["interest amount", "interest"];

  const tredsFeeExact = ["treds fee", "treds fees", "platform fee", "bank fee"];
  const tredsFeeAliases = ["treds fee", "platform fee"];

  const payRefExact = ["payment reference number", "payment ref", "ref no", "reference number", "utr number", "utr no"];
  const payRefAliases = ["payment reference", "payment ref", "ref no", "utr"];

  let globalRowIndex = 0;

  for (const sheetName of workbook.SheetNames || []) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    // Detect header row dynamically
    const rawRows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });
    if (rawRows.length === 0) continue;

    let headerIndex = 0;
    for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
      const rowStr = rawRows[r].join(" ").toLowerCase();
      if (
        rowStr.includes("fu number") ||
        rowStr.includes("invoice number") ||
        rowStr.includes("vendor invoice") ||
        rowStr.includes("gross amount") ||
        rowStr.includes("net pay") ||
        rowStr.includes("net amount") ||
        rowStr.includes("bill number")
      ) {
        headerIndex = r;
        break;
      }
    }

    const rows = xlsx.utils.sheet_to_json(worksheet, { range: headerIndex, defval: "", raw: false });
    if (rows.length === 0) continue;

    // First pass: Extract raw row items
    const parsedRows = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || typeof row !== "object") continue;

      const documentNumber = cleanString(getColumnValue(row, docNoExact, docNoAliases, docNoExcludes));
      const invoiceNumber = cleanString(getColumnValue(row, invNoExact, invNoAliases, invNoExcludes));
      const deliveryNumber = cleanString(getColumnValue(row, delNoExact, delNoAliases));

      const rawVehicle = cleanString(getColumnValue(row, vehNoExact, vehNoAliases));
      const { vehicleNumber, vehicleSuffix } = normalizeVehicle(rawVehicle);

      const paymentReferenceNumber = cleanString(getColumnValue(row, payRefExact, payRefAliases));

      const grossAmount = parseAmount(getColumnValue(row, grossAmtExact, grossAmtAliases));
      const netAmount = parseAmount(getColumnValue(row, netAmtExact, netAmtAliases));
      const deductionAmount = parseAmount(getColumnValue(row, dedAmtExact, dedAmtAliases));
      const interestAmount = parseAmount(getColumnValue(row, interestAmtExact, interestAmtAliases));
      const tredsFee = parseAmount(getColumnValue(row, tredsFeeExact, tredsFeeAliases));

      const cgst = parseAmount(getColumnValue(row, ["cgst"], ["cgst"]));
      const sgst = parseAmount(getColumnValue(row, ["sgst"], ["sgst"]));
      const igst = parseAmount(getColumnValue(row, ["igst"], ["igst"]));
      const ugst = parseAmount(getColumnValue(row, ["ugst"], ["ugst"]));
      const gstAmount = cgst + sgst + igst + ugst;

      const documentDate = parseDate(getColumnValue(row, docDateExact, docDateAliases, docDateExcludes));
      const postingDate = parseDate(getColumnValue(row, postDateExact, postDateAliases));

      // Skip row if completely empty
      if (!invoiceNumber && !documentNumber && !deliveryNumber && grossAmount === 0 && netAmount === 0) {
        continue;
      }

      parsedRows.push({
        rawRowIndex: i + 1,
        documentNumber,
        invoiceNumber,
        deliveryNumber,
        vehicleNumber,
        vehicleSuffix,
        paymentReferenceNumber,
        grossAmount,
        netAmount,
        deductionAmount,
        interestAmount,
        tredsFee,
        gstAmount,
        documentDate,
        postingDate,
        raw: row,
      });
    }

    if (parsedRows.length === 0) continue;

    // Second pass: Group rows by documentNumber / FU Number (or group consecutive rows)
    const groups = [];
    let currentGroup = null;

    for (let i = 0; i < parsedRows.length; i++) {
      const pRow = parsedRows[i];
      const hasDocNo = !!pRow.documentNumber;

      if (hasDocNo) {
        if (currentGroup && currentGroup.documentNumber === pRow.documentNumber) {
          currentGroup.rows.push(pRow);
        } else {
          currentGroup = {
            documentNumber: pRow.documentNumber,
            rows: [pRow],
          };
          groups.push(currentGroup);
        }
      } else {
        if (currentGroup) {
          currentGroup.rows.push(pRow);
        } else {
          currentGroup = {
            documentNumber: "",
            rows: [pRow],
          };
          groups.push(currentGroup);
        }
      }
    }

    // Third pass: Aggregate each group into clean Payment Advice records
    for (const group of groups) {
      let groupDocNo = group.documentNumber;
      let groupNetAmount = 0;
      let groupGrossAmount = 0;
      let groupDeductions = 0;
      let groupPaymentRef = "";
      let groupVehicle = "";
      let groupVehicleSuffix = "";

      for (const r of group.rows) {
        if (!groupDocNo && r.documentNumber) groupDocNo = r.documentNumber;
        if (!groupNetAmount && r.netAmount) groupNetAmount = r.netAmount;
        if (!groupGrossAmount && r.grossAmount) groupGrossAmount = r.grossAmount;
        if (!groupPaymentRef && r.paymentReferenceNumber) groupPaymentRef = r.paymentReferenceNumber;
        if (!groupVehicle && r.vehicleNumber) {
          groupVehicle = r.vehicleNumber;
          groupVehicleSuffix = r.vehicleSuffix;
        }

        const totalFees = r.deductionAmount + r.interestAmount + r.tredsFee + r.gstAmount;
        groupDeductions += totalFees;
      }
      groupDeductions = Math.round(groupDeductions * 100) / 100;

      const invoiceRows = group.rows.filter((r) => r.invoiceNumber || r.deliveryNumber || r.documentDate);

      if (invoiceRows.length === 1) {
        const invRow = invoiceRows[0];
        globalRowIndex += 1;

        const invNo = invRow.invoiceNumber || "";
        const delNo = invRow.deliveryNumber || "";
        const finalGross = invRow.grossAmount || groupGrossAmount || 0;

        let finalDeduction = groupDeductions;
        let finalNet = groupNetAmount;

        if (!finalNet && finalGross) {
          finalNet = Math.max(0, finalGross - finalDeduction);
        } else if (finalNet && !finalDeduction && finalGross && finalGross >= finalNet) {
          finalDeduction = Math.round((finalGross - finalNet) * 100) / 100;
        }

        const docScope = meta.paymentDocNo ? `doc_${meta.paymentDocNo}` : fileId;
        const adviceKeyPayload = `${docScope}:${sheetName}:${globalRowIndex}:${invNo}:${groupDocNo}:${finalGross}:${finalNet}`;
        const adviceKey = crypto.createHash("sha256").update(adviceKeyPayload).digest("hex");

        records.push({
          adviceKey,
          fileId,
          fileName,
          paymentDocNo: meta.paymentDocNo,
          paymentDate: meta.valueDate,
          bankRefNo: meta.bankRefNo,
          vendorCode: meta.vendorCode,

          invoiceNumber: invNo,
          deliveryNumber: delNo,
          vehicleNumber: invRow.vehicleNumber || groupVehicle,
          vehicleSuffix: invRow.vehicleSuffix || groupVehicleSuffix,

          documentNumber: groupDocNo,
          paymentReferenceNumber: invRow.paymentReferenceNumber || groupPaymentRef,
          documentDate: invRow.documentDate,
          postingDate: invRow.postingDate,

          grossAmount: finalGross,
          deductionAmount: finalDeduction,
          discountAmount: 0,
          netAmount: finalNet,
          currency: meta.currency,

          pageNumber: 1,
          rowNumber: globalRowIndex,

          raw: invRow.raw,
          headerMapping: {
            invoiceNumber: "Invoice Number",
            documentNumber: "FU Number",
            grossAmount: "Gross Amount",
            deductionAmount: "Deductions/Fees",
            netAmount: "Net Amount",
          },
        });
      } else if (invoiceRows.length > 1) {
        const totalInvoiceGross = invoiceRows.reduce((sum, r) => sum + (r.grossAmount || 0), 0);

        for (const invRow of invoiceRows) {
          globalRowIndex += 1;
          const invNo = invRow.invoiceNumber || "";
          const delNo = invRow.deliveryNumber || "";
          const rowGross = invRow.grossAmount || (groupGrossAmount ? groupGrossAmount / invoiceRows.length : 0);

          const ratio = totalInvoiceGross > 0 ? rowGross / totalInvoiceGross : 1 / invoiceRows.length;
          const rowNet = invRow.netAmount || Math.round((groupNetAmount * ratio) * 100) / 100;
          const rowDeduction = Math.round((rowGross - rowNet) * 100) / 100;

          const docScope = meta.paymentDocNo ? `doc_${meta.paymentDocNo}` : fileId;
          const adviceKeyPayload = `${docScope}:${sheetName}:${globalRowIndex}:${invNo}:${groupDocNo}:${rowGross}:${rowNet}`;
          const adviceKey = crypto.createHash("sha256").update(adviceKeyPayload).digest("hex");

          records.push({
            adviceKey,
            fileId,
            fileName,
            paymentDocNo: meta.paymentDocNo,
            paymentDate: meta.valueDate,
            bankRefNo: meta.bankRefNo,
            vendorCode: meta.vendorCode,

            invoiceNumber: invNo,
            deliveryNumber: delNo,
            vehicleNumber: invRow.vehicleNumber || groupVehicle,
            vehicleSuffix: invRow.vehicleSuffix || groupVehicleSuffix,

            documentNumber: groupDocNo,
            paymentReferenceNumber: invRow.paymentReferenceNumber || groupPaymentRef,
            documentDate: invRow.documentDate,
            postingDate: invRow.postingDate,

            grossAmount: rowGross,
            deductionAmount: Math.max(0, rowDeduction),
            discountAmount: 0,
            netAmount: rowNet,
            currency: meta.currency,

            pageNumber: 1,
            rowNumber: globalRowIndex,

            raw: invRow.raw,
            headerMapping: {
              invoiceNumber: "Invoice Number",
              documentNumber: "FU Number",
              grossAmount: "Gross Amount",
              deductionAmount: "Deductions/Fees",
              netAmount: "Net Amount",
            },
          });
        }
      } else {
        for (const r of group.rows) {
          globalRowIndex += 1;
          const invNo = r.invoiceNumber || "";
          const delNo = r.deliveryNumber || "";
          const rowGross = r.grossAmount || groupGrossAmount || 0;
          const rowNet = r.netAmount || groupNetAmount || rowGross;
          const rowDeductions = groupDeductions || Math.max(0, rowGross - rowNet);

          const docScope = meta.paymentDocNo ? `doc_${meta.paymentDocNo}` : fileId;
          const adviceKeyPayload = `${docScope}:${sheetName}:${globalRowIndex}:${invNo}:${groupDocNo}:${rowGross}:${rowNet}`;
          const adviceKey = crypto.createHash("sha256").update(adviceKeyPayload).digest("hex");

          records.push({
            adviceKey,
            fileId,
            fileName,
            paymentDocNo: meta.paymentDocNo,
            paymentDate: meta.valueDate,
            bankRefNo: meta.bankRefNo,
            vendorCode: meta.vendorCode,

            invoiceNumber: invNo,
            deliveryNumber: delNo,
            vehicleNumber: r.vehicleNumber || groupVehicle,
            vehicleSuffix: r.vehicleSuffix || groupVehicleSuffix,

            documentNumber: groupDocNo,
            paymentReferenceNumber: r.paymentReferenceNumber || groupPaymentRef,
            documentDate: r.documentDate,
            postingDate: r.postingDate,

            grossAmount: rowGross,
            deductionAmount: rowDeductions,
            discountAmount: 0,
            netAmount: rowNet,
            currency: meta.currency,

            pageNumber: 1,
            rowNumber: globalRowIndex,

            raw: r.raw,
            headerMapping: {
              invoiceNumber: "Invoice Number",
              documentNumber: "FU Number",
              grossAmount: "Gross Amount",
              deductionAmount: "Deductions/Fees",
              netAmount: "Net Amount",
            },
          });
        }
      }
    }
  }

  return { meta, records };
}


// Ingest Payment Advice File (PDF or XLSX)
export async function processPaymentAdviceFile(fileId, fileBuffer, fileName, mimeType) {
  const isPdf = mimeType.includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
  const isXlsx = mimeType.includes("spreadsheet") || mimeType.includes("excel") || fileName.toLowerCase().endsWith(".xlsx") || fileName.toLowerCase().endsWith(".xls");

  if (!isPdf && !isXlsx) {
    throw new Error("Unsupported file format. Please upload a PDF or XLSX Payment Advice file.");
  }

  const { meta, records } = isPdf
    ? await parsePdfPaymentAdvice(fileBuffer, fileId, fileName)
    : await parseXlsxPaymentAdvice(fileBuffer, fileId, fileName);

  return { meta, records };
}

// Instantly tally Payment Advice records against Google Drive Annexure database
export async function tallyPaymentAdviceRecords(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      totalAdviceItems: 0,
      totalMatched: 0,
      totalUnmatched: 0,
      totalAdvicePaidAmount: 0,
      totalAnnexureBillAmount: 0,
      totalVariance: 0,
      billSummary: [],
      items: [],
      unpaidAnnexureItems: [],
    };
  }

  let totalMatched = 0;
  let totalUnmatched = 0;
  let totalAdvicePaidAmount = 0;
  let totalAnnexureBillAmount = 0;

  const billMap = new Map();
  const items = [];

  for (const record of records) {
    const advicePaidAmt = record.netAmount || record.grossAmount || 0;
    totalAdvicePaidAmount += advicePaidAmt;

    const rawInvoice = record.invoiceNumber || "";
    const rawDelivery = record.deliveryNumber || "";
    const rawDocument = record.documentNumber || "";
    const rawLr = record.lrNumber || "";
    const rawBill = record.billNumber || "";

    const strippedInv = stripLeadingZeros(rawInvoice);
    const strippedDel = stripLeadingZeros(rawDelivery);
    const strippedDoc = stripLeadingZeros(rawDocument);
    const strippedLr = stripLeadingZeros(rawLr);
    const strippedBill = stripLeadingZeros(rawBill);

    let matchQuery = [];

    const addCoreBillMatch = (val) => {
      if (!val) return;
      matchQuery.push({ invoiceNumber: val });
      matchQuery.push({ deliveryNumber: val });
      matchQuery.push({ billNumber: val });
      matchQuery.push({ lrNumber: val });

      const normInv = normalizeBillNo(val);
      if (normInv && normInv !== val) {
        matchQuery.push({ billNumber: normInv });
      }

      const baseCode = getBillBaseCode(val);
      if (baseCode && baseCode.length >= 3) {
        const escapedBase = baseCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        matchQuery.push({ billNumber: new RegExp(`^${escapedBase}`, "i") });
      }

      // Prefix-free bill matching (e.g. LOG/197/26-27 or NPMT/197/26-27 -> core "197/26-27")
      const m = val.match(/^[A-Za-z]+[\/\-_](.+)$/);
      if (m) {
        const coreBill = m[1];
        const escapedCore = coreBill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        matchQuery.push({ billNumber: new RegExp(escapedCore + "$", "i") });
        matchQuery.push({ invoiceNumber: new RegExp(escapedCore + "$", "i") });
        matchQuery.push({ billNumber: new RegExp("[A-Za-z0-9_\\-/]*" + escapedCore, "i") });
      }
    };

    addCoreBillMatch(rawInvoice);
    addCoreBillMatch(rawBill);

    if (rawDelivery) {
      matchQuery.push({ deliveryNumber: rawDelivery });
      matchQuery.push({ invoiceNumber: rawDelivery });
      matchQuery.push({ billNumber: rawDelivery });
      matchQuery.push({ lrNumber: rawDelivery });
    }

    if (rawDocument) {
      matchQuery.push({ invoiceNumber: rawDocument });
      matchQuery.push({ deliveryNumber: rawDocument });
      matchQuery.push({ billNumber: rawDocument });
      matchQuery.push({ lrNumber: rawDocument });
      matchQuery.push({ documentNumber: rawDocument });
      matchQuery.push({ "raw.documentNumber": rawDocument });
      matchQuery.push({ "raw.FI Document No Details": rawDocument });
      matchQuery.push({ "raw.Document Number": rawDocument });
    }

    if (rawLr) {
      matchQuery.push({ lrNumber: rawLr });
      matchQuery.push({ deliveryNumber: rawLr });
      matchQuery.push({ invoiceNumber: rawLr });
    }

    if (strippedInv && strippedInv !== rawInvoice) addCoreBillMatch(strippedInv);
    if (strippedBill && strippedBill !== rawBill) addCoreBillMatch(strippedBill);
    if (strippedDel && strippedDel !== rawDelivery) {
      matchQuery.push({ deliveryNumber: strippedDel });
      matchQuery.push({ invoiceNumber: strippedDel });
      matchQuery.push({ billNumber: strippedDel });
    }

    if (strippedDoc && strippedDoc !== rawDocument) {
      matchQuery.push({ invoiceNumber: strippedDoc });
      matchQuery.push({ deliveryNumber: strippedDoc });
      matchQuery.push({ billNumber: strippedDoc });
      matchQuery.push({ documentNumber: strippedDoc });
    }

    if (strippedLr && strippedLr !== rawLr) {
      matchQuery.push({ lrNumber: strippedLr });
      matchQuery.push({ deliveryNumber: strippedLr });
      matchQuery.push({ invoiceNumber: strippedLr });
    }

    let annexureRecord = null;
    if (matchQuery.length > 0) {
      annexureRecord = await AnnexureRecord.findOne({ $or: matchQuery }).lean();
    }

    const isMatched = !!annexureRecord;
    let status = "NOT_FOUND";
    let billNumber = "NOT_FOUND";
    let annexureBillAmt = 0;
    let freightBaseAmt = 0;
    let tdsAmount = 0;
    let expectedPayable = 0;
    let variance = 0;
    const isDeduction = advicePaidAmt < 0;

    if (isMatched) {
      totalMatched += 1;
      billNumber = annexureRecord.billNumber || "UNKNOWN_BILL";
      annexureBillAmt = annexureRecord.totalAmount || annexureRecord.freightBaseAmount || 0;
      freightBaseAmt = annexureRecord.freightBaseAmount || 0;

      // Calculate 2% TDS on Freight Base Amount
      tdsAmount = Math.round((freightBaseAmt * 0.02) * 100) / 100;
      expectedPayable = Math.round((annexureBillAmt - tdsAmount) * 100) / 100;

      totalAnnexureBillAmount += annexureBillAmt;
      variance = Math.round((expectedPayable - advicePaidAmt) * 100) / 100;

      if (isDeduction) {
        status = "DEBIT_NOTE_DEDUCTION";
      } else if (Math.abs(annexureBillAmt - advicePaidAmt) <= 2) {
        status = "MATCHED";
      } else if (Math.abs(expectedPayable - advicePaidAmt) <= 5) {
        status = "MATCHED_TDS";
      } else if (variance > 5) {
        status = "MATCHED_SHORT_PAID";
      } else {
        status = "MATCHED_EXCESS_PAID";
      }

      if (!billMap.has(billNumber)) {
        billMap.set(billNumber, {
          billNumber,
          deliveryCount: 0,
          advicePaidAmt: 0,
          annexureBillAmt: 0,
          freightBaseAmt: 0,
          tdsAmount: 0,
          expectedPayable: 0,
          variance: 0,
          status: "MATCHED",
          matchedAnnexureIds: new Set(),
        });
      }
      const bStat = billMap.get(billNumber);
      bStat.deliveryCount += 1;
      bStat.advicePaidAmt += advicePaidAmt;
      bStat.annexureBillAmt += annexureBillAmt;
      bStat.freightBaseAmt += freightBaseAmt;
      bStat.tdsAmount += tdsAmount;
      bStat.expectedPayable += expectedPayable;
      bStat.variance += variance;
      if (annexureRecord._id) {
        bStat.matchedAnnexureIds.add(String(annexureRecord._id));
      }
    } else {
      totalUnmatched += 1;
      if (isDeduction) {
        status = "DEBIT_NOTE_DEDUCTION";
      }
    }

    items.push({
      ...record,
      status,
      billNumber,
      annexureBillAmount: annexureBillAmt,
      freightBaseAmount: freightBaseAmt,
      tdsAmount,
      expectedPayable,
      variance,
      isDeduction,
      advicePaidAmount: advicePaidAmt,
      annexureRecord: annexureRecord || undefined,
      adviceRecord: record,
    });
  }

  // Find all unpaid Annexure line items for matched bills
  const allUnpaidItems = [];
  const billSummary = [];

  for (const [bNo, bStat] of billMap.entries()) {
    if (!bNo || bNo === "NOT_FOUND" || bNo === "UNKNOWN_BILL") continue;

    const allBillAnnexures = await AnnexureRecord.find({ billNumber: bNo }).lean();
    const matchedIds = bStat.matchedAnnexureIds || new Set();

    const unpaidForThisBill = [];
    let unpaidBillAmount = 0;

    for (const ann of allBillAnnexures) {
      if (!matchedIds.has(String(ann._id))) {
        const itemAmt = ann.totalAmount || ann.freightBaseAmount || 0;
        unpaidBillAmount += itemAmt;

        const unpaidItem = {
          billNumber: bNo,
          invoiceNumber: ann.invoiceNumber || "",
          deliveryNumber: ann.deliveryNumber || "",
          lrNumber: ann.lrNumber || "",
          lrDate: ann.lrDate,
          vehicleNumber: ann.vehicleNumber || "",
          materialType: ann.materialType || "",
          consignorName: ann.consignorName || "",
          consigneeName: ann.consigneeName || "",
          destination: ann.destination || "",
          freightBaseAmount: ann.freightBaseAmount || 0,
          totalAmount: itemAmt,
          status: "UNPAID_SHORT_PAID",
          annexureRecord: ann,
        };

        unpaidForThisBill.push(unpaidItem);
        allUnpaidItems.push(unpaidItem);
      }
    }

    billSummary.push({
      billNumber: bNo,
      totalBillItems: allBillAnnexures.length,
      paidAdviceItemsCount: bStat.deliveryCount,
      unpaidAnnexureItemsCount: unpaidForThisBill.length,

      totalBillAmount: allBillAnnexures.reduce((sum, a) => sum + (a.totalAmount || a.freightBaseAmount || 0), 0),
      advicePaidAmt: bStat.advicePaidAmt,
      unpaidAnnexureAmount: Math.round(unpaidBillAmount * 100) / 100,

      freightBaseAmt: bStat.freightBaseAmt,
      tdsAmount: bStat.tdsAmount,
      expectedPayable: bStat.expectedPayable,
      variance: bStat.variance,

      status: unpaidForThisBill.length > 0 ? "PARTIALLY_PAID" : Math.abs(bStat.variance) < 1 ? "MATCHED" : bStat.variance > 0 ? "MATCHED_SHORT_PAID" : "MATCHED_EXCESS_PAID",
      unpaidItems: unpaidForThisBill,
    });
  }

  const totalVariance = totalAnnexureBillAmount - totalAdvicePaidAmount;

  return {
    totalAdviceItems: records.length,
    totalMatched,
    totalUnmatched,
    totalAdvicePaidAmount,
    totalAnnexureBillAmount,
    totalVariance,
    billSummary,
    items,
    unpaidAnnexureItems: allUnpaidItems,
  };
}
