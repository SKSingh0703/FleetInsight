import { withMongoLock } from "./distributedLockService.js";
import { scanAllDriveFolderTrees } from "./driveScannerService.js";
import { processAllPendingAnnexures } from "./annexureExtractorService.js";
import { DriveCrawlState } from "../models/driveCrawlStateModel.js";
import { DriveFile } from "../models/driveFileModel.js";
import { AnnexureRecord } from "../models/annexureRecordModel.js";

let timer = null;
let inTick = false;

export async function runDriveSyncOnce() {
  return withMongoLock(
    { key: "driveSync", ttlMs: 30 * 60 * 1000, autoRenewIntervalMs: 60 * 1000 },
    async () => {
      const scanResults = await scanAllDriveFolderTrees();
      const extractResult = await processAllPendingAnnexures();

      const totalRowsExtracted = await AnnexureRecord.countDocuments({});
      const totalAnnexuresProcessed = await DriveFile.countDocuments({
        isAnnexureCandidate: true,
        extractionStatus: "SUCCESS",
      });

      return {
        scanResults,
        extractResult,
        totalAnnexuresProcessed,
        totalRowsExtracted,
      };
    }
  );
}

export function startDriveSyncScheduler(intervalMinutes = 10) {
  if (timer) return;

  const ms = Math.max(3, intervalMinutes) * 60 * 1000;

  const tick = async () => {
    if (inTick) return;
    inTick = true;
    try {
      await runDriveSyncOnce();
    } catch (err) {
      console.error("[driveSync] tick failed:", err.message);
    } finally {
      inTick = false;
    }
  };

  // Run once after 5s delay on startup, then every intervalMinutes
  setTimeout(() => void tick(), 5000);
  timer = setInterval(() => void tick(), ms);
}

export function stopDriveSyncScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  inTick = false;
}
