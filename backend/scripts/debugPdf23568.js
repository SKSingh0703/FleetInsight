import { parsePdfPaymentAdvice } from "../services/paymentAdviceParserService.js";
import fs from "fs";
import path from "path";

async function main() {
  const artifactPdfPath = "C:/Users/sachi/.gemini/antigravity-ide/brain/4b3e922c-725c-4daf-b6d1-5a2546e1d8ce/media__1785011282109.pdf";
  
  if (!fs.existsSync(artifactPdfPath)) {
    console.error("PDF artifact not found at path:", artifactPdfPath);
    process.exit(1);
  }

  const buf = fs.readFileSync(artifactPdfPath);
  console.log(`Loaded PDF buffer (${buf.length} bytes). Parsing PDF...`);

  try {
    const records = await parsePdfPaymentAdvice(buf, "test-file-id", "PAYMENT_ADVICE_0000023568.pdf");
    console.log(`Extracted ${records.length} records from PDF!`);
    if (records.length > 0) {
      console.log("Sample Record 1:", records[0]);
      console.log("Sample Record 2:", records[1]);
    }
  } catch (err) {
    console.error("PDF Parsing Error:", err);
  }
}

main();
