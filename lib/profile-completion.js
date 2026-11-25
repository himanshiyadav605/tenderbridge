/**
 * MSME Company Profile Completion & Verification Utilities
 */

export const VERIFICATION_LABELS = {
  self_declared: "Self-Declared",
  pending: "Pending Verification",
  verified: "Verified",
  rejected: "Rejected",
};

export const VERIFICATION_STYLES = {
  self_declared: "border-blue-200 bg-blue-50 text-blue-800",
  pending: "border-amber-200 bg-amber-50 text-amber-900",
  verified: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-red-200 bg-red-50 text-red-800",
};

/**
 * Calculates profile completion percentage based strictly on mandatory fields.
 * Optional fields (such as trade name, Udyam number, website, ongoing works)
 * are never penalized as failures.
 *
 * @param {object|null} profile - MSME Profile object
 * @returns {{ percentage: number, completedCount: number, totalCount: number, sections: object }}
 */
export function calculateProfileCompletion(profile) {
  if (!profile || typeof profile !== "object") {
    return {
      percentage: 0,
      completedCount: 0,
      totalCount: 12,
      sections: {
        companyInfo: false,
        contactAddress: false,
        enlistments: false,
        financials: false,
        completedWorks: false,
      },
    };
  }

  // 1. Company Information (2 mandatory criteria)
  const hasLegalName = Boolean(profile.legalName && profile.legalName.trim().length >= 2);
  const hasCategory = Boolean(
    profile.msmeCategory && ["Micro", "Small", "Medium"].includes(profile.msmeCategory)
  );
  const companyInfoScore = (hasLegalName ? 1 : 0) + (hasCategory ? 1 : 0);

  // 2. Contact & Address (7 mandatory criteria)
  const hasAddress = Boolean(profile.registeredAddress && profile.registeredAddress.trim().length > 0);
  const hasCity = Boolean(profile.city && profile.city.trim().length > 0);
  const hasState = Boolean(profile.state && profile.state.trim().length > 0);
  const hasPincode = Boolean(profile.pincode && /^\d{6}$/.test(profile.pincode.trim()));
  const hasContactPerson = Boolean(profile.contactPerson && profile.contactPerson.trim().length > 0);
  const hasContactPhone = Boolean(profile.contactPhone && profile.contactPhone.trim().length >= 7);
  const hasContactEmail = Boolean(profile.contactEmail && profile.contactEmail.includes("@"));
  const contactScore =
    (hasAddress ? 1 : 0) +
    (hasCity ? 1 : 0) +
    (hasState ? 1 : 0) +
    (hasPincode ? 1 : 0) +
    (hasContactPerson ? 1 : 0) +
    (hasContactPhone ? 1 : 0) +
    (hasContactEmail ? 1 : 0);

  // 3. Departmental Enlistments (1 mandatory criterion)
  const hasEnlistments =
    Array.isArray(profile.departmentalEnlistments) &&
    profile.departmentalEnlistments.some(
      (e) => e && e.authority && e.registrationClass && e.registrationNumber
    );

  // 4. Financial Records (1 mandatory criterion)
  const hasFinancials =
    Array.isArray(profile.financialRecords) &&
    profile.financialRecords.some((f) => f && f.financialYear);

  // 5. Completed Works (1 mandatory criterion)
  const hasWorks =
    Array.isArray(profile.completedWorks) &&
    profile.completedWorks.some((w) => w && w.workTitle);

  const totalCount = 12;
  const completedCount =
    companyInfoScore +
    contactScore +
    (hasEnlistments ? 1 : 0) +
    (hasFinancials ? 1 : 0) +
    (hasWorks ? 1 : 0);

  const percentage = Math.round((completedCount / totalCount) * 100);

  return {
    percentage,
    completedCount,
    totalCount,
    sections: {
      companyInfo: companyInfoScore === 2,
      contactAddress: contactScore === 7,
      enlistments: hasEnlistments,
      financials: hasFinancials,
      completedWorks: hasWorks,
    },
  };
}
