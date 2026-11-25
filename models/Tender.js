import mongoose from "mongoose";

const tenderSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      enum: ["GEM"],
      required: true,
      index: true,
    },
    recordType: {
      type: String,
      enum: ["real"],
      required: true,
      default: "real",
    },
    officialTenderId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    externalId: {
      type: String,
      trim: true,
      default: null,
      maxlength: 200,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    bidType: {
      type: String,
      trim: true,
      default: null,
      maxlength: 100,
    },
    quantity: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ministryOrState: {
      type: String,
      trim: true,
      default: null,
      maxlength: 300,
    },
    department: {
      type: String,
      trim: true,
      default: null,
      maxlength: 300,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    submissionDeadline: {
      type: Date,
      default: null,
    },
    isHighValue: {
      type: Boolean,
      default: null,
    },
    isGlobalTender: {
      type: Boolean,
      default: null,
    },
    isLimitedTender: {
      type: Boolean,
      default: null,
    },
    currency: {
      type: String,
      trim: true,
      default: null,
      maxlength: 20,
    },
    documentUrl: {
      type: String,
      trim: true,
      default: null,
      maxlength: 2000,
    },
    portalUrl: {
      type: String,
      trim: true,
      default: null,
      maxlength: 2000,
    },
    daysToClose: {
      type: Number,
      default: null,
    },
    sourceFetchedAt: {
      type: Date,
      default: null,
    },
    firstSeenAt: {
      type: Date,
      required: true,
    },
    lastSeenAt: {
      type: Date,
      required: true,
    },
    lastFetchedAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

tenderSchema.index(
  { source: 1, officialTenderId: 1 },
  { unique: true, name: "source_official_tender_unique" }
);

export default mongoose.models.Tender || mongoose.model("Tender", tenderSchema);
