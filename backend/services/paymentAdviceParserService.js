import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import xlsx from "xlsx";
import crypto from "crypto";
import { AnnexureRecord } from "../models/annexureRecordModel.js";

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

  let globalRowIndex = 0;

  for (const sheetName of workbook.SheetNames || []) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rows = xlsx.utils.sheet_to_json(worksheet, { defval: "", raw: false });
    if (rows.length === 0) continue;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || typeof row !== "object") continue;

      const keys = Object.keys(row);
      const getColVal = (aliases) => {
        for (const k of keys) {
          const nk = String(k).trim().toLowerCase().replace(/\s+/g, " ");
          for (const alias of aliases) {
            if (nk.includes(alias.toLowerCase())) {
              return row[k];
            }
          }
        }
        return undefined;
      };

      const invoiceNumber = cleanString(getColVal(["vendor invoice number", "invoice number", "invoice no", "inv no", "invoice", "inv", "bill no", "bill number", "delivery no", "delivery number"]));
      const deliveryNumber = cleanString(getColVal(["delivery number", "delivery no", "del no"]));
      const rawVehicle = cleanString(getColVal(["vehicle number", "vehicle no", "truck no"]));
      const { vehicleNumber, vehicleSuffix } = normalizeVehicle(rawVehicle);

      const documentNumber = cleanString(getColVal(["fi document no", "document number", "doc no", "document no", "rfu number", "rfu no"]));
      const paymentRef = cleanString(getColVal(["payment reference number", "payment ref", "ref no"]));

      const grossAmount = parseAmount(getColVal(["invoice amount", "gross amount", "gross amt", "fu amount", "bill amount", "total invoice value", "total amount"]));
      const deductionAmount = parseAmount(getColVal(["adjustments/ tds", "adjustments", "deductions", "tds"]));
      const discountAmount = parseAmount(getColVal(["discount amount", "discount"]));
      const netAmount = parseAmount(getColVal(["net pay in", "net pay", "net paid", "net amount", "payment amount", "net amt", "amount paid", "total paid"]));

      const documentDate = parseDate(getColVal(["invoice date", "document date", "inv date", "date"]));
      const postingDate = parseDate(getColVal(["posting date", "value date"]));

      if (!invoiceNumber && !documentNumber && !deliveryNumber && grossAmount === 0 && netAmount === 0) {
        continue;
      }

      globalRowIndex += 1;
      const docScope = meta.paymentDocNo ? `doc_${meta.paymentDocNo}` : fileId;
      const adviceKeyPayload = `${docScope}:${sheetName}:${globalRowIndex}:${invoiceNumber}:${documentNumber}:${grossAmount}:${netAmount}`;
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
        vehicleNumber,
        vehicleSuffix,

        documentNumber,
        paymentReferenceNumber: paymentRef,
        documentDate,
        postingDate,

        grossAmount,
        deductionAmount,
        discountAmount,
        netAmount: netAmount || (grossAmount ? grossAmount - deductionAmount - discountAmount : 0),
        currency: meta.currency,

        pageNumber: 1,
        rowNumber: globalRowIndex,

        raw: row,
        headerMapping: {
          invoiceNumber: "Invoice Number",
          documentNumber: "FI Document No",
          grossAmount: "Gross Amount",
          deductionAmount: "Adjustments/TDS",
          netAmount: "Net Amount",
        },
      });
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

    const strippedInv = stripLeadingZeros(rawInvoice);
    const strippedDel = stripLeadingZeros(rawDelivery);

    let matchQuery = [];
    if (rawInvoice) {
      matchQuery.push({ invoiceNumber: rawInvoice });
      matchQuery.push({ deliveryNumber: rawInvoice });
      matchQuery.push({ billNumber: rawInvoice });

      const normInv = normalizeBillNo(rawInvoice);
      if (normInv && normInv !== rawInvoice) {
        matchQuery.push({ billNumber: normInv });
      }

      const baseCode = getBillBaseCode(rawInvoice);
      if (baseCode && baseCode.length >= 3) {
        const escapedBase = baseCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        matchQuery.push({ billNumber: new RegExp(`^${escapedBase}`, "i") });
      }
    }

    if (rawDelivery) {
      matchQuery.push({ deliveryNumber: rawDelivery });
      matchQuery.push({ invoiceNumber: rawDelivery });
      matchQuery.push({ billNumber: rawDelivery });
    }

    if (strippedInv && strippedInv !== rawInvoice) {
      matchQuery.push({ invoiceNumber: strippedInv });
      matchQuery.push({ deliveryNumber: strippedInv });
      matchQuery.push({ billNumber: strippedInv });
    }

    if (strippedDel && strippedDel !== rawDelivery) {
      matchQuery.push({ deliveryNumber: strippedDel });
      matchQuery.push({ invoiceNumber: strippedDel });
      matchQuery.push({ billNumber: strippedDel });
    }

    let annexureRecord = null;
    if (matchQuery.length > 0) {
      annexureRecord = await AnnexureRecord.findOne({ $or: matchQuery }).lean();
    }

    const isMatched = !!annexureRecord;
    let status = "NOT_FOUND";
    let billNumber = "NOT_FOUND";
    let annexureBillAmt = 0;
    let variance = 0;

    if (isMatched) {
      totalMatched += 1;
      billNumber = annexureRecord.billNumber || "UNKNOWN_BILL";
      annexureBillAmt = annexureRecord.totalAmount || annexureRecord.freightBaseAmount || 0;
      totalAnnexureBillAmount += annexureBillAmt;
      variance = annexureBillAmt - advicePaidAmt;

      if (Math.abs(variance) < 1) {
        status = "MATCHED";
      } else if (variance > 0) {
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
          variance: 0,
          status: "MATCHED",
        });
      }
      const bStat = billMap.get(billNumber);
      bStat.deliveryCount += 1;
      bStat.advicePaidAmt += advicePaidAmt;
      bStat.annexureBillAmt += annexureBillAmt;
      bStat.variance += variance;
    } else {
      totalUnmatched += 1;
    }

    items.push({
      ...record,
      status,
      billNumber,
      annexureBillAmount: annexureBillAmt,
      variance,
      advicePaidAmount: advicePaidAmt,
      annexureRecord: annexureRecord || undefined,
      adviceRecord: record,
    });
  }

  const billSummary = Array.from(billMap.values()).map((b) => ({
    ...b,
    status: Math.abs(b.variance) < 1 ? "MATCHED" : b.variance > 0 ? "MATCHED_SHORT_PAID" : "MATCHED_EXCESS_PAID",
  }));

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
  };
}
