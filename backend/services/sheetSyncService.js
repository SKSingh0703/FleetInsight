import crypto from "crypto";
import { SheetIntegration } from "../models/sheetIntegrationModel.js";
import { SheetTabSyncState } from "../models/sheetTabSyncStateModel.js";
import { SheetSyncRun } from "../models/sheetSyncRunModel.js";
import { fetchSheetValues } from "./googleSheetsService.js";
import { processRows } from "./processingService.js";
import { saveTrips } from "./tripStorageService.js";
import { clearDashboardCache } from "./dashboardCacheService.js";
import { COLUMN_ALIASES, normalizeHeaderKey } from "./mappingService.js";
import {
  listSpreadsheetTabs,
  suggestCurrentAndPreviousTabs,
} from "./sheetTabDiscoveryService.js";

function getMaxRunHistory() {
  const raw = process.env.SHEETS_SYNC_RUNS_MAX;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  return 200;
}

async function pruneOldRuns({ spreadsheetId }) {
  const keep = getMaxRunHistory();
  if (!spreadsheetId || keep <= 0) return;

  const old = await SheetSyncRun.find({ spreadsheetId })
    .sort({ startedAt: -1 })
    .skip(keep)
    .select({ _id: 1 })
    .lean();
  if (old.length === 0) return;

  await SheetSyncRun.deleteMany({ _id: { $in: old.map((d) => d._id) } });
}

function getStaleRunMinutes() {
  const raw = process.env.SHEETS_SYNC_RUN_STALE_MINUTES;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  return 30;
}

export async function markStaleSheetSyncRuns() {
  const minutes = getStaleRunMinutes();
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);

  await SheetSyncRun.updateMany(
    { status: "RUNNING", startedAt: { $lt: cutoff } },
    {
      $set: {
        status: "FAILED",
        finishedAt: new Date(),
        message: "Marked failed after server restart (stale RUNNING run)",
      },
    }
  );
}

