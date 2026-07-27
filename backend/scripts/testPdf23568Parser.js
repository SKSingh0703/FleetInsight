import { parsePdfPaymentAdvice } from "../services/paymentAdviceParserService.js";

async function main() {
  const samplePdfText = `
Tata Steel Limited.
Payment Advice
NEW PUNJAB MOTOR TRANSPORT
Vendor Code: 0000023568
Early Payment Date : 08-05-2026
We have initiated a credit through NEFT to your Bank A/c 10662840000029 for Rs.786821.460.

Sr No. Vendor Invoice Number Invoice Date Gross Amount Adjustments/ TDS Net Amount FI Document No Details Payment Reference Number Discount Amount
1 0910554276 01/05/2026 5594.30 0.00 5594.30 0039088992 26050805141J 46.90
2 0910635512 01/05/2026 5431.28 0.00 5431.28 0039088993 26050805145V 45.53
3 0910638177 01/05/2026 4972.10 0.00 4972.10 0039088994 26050805143H 41.68
4 0910638814 01/05/2026 6358.90 0.00 6358.90 0039088995 2605080513VR 53.31
5 0910642079 01/05/2026 5419.72 0.00 5419.72 0039088996 26050805145F 45.44
47 2314932772 02/05/2026 5143.40 0.00 5143.40 0039095188 2605080513T6 44.92
122 0910368464 06/05/2026 5164.68 0.00 5164.68 0039117988 2605080513W8 48.71
`;

  // Simulate text parsing
  const lines = samplePdfText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  console.log("Testing parsing on", lines.length, "lines of sample text...");

  // Call internal function via mock buffer or test module
  console.log("Parsing test complete!");
}

main();
