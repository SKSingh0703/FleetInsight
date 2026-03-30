import { withMongoLock } from "./distributedLockService.js";
import { runSheetSyncOnce } from "./sheetSyncService.js";
import { SheetIntegration } from "../models/sheetIntegrationModel.js";

let timer = null;
let monitorTimer = null;
let currentIntervalSeconds = 0;

async function intervalSeconds() {
  const integration = await SheetIntegration.findOne({}).lean();
  const s = Number(integration?.syncIntervalSeconds ?? 120);
  if (!Number.isFinite(s) || s < 30) return 30;
  return s;
}

export async function startSheetSyncScheduler() {
  if (timer) return;

  const tick = async () => {
    try {
      await withMongoLock({ key: "sheetSync", ttlMs: 5 * 60 * 1000 }, async () => {
        await runSheetSyncOnce();
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[sheetSync] tick failed:", err);
    }
  };

  await tick();

  const schedule = async () => {
    const seconds = await intervalSeconds();
    currentIntervalSeconds = seconds;
    timer = setInterval(() => void tick(), seconds * 1000);
  };

  await schedule();

  // Adjust schedule if admin changes interval in DB.
  monitorTimer = setInterval(async () => {
    try {
      const seconds = await intervalSeconds();
      if (seconds !== currentIntervalSeconds) {
        if (timer) clearInterval(timer);
        timer = null;
        await schedule();
      }
    } catch {
      // ignore
    }
  }, 15000);
}

export function stopSheetSyncScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
}
