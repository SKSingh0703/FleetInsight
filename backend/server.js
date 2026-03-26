import createApp from "./app.js";
import { PORT, NODE_ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";

async function start() {
  const app = createApp();

  await connectDB();
  // eslint-disable-next-line no-console
  console.log(`[server] MongoDB connected (${NODE_ENV})`);

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

