import mongoose from "mongoose";

const annexureRecordSchema = new mongoose.Schema(
  {
    annexureKey: { type: String, required: true, unique: true, index: true, trim: true },

    // Source metadata
    fileId: { type: String, required: true, index: true, trim: true },
    fileName: { type: String, required: true, trim: true, index: true },
    folderId: { type: String, index: true, trim: true },
    folderName: { type: String, trim: true, index: true },
    billFolderPath: { type: String, trim: true },
    fileModifiedTime: { type: Date },

    sheetName: { type: String, default: "", trim: true },
    rowNumber: { type: Number, required: true },

    // Header mapping & raw storage
    headerMapping: { type: mongoose.Schema.Types.Mixed, default: {} },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Normalized common fields for reconciliation & queries
    billNumber: { type: String, trim: true, index: true },
    invoiceNumber: { type: String, trim: true, index: true },
    deliveryNumber: { type: String, trim: true, index: true },
    vehicleNumber: { type: String, trim: true, index: true },
    vehicleSuffix: { type: String, trim: true, index: true },

    lrNumber: { type: String, trim: true, index: true },
    lrDate: { type: Date, index: true },
    deliveryDate: { type: Date, index: true },

    materialType: { type: String, trim: true },
    consignorName: { type: String, trim: true, index: true },
    consigneeName: { type: String, trim: true, index: true },
    destination: { type: String, trim: true, index: true },

    netWeight: { type: Number, default: 0 },
    grossWeight: { type: Number, default: 0 },
    chargeWeight: { type: Number, default: 0 },

    ratePerUnit: { type: Number, default: 0 },
    freightBaseAmount: { type: Number, default: 0 },

    sgst: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },

    financialYear: { type: String, trim: true, index: true },
    processingStatus: { type: String, default: "SUCCESS", index: true },
    processingErrors: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Compound indexes for reconciliation queries
annexureRecordSchema.index({ vehicleNumber: 1, invoiceNumber: 1 });
annexureRecordSchema.index({ billNumber: 1, invoiceNumber: 1 });
annexureRecordSchema.index({ fileId: 1, rowNumber: 1 });

export const AnnexureRecord =
  mongoose.models.AnnexureRecord || mongoose.model("AnnexureRecord", annexureRecordSchema);