function safeString(v) {
  if (v == null) return "";
  return String(v).trim();
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function buildRowHash(cells) {
  const normalized = (cells || []).map((c) => safeString(c)).join("|~|");
  return sha256(normalized);
}

function isRowEmpty(cells) {
  return (cells || []).every((c) => safeString(c) === "");
}

function normalizeKey(k) {
  return normalizeHeaderKey(k);
}

function isSnoKey(normalizedKey) {
  const aliases = Array.isArray(COLUMN_ALIASES?.sno) ? COLUMN_ALIASES.sno : [];
  const aliasSet = new Set(aliases.map((a) => normalizeKey(a)));
  return aliasSet.has(normalizedKey);
}

function isIncompleteRowOnlySno(rowObj) {
  const entries = Object.entries(rowObj || {});
  let hasNonEmpty = false;
  let nonSnoNonEmpty = false;

  for (const [k, v] of entries) {
    const nk = normalizeKey(k);
    const sv = safeString(v);
    if (!sv) continue;
    hasNonEmpty = true;
    if (!isSnoKey(nk)) nonSnoNonEmpty = true;
  }

  return hasNonEmpty && !nonSnoNonEmpty;
}

function toRawRows({ tabName, values, headerRow }) {
  const headerIndex = Math.max(1, Number(headerRow || 1));
  const header = values[headerIndex - 1] || [];
  const headers = header.map((h) => safeString(h));

  const out = [];
  for (let i = headerIndex; i < values.length; i += 1) {
    const rowNumber = i + 1;
    const cells = values[i] || [];

    const raw = {};
    for (let c = 0; c < headers.length; c += 1) {
      const hk = headers[c];
      if (!hk) continue;
      raw[hk] = cells[c] ?? "";
    }

    out.push({ sheetName: tabName, rowNumber, raw, cells });
  }

  return out;
}

export async function runSheetSyncOnce() {
  const integration = await SheetIntegration.findOne({}).lean();
  if (!integration || !integration.enabled) {
    return { ran: false, reason: "disabled" };
  }

  const spreadsheetId = safeString(integration.spreadsheetId);
  if (!spreadsheetId) {
    return { ran: false, reason: "not_configured" };
  }

  const startedAt = new Date();
  const run = await SheetSyncRun.create({
    spreadsheetId,
    startedAt,
    status: "RUNNING",
    results: [],
  });

  try {
    const defaultRange = safeString(integration.defaultRange) || "A:AZ";
    const defaultHeaderRow = Number(integration.defaultHeaderRow || 1);

    const configuredTabs = Array.isArray(integration.tabs) ? integration.tabs : [];

    const resolvedTabs = await (async () => {
      if (integration.autoDiscoverTabs) {
        const titles = await listSpreadsheetTabs(spreadsheetId);
        const suggested = suggestCurrentAndPreviousTabs(titles, new Date());
        const tabNames = [suggested.current, suggested.previous].filter(Boolean);
        return tabNames.map((tabName) => ({
          tabName,
          range: defaultRange,
          headerRow: defaultHeaderRow,
        }));
      }

      return configuredTabs
        .map((t) => ({
          tabName: safeString(t?.tabName),
          range: safeString(t?.range) || defaultRange,
          headerRow: Number(t?.headerRow || defaultHeaderRow),
        }))
        .filter((t) => t.tabName);
    })();

    if (resolvedTabs.length === 0) {
      await SheetSyncRun.updateOne(
        { _id: run._id },
        { $set: { status: "SKIPPED", finishedAt: new Date(), message: "No tabs resolved" } }
      );
      await pruneOldRuns({ spreadsheetId });
      return { ran: true, results: [] };
    }

    const results = [];

    for (const tab of resolvedTabs) {
      const tabName = safeString(tab?.tabName);
      if (!tabName) continue;

      const range = safeString(tab?.range) || defaultRange;
      const headerRow = Number(tab?.headerRow || defaultHeaderRow);

      const values = await fetchSheetValues({ spreadsheetId, tabName, range });
      const rows = toRawRows({ tabName, values, headerRow });

      const state = await SheetTabSyncState.findOneAndUpdate(
        { spreadsheetId, tabName },
        { $setOnInsert: { spreadsheetId, tabName, rowHashes: {} } },
        { new: true, upsert: true }
      );

      const rowHashes =
        state?.rowHashes && typeof state.rowHashes === "object" ? state.rowHashes : {};

      let processed = 0;
      let changed = 0;
      let skippedEmpty = 0;
      let skippedIncomplete = 0;

      const changedRawRows = [];

      for (const r of rows) {
        processed += 1;
        const hash = buildRowHash(r.cells);
        const key = String(r.rowNumber);

        if (rowHashes[key] === hash) continue;
        rowHashes[key] = hash;
        changed += 1;

        if (isRowEmpty(r.cells)) {
          skippedEmpty += 1;
          continue;
        }

        if (isIncompleteRowOnlySno(r.raw)) {
          skippedIncomplete += 1;
          continue;
        }

        changedRawRows.push({
          spreadsheetId,
          tabName,
          sheetName: r.sheetName,
          rowNumber: r.rowNumber,
          raw: r.raw,
        });
      }

      let upsertStats = { requested: 0, matched: 0, modified: 0, upserted: 0 };
      let rejected = 0;

      if (changedRawRows.length > 0) {
        const { trips, errors } = await processRows(changedRawRows);
        const errorList = Array.isArray(errors) ? errors : [];
        rejected = errorList.length;

        // Important: do NOT permanently mark rejected rows as "synced".
        // If we store the row hash here, future syncs won't retry the row unless the sheet changes.
        // By clearing the hash for rejected rows, we ensure they are retried on the next run.
        for (const e of errorList) {
          const rn = e && typeof e === "object" && "rowNumber" in e ? Number(e.rowNumber) : NaN;
          if (Number.isFinite(rn) && rn > 0) {
            delete rowHashes[String(Math.trunc(rn))];
          }
        }

        upsertStats = await saveTrips(trips);
      }

      if ((upsertStats?.modified || 0) > 0 || (upsertStats?.upserted || 0) > 0) {
        clearDashboardCache();
      }

      await SheetTabSyncState.updateOne(
        { spreadsheetId, tabName },
        {
          $set: {
            rowHashes,
            lastRunAt: new Date(),
            lastError: "",
            lastStats: {
              processed,
              changed,
              upsertRequested: upsertStats.requested,
              upsertMatched: upsertStats.matched,
              upsertModified: upsertStats.modified,
              upsertUpserted: upsertStats.upserted,
              skippedEmpty,
              skippedIncomplete,
              rejected,
            },
          },
        }
      );

      results.push({
        tabName,
        processed,
        changed,
        skippedEmpty,
        skippedIncomplete,
        rejected,
        upsert: upsertStats,
      });
    }

    await SheetSyncRun.updateOne(
      { _id: run._id },
      {
        $set: {
          status: "SUCCESS",
          results,
          finishedAt: new Date(),
          message: "",
        },
      }
    );

    await pruneOldRuns({ spreadsheetId });

    return { ran: true, results };
  } catch (err) {
    const message = typeof err?.message === "string" ? err.message : "Sheet sync failed";
    await SheetSyncRun.updateOne(
      { _id: run._id },
      { $set: { status: "FAILED", finishedAt: new Date(), message } }
    );
    await pruneOldRuns({ spreadsheetId });
    throw err;
  }
}
