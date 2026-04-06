import createApp from "./app.js";
import { PORT, NODE_ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { startSheetSyncScheduler } from "./services/sheetSyncScheduler.js";
import { markStaleSheetSyncRuns } from "./services/sheetSyncService.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "uploads");

function isTransientNetworkError(err) {
  const code = err && typeof err === "object" && "code" in err ? err.code : undefined;
  return code === "ECONNRESET" || code === "ECONNABORTED" || code === "ETIMEDOUT";
}

process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error("[process] Unhandled rejection:", reason);
  // Keep process alive for transient network blips (Mongo/Google).
  // Most of our background jobs already retry/backoff; this is a last-resort safeguard.
  if (isTransientNetworkError(reason)) return;
});

process.on("uncaughtException", (err) => {
  // eslint-disable-next-line no-console
  console.error("[process] Uncaught exception:", err);
  // For truly uncaught exceptions, the process may be in an unknown state.
  // Still avoid hard crash loops; nodemon can restart if needed.
});

async function ensureUploadDirAndCleanup() {
  try {
    await fs.mkdir(uploadDir, { recursive: true });
  } catch {
    return;
  }

  try {
    const entries = await fs.readdir(uploadDir);
    await Promise.all(
      entries.map(async (name) => {
        const p = path.join(uploadDir, name);
        try {
          const st = await fs.stat(p);
          if (!st.isFile()) return;
          await fs.unlink(p);
        } catch {
          // ignore
        }
      })
    );
  } catch {
    // ignore
  }
}

async function start() {
  const app = createApp();

  await ensureUploadDirAndCleanup();

  await connectDB();
  // eslint-disable-next-line no-console
  console.log(`[server] MongoDB connected (${NODE_ENV})`);

  try {
    await markStaleSheetSyncRuns();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[sheetSync] Failed to mark stale runs:", err);
  }

  try {
    await startSheetSyncScheduler();
    // eslint-disable-next-line no-console
    console.log("[sheetSync] Scheduler started");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[sheetSync] Failed to start scheduler:", err);
  }

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] Listening on port ${PORT}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[server] Failed to start:", err);
  process.exit(1);
});

