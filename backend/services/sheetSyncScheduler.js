import { withMongoLock } from "./distributedLockService.js";
import { runSheetSyncOnce } from "./sheetSyncService.js";
import { SheetIntegration } from "../models/sheetIntegrationModel.js";

let timer = null;
let monitorTimer = null;
let currentIntervalSeconds = 0;
let inTick = false;
let failureCount = 0;

async function intervalSeconds() {
  const integration = await SheetIntegration.findOne({}).lean();
  const s = Number(integration?.syncIntervalSeconds ?? 120);
  if (!Number.isFinite(s) || s < 30) return 30;
  return s;
}

export async function startSheetSyncScheduler() {
  if (timer) return;

  const backoffMs = () => {
    if (failureCount <= 0) return 0;
    const base = 30_000;
    const max = 10 * 60_000;
    const exp = Math.min(max, base * 2 ** (failureCount - 1));
    const jitter = Math.floor(Math.random() * Math.min(1000, exp));
    return exp + jitter;
  };

  const scheduleNext = (delayMs) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void tickLoop(), Math.max(0, Number(delayMs) || 0));
  };

  const tickLoop = async () => {
    if (inTick) return;
    inTick = true;
    try {
      await withMongoLock(
        { key: "sheetSync", ttlMs: 5 * 60 * 1000, autoRenewIntervalMs: 60 * 1000 },
        async () => {
          await runSheetSyncOnce();
        }
      );
      failureCount = 0;
    } catch (err) {
      failureCount += 1;
      // eslint-disable-next-line no-console
      console.error("[sheetSync] tick failed:", err);
    } finally {
      inTick = false;
      const nextSeconds = await intervalSeconds();
      currentIntervalSeconds = nextSeconds;

      const delay = failureCount > 0 ? backoffMs() : nextSeconds * 1000;
      scheduleNext(delay);
    }
  };

  // Run once immediately, then schedule subsequent runs.
  await tickLoop();

  // Adjust schedule if admin changes interval in DB.
  monitorTimer = setInterval(async () => {
    try {
      const seconds = await intervalSeconds();
      if (seconds !== currentIntervalSeconds) {
        currentIntervalSeconds = seconds;
        // If we're healthy (no backoff), reschedule to apply the new interval promptly.
        if (!inTick && failureCount === 0) {
          scheduleNext(seconds * 1000);
        }
      }
    } catch {
      // ignore
    }
  }, 15000);
}

export function stopSheetSyncScheduler() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
  inTick = false;
  failureCount = 0;
}
