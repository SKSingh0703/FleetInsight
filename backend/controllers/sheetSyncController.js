import { SheetIntegration } from "../models/sheetIntegrationModel.js";
import { SheetTabSyncState } from "../models/sheetTabSyncStateModel.js";
import { SheetSyncRun } from "../models/sheetSyncRunModel.js";
import { withMongoLock } from "../services/distributedLockService.js";
import { runSheetSyncOnce } from "../services/sheetSyncService.js";
import {
  listSpreadsheetTabs,
  suggestCurrentAndPreviousTabs,
} from "../services/sheetTabDiscoveryService.js";

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function getSheetSyncStatus(req, res) {
  const integration = await SheetIntegration.findOne({}).lean();
  const states = await SheetTabSyncState.find({}).sort({ tabName: 1 }).lean();
  const spreadsheetId = typeof integration?.spreadsheetId === "string" ? integration.spreadsheetId : "";
  const runs = spreadsheetId
    ? await SheetSyncRun.find({ spreadsheetId }).sort({ startedAt: -1 }).limit(20).lean()
    : [];
  return res.json({ integration, states, runs });
}

export async function upsertSheetIntegration(req, res) {
  const body = req.body || {};

  const spreadsheetId = typeof body.spreadsheetId === "string" ? body.spreadsheetId.trim() : "";
  if (!spreadsheetId) {
    return res.status(400).json({ message: "Missing spreadsheetId" });
  }

  const enabled = Boolean(body.enabled);
  const autoDiscoverTabs = body.autoDiscoverTabs !== undefined ? Boolean(body.autoDiscoverTabs) : true;
  const syncIntervalSeconds = Math.max(30, toInt(body.syncIntervalSeconds, 120));
  const defaultRange = typeof body.defaultRange === "string" && body.defaultRange.trim() ? body.defaultRange.trim() : "A:AZ";
  const defaultHeaderRow = Math.max(1, toInt(body.defaultHeaderRow, 1));

  const tabs = Array.isArray(body.tabs)
    ? body.tabs
        .map((t) => ({
          tabName: typeof t?.tabName === "string" ? t.tabName.trim() : "",
          range: typeof t?.range === "string" && t.range.trim() ? t.range.trim() : defaultRange,
          headerRow: Math.max(1, toInt(t?.headerRow, defaultHeaderRow)),
        }))
        .filter((t) => t.tabName)
    : [];

  if (!autoDiscoverTabs && tabs.length === 0) {
    return res.status(400).json({ message: "At least one tab is required when auto-discovery is off" });
  }

  const integration = await SheetIntegration.findOneAndUpdate(
    { spreadsheetId },
    {
      $set: {
        enabled,
        spreadsheetId,
        autoDiscoverTabs,
        defaultRange,
        defaultHeaderRow,
        tabs,
        syncIntervalSeconds,
        createdByUserId: String(req.user?.id || ""),
      },
    },
    { upsert: true, new: true }
  ).lean();

  return res.json({ integration });
}

export async function getSheetSyncSuggestions(req, res) {
  const spreadsheetId = typeof req.query?.spreadsheetId === "string" ? req.query.spreadsheetId.trim() : "";
  if (!spreadsheetId) {
    return res.status(400).json({ message: "Missing spreadsheetId" });
  }

  const tabs = await listSpreadsheetTabs(spreadsheetId);
  const suggested = suggestCurrentAndPreviousTabs(tabs, new Date());

  return res.json({ tabs, suggested });
}

export async function listSheetSyncRuns(req, res) {
  const integration = await SheetIntegration.findOne({}).lean();
  const spreadsheetId = typeof integration?.spreadsheetId === "string" ? integration.spreadsheetId : "";
  if (!spreadsheetId) {
    return res.json({ runs: [] });
  }
  const runs = await SheetSyncRun.find({ spreadsheetId }).sort({ startedAt: -1 }).limit(50).lean();
  return res.json({ runs });
}

export async function runSheetSyncNow(req, res) {
  const out = await withMongoLock(
    { key: "sheetSync", ttlMs: 5 * 60 * 1000, autoRenewIntervalMs: 60 * 1000 },
    async () => {
      return runSheetSyncOnce();
    }
  );

  if (!out.ran) {
    return res.status(409).json({ message: "Sync already running" });
  }

  return res.json({ result: out.result });
}
