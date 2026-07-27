import { listFolderContents } from "./googleDriveService.js";
import { DriveFolder } from "../models/driveFolderModel.js";
import { DriveFile } from "../models/driveFileModel.js";
import { DriveCrawlState } from "../models/driveCrawlStateModel.js";
import { DriveRootConfig } from "../models/driveRootConfigModel.js";

const DEFAULT_ROOTS = [
  {
    folderId: "1P4jxfnN6Uo_bhpONtpDwVqaAla303oL7",
    name: "All Bill 2026-27",
    financialYear: "2026-27",
  },
  {
    folderId: "1blzU74ahtix8bTSl6MpCjCSCG03lIVaG",
    name: "All Bill 2025-26",
    financialYear: "2025-26",
  },
];

export function parseDriveFolderIdInput(input) {
  if (!input) return "";
  const s = String(input).trim();
  const match = s.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return s;
}

export async function getActiveDriveRootConfigs() {
  let roots = await DriveRootConfig.find({ isActive: true }).lean();
  if (roots.length === 0) {
    // Seed default root configs
    for (const def of DEFAULT_ROOTS) {
      await DriveRootConfig.updateOne(
        { folderId: def.folderId },
        { $setOnInsert: def },
        { upsert: true }
      );
    }
    roots = await DriveRootConfig.find({ isActive: true }).lean();
  }
  return roots;
}

export function extractBillNumberFromFolderName(folderName) {
  if (!folderName) return "";
  const match = String(folderName).match(/bill\s*no[-._\s]*(\d+[\w-]*)/i);
  if (match) {
    return `Bill No-${match[1]}`;
  }
  const alt = String(folderName).match(/\b(\d{1,3})\b/);
  if (alt && String(folderName).toLowerCase().includes("bill")) {
    return `Bill No-${alt[1]}`;
  }
  return folderName.split("(")[0].trim();
}

export function isAnnexureCandidateName(fileName, mimeType) {
  if (!fileName) return false;
  const name = String(fileName).trim().toLowerCase();

  // Reject non-excel extensions
  if (name.endsWith(".pdf") || name.endsWith(".txt") || name.endsWith(".docx") || name.endsWith(".doc") || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return false;
  }

  // Reject non-excel mimeTypes
  if (mimeType && (mimeType.includes("pdf") || mimeType.includes("text/plain") || mimeType.includes("image"))) {
    return false;
  }

  const isExcelExt = name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv");
  const isGSheet = mimeType === "application/vnd.google-apps.spreadsheet" || mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || mimeType === "application/vnd.ms-excel";

  if (!isExcelExt && !isGSheet) {
    return false;
  }

  // Reject intermediate draft upload files strictly (e.g. 1st & 2nd Upload.xlsx)
  if ((name.includes("1st") || name.includes("2nd") || name.includes("upload")) && !name.includes("annex")) {
    return false;
  }

  // Reject generic "untitled spreadsheet"
  if (name.includes("untitled spreadsheet")) {
    return false;
  }

  return true;
}

