import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

function repairPdfXref(buffer) {
  const str = buffer.toString("binary");
  const xrefPos = str.lastIndexOf("xref");
  if (xrefPos !== -1) {
    const startXrefPos = str.lastIndexOf("startxref");
    if (startXrefPos !== -1) {
      const eofPos = str.lastIndexOf("%%EOF");
      if (eofPos !== -1 && eofPos > startXrefPos) {
        // Rebuild trailer section with exact offset of 'xref'
        const header = str.substring(0, startXrefPos);
        const repairedStr = `${header}startxref\n${xrefPos}\n%%EOF\n`;
        return Buffer.from(repairedStr, "binary");
      }
    }
  }
  return buffer;
}

async function safePdfParse(buffer) {
  try {
    return await pdfParse(buffer);
  } catch (err) {
    console.log("Initial pdfParse error:", err.message);
    if (err && err.message && (err.message.includes("XRef") || err.message.includes("Invalid number") || err.message.includes("charCode 0"))) {
      console.log("Attempting XRef repair and null-byte sanitization...");
      let sanitized = repairPdfXref(buffer);
      // Replace null bytes (0x00) with spaces (0x20)
      const cleanBuf = Buffer.from(sanitized);
      for (let i = 0; i < cleanBuf.length; i++) {
        if (cleanBuf[i] === 0x00) cleanBuf[i] = 0x20;
      }
      return await pdfParse(cleanBuf);
    }
    throw err;
  }
}

async function main() {
  console.log("Safe PDF Parse with XRef Auto-Repair ready.");
}

main();
