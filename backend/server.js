import createApp from "./app.js";
import { PORT, NODE_ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { startSheetSyncScheduler } from "./services/sheetSyncScheduler.js";

async function start() {
  const app = createApp();

  await connectDB();
  // eslint-disable-next-line no-console
  console.log(`[server] MongoDB connected (${NODE_ENV})`);

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