export async function scanDriveFolderTree(rootFolderIdInput, rootNameInput) {
  const rootFolderId = parseDriveFolderIdInput(rootFolderIdInput) || DEFAULT_ROOTS[0].folderId;
  const rootName = rootNameInput || "Drive Root";
  const startedAt = new Date();

  await DriveCrawlState.findOneAndUpdate(
    { rootFolderId },
    {
      $set: {
        lastCrawlStartedAt: startedAt,
        status: "RUNNING",
        lastError: "",
      },
    },
    { upsert: true, new: true }
  );

  let foldersCount = 0;
  let filesCount = 0;
  let billFoldersCount = 0;
  let annexuresFound = 0;

  try {
    // Root folder record
    await DriveFolder.findOneAndUpdate(
      { folderId: rootFolderId },
      {
        $set: {
          name: rootName,
          parentFolderId: "",
          path: `/${rootName}`,
          isBillFolder: false,
          lastScannedAt: startedAt,
        },
      },
      { upsert: true }
    );
    foldersCount += 1;

    // Queue for BFS traversal
    const queue = [
      {
        folderId: rootFolderId,
        path: `/${rootName}`,
        isBillFolder: false,
        billFolderId: "",
        billFolderName: "",
      },
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      const items = await listFolderContents(current.folderId);

      for (const item of items) {
        if (item.mimeType === "application/vnd.google-apps.folder") {
          const itemIsBillFolder = current.isBillFolder || /bill/i.test(item.name);
          const itemBillFolderId = itemIsBillFolder ? (current.billFolderId || item.id) : "";
          const itemBillFolderName = itemIsBillFolder ? (current.billFolderName || item.name) : "";

          const itemPath = `${current.path}/${item.name}`;

          await DriveFolder.findOneAndUpdate(
            { folderId: item.id },
            {
              $set: {
                name: item.name,
                parentFolderId: current.folderId,
                path: itemPath,
                isBillFolder: itemIsBillFolder,
                lastScannedAt: startedAt,
              },
            },
            { upsert: true }
          );

          foldersCount += 1;
          if (itemIsBillFolder && !current.isBillFolder) {
            billFoldersCount += 1;
          }

          queue.push({
            folderId: item.id,
            path: itemPath,
            isBillFolder: itemIsBillFolder,
            billFolderId: itemBillFolderId,
            billFolderName: itemBillFolderName,
          });
        } else {
          filesCount += 1;
          const candidate = isAnnexureCandidateName(item.name, item.mimeType);

          if (candidate) {
            annexuresFound += 1;
          }

          const existingFile = await DriveFile.findOne({ fileId: item.id }).lean();
          const driveModTime = item.modifiedTime ? new Date(item.modifiedTime) : undefined;

          let extractionStatus = "PENDING";
          if (existingFile) {
            const hasChanged = driveModTime && existingFile.fileModifiedTime && driveModTime.getTime() > existingFile.fileModifiedTime.getTime();
            if (!hasChanged && existingFile.extractionStatus === "SUCCESS") {
              extractionStatus = "SUCCESS";
            }
          }

          await DriveFile.findOneAndUpdate(
            { fileId: item.id },
            {
              $set: {
                name: item.name,
                parentFolderId: current.folderId,
                billFolderId: current.billFolderId || current.folderId,
                billFolderPath: current.path,
                billFolderName: current.billFolderName || current.path.split("/")[2] || "",
                mimeType: item.mimeType,
                size: Number(item.size || 0),
                md5Checksum: item.md5Checksum || "",
                driveModifiedTime: driveModTime,
                isAnnexureCandidate: candidate,
                extractionStatus,
                lastScannedAt: startedAt,
              },
            },
            { upsert: true }
          );
        }
      }
    }

    const finishedAt = new Date();
    await DriveCrawlState.findOneAndUpdate(
      { rootFolderId },
      {
        $set: {
          lastCrawlFinishedAt: finishedAt,
          status: "SUCCESS",
          stats: {
            foldersCount,
            filesCount,
            billFoldersCount,
            annexuresFound,
          },
        },
      }
    );

    return {
      success: true,
      rootFolderId,
      rootName,
      stats: { foldersCount, filesCount, billFoldersCount, annexuresFound },
    };
  } catch (err) {
    const errorMsg = typeof err?.message === "string" ? err.message : "Drive scan failed";
    await DriveCrawlState.findOneAndUpdate(
      { rootFolderId },
      {
        $set: {
          lastCrawlFinishedAt: new Date(),
          status: "FAILED",
          lastError: errorMsg,
        },
      }
    );
    throw err;
  }
}

export async function scanAllDriveFolderTrees() {
  const rootConfigs = await getActiveDriveRootConfigs();
  const results = [];
  for (const cfg of rootConfigs) {
    try {
      const res = await scanDriveFolderTree(cfg.folderId, cfg.name);
      results.push(res);
    } catch (err) {
      results.push({ rootFolderId: cfg.folderId, name: cfg.name, error: err.message });
    }
  }
  return results;
}
