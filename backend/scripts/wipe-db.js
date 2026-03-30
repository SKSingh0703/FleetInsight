import mongoose from "mongoose";
import { MONGO_URI, NODE_ENV } from "../config/env.js";

async function main() {
  const confirm = String(process.env.CONFIRM || "").trim().toUpperCase();
  const allowNonDev = String(process.env.ALLOW_NON_DEV || "").trim().toLowerCase() === "true";

  if (confirm !== "YES") {
    // eslint-disable-next-line no-console
    console.error("[wipe-db] Refusing to run. Set CONFIRM=YES to proceed.");
    process.exit(1);
  }

  if (NODE_ENV !== "development" && !allowNonDev) {
    // eslint-disable-next-line no-console
    console.error(
      `[wipe-db] Refusing to run in NODE_ENV=${NODE_ENV}. Set ALLOW_NON_DEV=true if you really want to wipe this DB.`,
    );
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);

  const dbName = mongoose.connection?.db?.databaseName;
  // eslint-disable-next-line no-console
  console.log(`[wipe-db] Connected. Dropping database: ${dbName || "(unknown)"}`);

  await mongoose.connection.dropDatabase();

  // eslint-disable-next-line no-console
  console.log("[wipe-db] Database dropped successfully.");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error("[wipe-db] Failed:", err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
