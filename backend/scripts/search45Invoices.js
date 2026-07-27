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

  const numbers = [
    "0910959934", "910959934",
    "0910972417", "910972417",
    "0911003653", "911003653",
    "0911034067", "911034067",
    "0911052335", "911052335",
    "0911058203", "911058203",
    "0911061207", "911061207",
    "0911105497", "911105497"
  ];

  for (const num of numbers) {
    const rawNum = num.replace(/^0+/, "");
    const match = await AnnexureRecord.find({
      $or: [
        { deliveryNumber: { $regex: new RegExp(rawNum, "i") } },
        { invoiceNumber: { $regex: new RegExp(rawNum, "i") } },
        { lrNumber: { $regex: new RegExp(rawNum, "i") } },
      ]
    }).lean();

    console.log(`Search for '${num}' (stripped '${rawNum}'): matches = ${match.length}`);
    if (match.length > 0) {
      console.log(`  Matched record: delivery=${match[0].deliveryNumber}, invoice=${match[0].invoiceNumber}, bill=${match[0].billNumber}, file=${match[0].fileName}`);
    }
  }

  process.exit(0);
}

check();
