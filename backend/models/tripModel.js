import mongoose from "mongoose";

const { Schema } = mongoose;

const tripTypeEnum = ["OWN", "MARKET"];
const partyTypeEnum = ["TPT", "LOGISTICS", "OTHER"];

const locationSchema = new Schema(
  {
    name: { type: String, trim: true },
  },
  { _id: false }
);

const movementSchema = new Schema(
  {
    date: { type: Date, index: true },
    location: { type: locationSchema, required: true },
    weightTons: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const sheetMetaSchema = new Schema(
  {
    sheetName: { type: String, trim: true },
    rowNumber: { type: Number },
    raw: { type: Schema.Types.Mixed, default: {} },
    normalized: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    // Core identifiers
    tripKey: { type: String, required: true, unique: true, index: true, trim: true },
    invoiceNumber: { type: String, index: true, trim: true },
    chassisNumber: { type: String, required: true, index: true, trim: true },
    vehicleNumber: { type: String, index: true, trim: true },
    vehicleSuffix: { type: String, index: true, trim: true },

    // OWN vs MARKET (MARKET typically has a book number)
    tripType: { type: String, required: true, enum: tripTypeEnum, index: true },
    bookNumber: {
      type: String,
      trim: true,
      index: true,
      required: function requiredBookNumber() {
        return this.tripType === "MARKET";
      },
    },

    // Party classification
    partyType: { type: String, required: true, enum: partyTypeEnum, index: true },
    partyName: { type: String, trim: true, index: true },

    // Loading + Unloading
    loading: { type: movementSchema, required: true },
    unloading: { type: movementSchema, required: true },

    // Rate is per ton
    ratePerTon: { type: Number, required: true, min: 0 },

    // Expenses (explicit buckets)
    expenses: {
      cash: { type: Number, default: 0, min: 0 },
      diesel: { type: Number, default: 0, min: 0 },
      other: { type: Number, default: 0, min: 0 },
    },

    // Flexible JSON for future extensions (no schema migration needed)
    extensions: { type: Schema.Types.Mixed, default: {} },

    // Original sheet row (to render trip details with familiar labels later)
    sheet: { type: sheetMetaSchema, default: {} },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Computed fields (not stored in DB)
tripSchema.virtual("shortageTons").get(function shortageTons() {
  const load = this.loading?.weightTons ?? 0;
  const unload = this.unloading?.weightTons ?? 0;
  return load - unload;
});

tripSchema.virtual("totalFreight").get(function totalFreight() {
  const unload = this.unloading?.weightTons ?? 0;
  const rate = this.ratePerTon ?? 0;
  return unload * rate;
});

tripSchema.virtual("profit").get(function profit() {
  const cash = this.expenses?.cash ?? 0;
  const diesel = this.expenses?.diesel ?? 0;
  const other = this.expenses?.other ?? 0;
  const shortage = this.shortageTons ?? 0;
  const rate = this.ratePerTon ?? 0;
  return this.totalFreight - (cash + diesel + other + shortage * rate);
});

// Helpful compound indexes for later filtering/search
tripSchema.index({ vehicleNumber: 1, "loading.date": -1 });
tripSchema.index({ vehicleSuffix: 1, "loading.date": -1 });
tripSchema.index({ "loading.location.name": 1 });
tripSchema.index({ "unloading.location.name": 1 });
tripSchema.index({ partyType: 1, "loading.date": -1 });

// For Phase 1 requirement: index on "date" fields used in queries.
// We keep them directly on loading/unloading rather than duplicating into a top-level date.
tripSchema.index({ "loading.date": -1 });
tripSchema.index({ "unloading.date": -1 });

export const Trip = mongoose.model("Trip", tripSchema);

