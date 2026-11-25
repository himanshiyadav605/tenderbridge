import mongoose from "mongoose";

const VERIFICATION_STATUSES = ["self_declared", "pending", "verified", "rejected"];
const MSME_CATEGORIES = ["Micro", "Small", "Medium"];

/**
 * Subdocument: Departmental Enlistment
 */
const departmentalEnlistmentSchema = new mongoose.Schema(
  {
    authority: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    registrationClass: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    registrationNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    validityStartDate: {
      type: Date,
      default: null,
    },
    validityEndDate: {
      type: Date,
      default: null,
    },
    verificationStatus: {
      type: String,
      enum: VERIFICATION_STATUSES,
      default: "self_declared",
      required: true,
    },
    verificationReference: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },
  },
  { _id: false }
);

/**
 * Subdocument: Financial Information (Annual Year Record)
 */
const financialRecordSchema = new mongoose.Schema(
  {
    financialYear: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{4}-\d{4}$/, "Financial year must follow the YYYY-YYYY format"],
    },
    annualTurnover: {
      type: Number,
      min: [0, "Annual turnover cannot be negative"],
      default: 0,
    },
    profitAfterTax: {
      type: Number,
      default: 0,
    },
    lossStatus: {
      type: Boolean,
      default: false,
    },
    verificationStatus: {
      type: String,
      enum: VERIFICATION_STATUSES,
      default: "self_declared",
      required: true,
    },
    verificationReference: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },
  },
  { _id: false }
);

/**
 * Subdocument: Completed Works
 */
const completedWorkSchema = new mongoose.Schema(
  {
    workTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    department: {
      type: String,
      trim: true,
      default: "",
      maxlength: 150,
    },
    workDescription: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    location: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },
    contractValue: {
      type: Number,
      min: [0, "Contract value cannot be negative"],
      default: 0,
    },
    actualGrossPayment: {
      type: Number,
      min: [0, "Actual gross payment cannot be negative"],
      default: 0,
    },
    startDate: {
      type: Date,
      default: null,
    },
    completionDate: {
      type: Date,
      default: null,
    },
    completionCertificateReference: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },
    verificationStatus: {
      type: String,
      enum: VERIFICATION_STATUSES,
      default: "self_declared",
      required: true,
    },
  },
  { _id: false }
);

/**
 * Subdocument: Ongoing Works and Bidding Commitments
 */
const ongoingWorkSchema = new mongoose.Schema(
  {
    workTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    department: {
      type: String,
      trim: true,
      default: "",
      maxlength: 150,
    },
    contractValue: {
      type: Number,
      min: [0, "Contract value cannot be negative"],
      default: 0,
    },
    remainingValue: {
      type: Number,
      min: [0, "Remaining value cannot be negative"],
      default: 0,
    },
    expectedCompletionDate: {
      type: Date,
      default: null,
    },
    verificationStatus: {
      type: String,
      enum: VERIFICATION_STATUSES,
      default: "self_declared",
      required: true,
    },
  },
  { _id: false }
);

/**
 * Persistent MSME Company Profile Schema
 */
const msmeProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // A. Company identity
    legalName: {
      type: String,
      required: [true, "Legal name is required"],
      trim: true,
      minlength: [2, "Legal name must be at least 2 characters"],
      maxlength: [200, "Legal name must be at most 200 characters"],
    },
    tradeName: {
      type: String,
      trim: true,
      default: "",
      maxlength: [200, "Trade name must be at most 200 characters"],
    },
    udyamRegistrationNumber: {
      type: String,
      trim: true,
      default: "",
      maxlength: [50, "Udyam registration number must be at most 50 characters"],
    },
    msmeCategory: {
      type: String,
      enum: {
        values: MSME_CATEGORIES,
        message: "MSME category must be Micro, Small, or Medium",
      },
      required: [true, "MSME category is required"],
    },
    constitutionType: {
      type: String,
      trim: true,
      default: "",
      maxlength: [100, "Constitution type must be at most 100 characters"],
    },
    dateOfIncorporation: {
      type: Date,
      default: null,
    },
    industry: {
      type: String,
      trim: true,
      default: "",
      maxlength: [150, "Industry must be at most 150 characters"],
    },
    businessDescription: {
      type: String,
      trim: true,
      default: "",
      maxlength: [2000, "Business description must be at most 2000 characters"],
    },

    // B. Contact and address
    registeredAddress: {
      type: String,
      required: [true, "Registered address is required"],
      trim: true,
      maxlength: [500, "Registered address must be at most 500 characters"],
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
      maxlength: [100, "City must be at most 100 characters"],
    },
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
      maxlength: [100, "State must be at most 100 characters"],
    },
    pincode: {
      type: String,
      required: [true, "Pincode is required"],
      trim: true,
      match: [/^\d{6}$/, "Pincode must be exactly 6 digits"],
    },
    contactPerson: {
      type: String,
      required: [true, "Contact person is required"],
      trim: true,
      maxlength: [100, "Contact person must be at most 100 characters"],
    },
    contactPhone: {
      type: String,
      required: [true, "Contact phone is required"],
      trim: true,
      maxlength: [20, "Contact phone must be at most 20 characters"],
    },
    contactEmail: {
      type: String,
      required: [true, "Contact email is required"],
      trim: true,
      lowercase: true,
      maxlength: [254, "Contact email must be at most 254 characters"],
    },
    businessWebsite: {
      type: String,
      trim: true,
      default: "",
      maxlength: [255, "Business website must be at most 255 characters"],
    },

    // C. Departmental enlistments
    departmentalEnlistments: {
      type: [departmentalEnlistmentSchema],
      default: [],
    },

    // D. Financial information
    financialRecords: {
      type: [financialRecordSchema],
      default: [],
    },
    auditorName: {
      type: String,
      trim: true,
      default: "",
      maxlength: [100, "Auditor name must be at most 100 characters"],
    },
    auditorUDIN: {
      type: String,
      trim: true,
      default: "",
      maxlength: [50, "Auditor UDIN must be at most 50 characters"],
    },
    financialVerificationStatus: {
      type: String,
      enum: VERIFICATION_STATUSES,
      default: "self_declared",
      required: true,
    },

    // E. Completed works
    completedWorks: {
      type: [completedWorkSchema],
      default: [],
    },

    // F. Ongoing works and bidding commitments
    ongoingWorks: {
      type: [ongoingWorkSchema],
      default: [],
    },
    availableBidCapacity: {
      type: Number,
      min: [0, "Available bid capacity cannot be negative"],
      default: null,
    },
    biddingCapacityDeclarationReference: {
      type: String,
      trim: true,
      default: "",
      maxlength: [200, "Declaration reference must be at most 200 characters"],
    },
    biddingCapacityVerificationStatus: {
      type: String,
      enum: VERIFICATION_STATUSES,
      default: "self_declared",
      required: true,
    },

    // G. Verification metadata
    profileVerificationStatus: {
      type: String,
      enum: VERIFICATION_STATUSES,
      default: "self_declared",
      required: true,
    },
    lastVerifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.MsmeProfile || mongoose.model("MsmeProfile", msmeProfileSchema);
export { VERIFICATION_STATUSES, MSME_CATEGORIES };
