import { DriveCrawlState } from "../models/driveCrawlStateModel.js";
import { DriveFolder } from "../models/driveFolderModel.js";
import { DriveFile } from "../models/driveFileModel.js";
import { AnnexureRecord } from "../models/annexureRecordModel.js";
import { DriveRootConfig } from "../models/driveRootConfigModel.js";
import { runDriveSyncOnce } from "../services/driveSyncScheduler.js";
import { getActiveDriveRootConfigs, parseDriveFolderIdInput } from "../services/driveScannerService.js";

export async function getDriveSyncStatus(req, res) {
  const roots = await getActiveDriveRootConfigs();
  const crawlStates = await DriveCrawlState.find({}).lean();

  const totalFolders = await DriveFolder.countDocuments({});
  const totalFiles = await DriveFile.countDocuments({});
  const totalBillFolders = await DriveFolder.countDocuments({ isBillFolder: true });
  const annexureCandidates = await DriveFile.countDocuments({ isAnnexureCandidate: true });
  const annexuresProcessed = await DriveFile.countDocuments({
    isAnnexureCandidate: true,
    extractionStatus: "SUCCESS",
  });
  const totalRowsExtracted = await AnnexureRecord.countDocuments({});

  const recentFiles = await DriveFile.find({ isAnnexureCandidate: true })
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean();

  return res.json({
    roots,
    crawlState: crawlStates[0] || null,
    crawlStates,
    stats: {
      totalFolders,
      totalFiles,
      totalBillFolders,
      annexureCandidates,
      annexuresProcessed,
      totalRowsExtracted,
    },
    recentFiles,
  });
}

export async function addDriveSyncRoot(req, res) {
  const { folderUrl, name, financialYear } = req.body;
  if (!folderUrl) {
    return res.status(400).json({ message: "Google Drive Folder URL or Folder ID is required." });
  }

  const folderId = parseDriveFolderIdInput(folderUrl);
  if (!folderId) {
    return res.status(400).json({ message: "Invalid Google Drive Folder URL or Folder ID." });
  }

  const folderName = name?.trim() || `Drive Root (${folderId.slice(0, 8)})`;
  const fy = financialYear?.trim() || "";

  const updated = await DriveRootConfig.findOneAndUpdate(
    { folderId },
    {
      $set: {
        name: folderName,
        financialYear: fy,
        isActive: true,
        addedBy: req.user?.email || "admin",
      },
    },
    { upsert: true, new: true }
  );

  return res.json({
    message: `Root Drive Folder '${folderName}' added successfully.`,
    config: updated,
  });
}

export async function deleteDriveSyncRoot(req, res) {
  const { folderId } = req.params;
  if (!folderId) {
    return res.status(400).json({ message: "Folder ID is required." });
  }

  await DriveRootConfig.updateOne({ folderId }, { $set: { isActive: false } });
  return res.json({ message: "Root Drive Folder deactivated successfully." });
}

export async function triggerDriveSyncNow(req, res) {
  try {
    const result = await runDriveSyncOnce();
    return res.json({ message: "Drive sync completed across all connected Drive folders", result });
  } catch (err) {
    const message = typeof err?.message === "string" ? err.message : "Drive sync failed";
    return res.status(500).json({ message });
  }
}

export async function listAnnexureRecords(req, res) {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.billNumber) {
    filter.billNumber = { $regex: String(req.query.billNumber).trim(), $options: "i" };
  }
  if (req.query.vehicleNumber) {
    filter.vehicleNumber = { $regex: String(req.query.vehicleNumber).trim(), $options: "i" };
  }
  if (req.query.invoiceNumber) {
    filter.invoiceNumber = { $regex: String(req.query.invoiceNumber).trim(), $options: "i" };
  }
  if (req.query.search) {
    const q = String(req.query.search).trim();
    filter.$or = [
      { billNumber: { $regex: q, $options: "i" } },
      { vehicleNumber: { $regex: q, $options: "i" } },
      { invoiceNumber: { $regex: q, $options: "i" } },
      { deliveryNumber: { $regex: q, $options: "i" } },
      { fileName: { $regex: q, $options: "i" } },
      { folderName: { $regex: q, $options: "i" } },
    ];
  }

  const total = await AnnexureRecord.countDocuments(filter);
  const records = await AnnexureRecord.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return res.json({
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    records,
  });
}
