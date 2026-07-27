import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

async function testXref() {
  console.log("Testing pdf-parse fallback options...");
  try {
    // Test if pdfParse accepts options
    const dummyBuf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\nstartxref\n0\n%%EOF");
    await pdfParse(dummyBuf);
  } catch (e) {
    console.log("Error caught as expected:", e.message);
  }
}

testXref();
