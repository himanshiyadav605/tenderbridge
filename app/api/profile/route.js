import connectDB from "../../../lib/db.js";
import { getCurrentUser } from "../../../lib/current-user.js";
import { isDuplicateKeyError, jsonResult, readJsonBody } from "../../../lib/http.js";
import { validateProfileInput } from "../../../lib/profile-input.js";
import MsmeProfile from "../../../models/MsmeProfile.js";

/**
 * GET /api/profile
 * Returns the authenticated user's persistent MSME company profile.
 * If no profile exists yet, returns { profile: null } with status 200.
 */
export async function GET() {
  const auth = await getCurrentUser();

  if (auth.sessionState === "expired") {
    return jsonResult({ error: "Your session has expired. Please sign in again." }, 401);
  }

  if (auth.sessionState === "error") {
    return jsonResult(
      { error: "The service is temporarily unavailable. Please try again." },
      503
    );
  }

  if (!auth.user) {
    return jsonResult({ error: "Authentication required." }, 401);
  }

  try {
    await connectDB();
    const profile = await MsmeProfile.findOne({ userId: auth.user.id }).lean();
    return jsonResult({ profile: profile || null }, 200);
  } catch (error) {
    console.error("Profile GET failed because database could not be reached:", error.message);
    return jsonResult(
      { error: "The service is temporarily unavailable. Please try again." },
      503
    );
  }
}

/**
 * POST /api/profile
 * Creates a persistent MSME company profile linked strictly to the authenticated user's ID.
 * Rejects mass assignment, duplicate profiles, and unauthorized verification elevation.
 */
export async function POST(request) {
  const auth = await getCurrentUser();

  if (auth.sessionState === "expired") {
    return jsonResult({ error: "Your session has expired. Please sign in again." }, 401);
  }

  if (auth.sessionState === "error") {
    return jsonResult(
      { error: "The service is temporarily unavailable. Please try again." },
      503
    );
  }

  if (!auth.user) {
    return jsonResult({ error: "Authentication required." }, 401);
  }

  const parsed = await readJsonBody(request);
  if (!parsed.ok) {
    return jsonResult({ error: parsed.error }, 400);
  }

  const validation = validateProfileInput(parsed.body, false);
  if (!validation.ok) {
    return jsonResult({ error: validation.error }, validation.status || 400);
  }

  try {
    await connectDB();

    // Check for existing profile linked to this user
    const existing = await MsmeProfile.findOne({ userId: auth.user.id }).select("_id");
    if (existing) {
      return jsonResult(
        { error: "A company profile already exists for this account. Use PUT to update it." },
        409
      );
    }

    // Force strict ownership binding to authenticated user
    const profilePayload = Object.assign({}, validation.data, {
      userId: auth.user.id,
      profileVerificationStatus: "self_declared",
      financialVerificationStatus: "self_declared",
      biddingCapacityVerificationStatus: "self_declared",
      lastVerifiedAt: null,
    });

    const profile = await MsmeProfile.create(profilePayload);
    return jsonResult({ profile }, 201);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return jsonResult(
        { error: "A company profile already exists for this account." },
        409
      );
    }
    console.error("Profile POST failed because database could not be reached:", error.message);
    return jsonResult(
      { error: "The service is temporarily unavailable. Please try again." },
      503
    );
  }
}

/**
 * PUT /api/profile
 * Updates the authenticated user's existing MSME company profile.
 * Scoped strictly to the authenticated user's profile; prevents elevation of verification fields.
 */
