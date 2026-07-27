import { connectDB } from "../config/db.js";
import { AnnexureRecord } from "../models/annexureRecordModel.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function check() {
  await connectDB();
  console.log("Connected to MongoDB");

  const testInvoices = ["0911117523", "911117523", "0911117537", "911117537", "0910959934", "910959934"];

  for (const inv of testInvoices) {
    const byInv = await AnnexureRecord.find({ invoiceNumber: inv }).lean();
    const byDel = await AnnexureRecord.find({ deliveryNumber: inv }).lean();
    console.log(`Searching '${inv}': by invoiceNumber found ${byInv.length}, by deliveryNumber found ${byDel.length}`);
    if (byInv.length > 0) console.log("Sample invoice match:", { invoiceNumber: byInv[0].invoiceNumber, billNumber: byInv[0].billNumber, deliveryNumber: byInv[0].deliveryNumber });
    if (byDel.length > 0) console.log("Sample delivery match:", { invoiceNumber: byDel[0].invoiceNumber, billNumber: byDel[0].billNumber, deliveryNumber: byDel[0].deliveryNumber });
  }

  // Also try regex search for 911117523
  const regexMatch = await AnnexureRecord.find({
    $or: [
      { invoiceNumber: { $regex: /911117523/i } },
      { deliveryNumber: { $regex: /911117523/i } },
      { raw: { $regex: /911117523/i } },
    ]
  }).limit(5).lean();

  console.log("Regex matches for 911117523:", regexMatch.length);

  process.exit(0);
}

check();
