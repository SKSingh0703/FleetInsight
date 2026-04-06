import mongoose from "mongoose";

const { Schema } = mongoose;

const tripTypeEnum = ["OWN", "MARKET"];
const partyTypeEnum = ["TPT", "LOGISTICS", "OTHER"];

const sheetMetaSchema = new Schema(
  {
    spreadsheetId: { type: String, trim: true, index: true },
    tabName: { type: String, trim: true, index: true },
    rowNumber: { type: Number },
    raw: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    // Core identifiers
    tripKey: { type: String, required: true, unique: true, index: true, trim: true },
    sno: { type: String, index: true, trim: true },
    invoiceNumber: { type: String, index: true, trim: true },
    deliveryNumber: { type: String, index: true, trim: true },
    chassisNumber: { type: String, index: true, trim: true },
    vehicleNumber: { type: String, index: true, trim: true },
    vehicleSuffix: { type: String, index: true, trim: true },

    tripNumber: { type: String, index: true, trim: true },

    // OWN vs MARKET (MARKET typically has a book number)
    tripType: { type: String, required: true, enum: tripTypeEnum, index: true },
    marketVehicleBookNumber: {
      type: String,
      trim: true,
      index: true,
    },

    // Dates
    loadingDate: { type: Date, index: true },
    unloadingDate: { type: Date, index: true },
    challanDate: { type: Date },
    cashDate: { type: Date },
    dieselDate: { type: Date },
    fastagDate: { type: Date },
    marketPaymentDate: { type: Date },

    // Locations
    loadingPoint: { type: String, trim: true, index: true },
    unloadingPoint: { type: String, trim: true, index: true },

    // Weights + Rates
    loadingWeightTons: { type: Number, default: 0, min: 0 },
    unloadingWeightTons: { type: Number, default: 0, min: 0 },
    shortageTons: { type: Number, default: 0 },
    ratePerTon: { type: Number, default: 0, min: 0 },
    totalFreight: { type: Number, default: 0 },

    // Payments / Expenses
    cash: { type: Number, default: 0, min: 0 },
    cardAccount: { type: String, trim: true },
    diesel: { type: Number, default: 0, min: 0 },
    pumpCard: { type: String, trim: true },
    fastag: { type: Number, default: 0, min: 0 },
    totalAdvance: { type: Number, default: 0, min: 0 },
    otherExpenses: { type: Number, default: 0, min: 0 },

    // Party classification
    partyType: { type: String, required: true, enum: partyTypeEnum, index: true },
    partyName: { type: String, trim: true, index: true },

    billBookNumber: { type: String, trim: true, index: true },
    remarks: { type: String, trim: true },
    tripStatus: { type: String, trim: true, index: true },

    // Original sheet row (to render trip details with familiar labels later)
    sheet: { type: sheetMetaSchema, default: {} },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Helpful compound indexes for filtering/search
tripSchema.index({ vehicleNumber: 1, loadingDate: -1 });
tripSchema.index({ vehicleSuffix: 1, loadingDate: -1 });
tripSchema.index({ partyType: 1, loadingDate: -1 });
tripSchema.index({ "sheet.spreadsheetId": 1, "sheet.tabName": 1, sno: 1 });

export const Trip = mongoose.model("Trip", tripSchema);