export async function PUT(request) {
  const auth = await getCurrentUser();

  if (auth.sessionState === "expired") {
    return jsonResult({ error: "Your session has expired. Please sign in again." }, 401);
  }

  if (auth.sessionState === "error") {
    return jsonResult(
      { error: "The service is temporarily unavailable. Please try again." },
      503
    );
  }

  if (!auth.user) {
    return jsonResult({ error: "Authentication required." }, 401);
  }

  const parsed = await readJsonBody(request);
  if (!parsed.ok) {
    return jsonResult({ error: parsed.error }, 400);
  }

  const validation = validateProfileInput(parsed.body, true);
  if (!validation.ok) {
    return jsonResult({ error: validation.error }, validation.status || 400);
  }

  try {
    await connectDB();

    const profile = await MsmeProfile.findOne({ userId: auth.user.id });
    if (!profile) {
      return jsonResult(
        { error: "Company profile not found. Please create a profile before updating." },
        404
      );
    }

    // Apply only whitelisted, sanitized fields
    for (const [key, value] of Object.entries(validation.data)) {
      // Ensure immutable identity binding
      if (
        key === "userId" ||
        key === "_id" ||
        key === "departmentalEnlistments" ||
        key === "financialRecords" ||
        key === "completedWorks" ||
        key === "ongoingWorks"
      ) {
        continue;
      }
      profile[key] = value;
    }

    // Preserve verification statuses for nested subdocuments if established by trusted workflows
    if (Array.isArray(validation.data.departmentalEnlistments)) {
      const existingMap = new Map();
      for (const item of profile.departmentalEnlistments || []) {
        const key = `${(item.authority || "").trim().toLowerCase()}::${(item.registrationNumber || "").trim().toLowerCase()}`;
        if (item.verificationStatus) {
          existingMap.set(key, item.verificationStatus);
        }
      }
      profile.departmentalEnlistments = validation.data.departmentalEnlistments.map((item) => {
        const key = `${(item.authority || "").trim().toLowerCase()}::${(item.registrationNumber || "").trim().toLowerCase()}`;
        const existingStatus = existingMap.get(key);
        return {
          ...item,
          verificationStatus: existingStatus || "self_declared",
        };
      });
    }

    if (Array.isArray(validation.data.financialRecords)) {
      const existingMap = new Map();
      for (const item of profile.financialRecords || []) {
        const key = (item.financialYear || "").trim();
        if (item.verificationStatus) {
          existingMap.set(key, item.verificationStatus);
        }
      }
      profile.financialRecords = validation.data.financialRecords.map((item) => {
        const key = (item.financialYear || "").trim();
        const existingStatus = existingMap.get(key);
        return {
          ...item,
          verificationStatus: existingStatus || "self_declared",
        };
      });
    }

    if (Array.isArray(validation.data.completedWorks)) {
      const existingMap = new Map();
      for (const item of profile.completedWorks || []) {
        const key = (item.workTitle || "").trim().toLowerCase();
        if (item.verificationStatus) {
          existingMap.set(key, item.verificationStatus);
        }
      }
      profile.completedWorks = validation.data.completedWorks.map((item) => {
        const key = (item.workTitle || "").trim().toLowerCase();
        const existingStatus = existingMap.get(key);
        return {
          ...item,
          verificationStatus: existingStatus || "self_declared",
        };
      });
    }

    if (Array.isArray(validation.data.ongoingWorks)) {
      const existingMap = new Map();
      for (const item of profile.ongoingWorks || []) {
        const key = (item.workTitle || "").trim().toLowerCase();
        if (item.verificationStatus) {
          existingMap.set(key, item.verificationStatus);
        }
      }
      profile.ongoingWorks = validation.data.ongoingWorks.map((item) => {
        const key = (item.workTitle || "").trim().toLowerCase();
        const existingStatus = existingMap.get(key);
        return {
          ...item,
          verificationStatus: existingStatus || "self_declared",
        };
      });
    }

    // Preserve top-level verification statuses established by trusted workflows
    profile.profileVerificationStatus = profile.profileVerificationStatus || "self_declared";
    profile.financialVerificationStatus = profile.financialVerificationStatus || "self_declared";
    profile.biddingCapacityVerificationStatus =
      profile.biddingCapacityVerificationStatus || "self_declared";

    await profile.save();
    return jsonResult({ profile }, 200);
  } catch (error) {
    console.error("Profile PUT failed because database could not be reached:", error.message);
    return jsonResult(
      { error: "The service is temporarily unavailable. Please try again." },
      503
    );
  }
}
