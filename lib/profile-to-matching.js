/**
 * lib/profile-to-matching.js
 *
 * Adapter module connecting persistent MongoDB MSME profile documents (models/MsmeProfile.js)
 * to the TenderBridge preliminary tender-matching engine (lib/tender-matching.js).
 *
 * SCOPE & RESPONSIBILITIES:
 * - Accepts a MongoDB MsmeProfile document (or plain JavaScript object).
 * - Adapts it into the exact data structure expected by evaluateTenderMatch(tender, companyProfile).
 * - Converts Mongoose documents into plain JavaScript objects without mutating the database record.
 * - Preserves verification statuses and references strictly as recorded.
 * - Preserves missing values (e.g. altitude, CPWD DSR coverage, termContract boolean flag) as undefined/null
 *   so the matching engine correctly identifies them as "needs_verification" rather than inventing data.
 * - Never marks self-declared information as verified.
 */

function formatDateString(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return null;
}

function parseFiniteNumber(val) {
  if (val === null || val === undefined || val === "") return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

/**
 * Adapt a persistent MongoDB MSME profile for the evaluateTenderMatch() engine.
 *
 * @param {object|null} profile - Stored MsmeProfile document or lean object.
 * @returns {object|null} - Plain JavaScript object formatted for evaluateTenderMatch().
 */
export function adaptProfileForMatching(profile) {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  // Safely convert Mongoose document to plain JavaScript object if applicable
  const raw = typeof profile.toObject === "function" ? profile.toObject() : { ...profile };

  // 1. Registrations Mapping (Departmental Enlistments + Udyam)
  const registrations = [];

  if (Array.isArray(raw.departmentalEnlistments)) {
    for (let i = 0; i < raw.departmentalEnlistments.length; i++) {
      const e = raw.departmentalEnlistments[i];
      if (!e || typeof e !== "object") continue;

      const auth = (e.authority || "").trim();
      const isDcwe = auth.toUpperCase().includes("DCW");

      registrations.push({
        registrationType: "Departmental Enlistment",
        enlistmentBody: auth,
        // DCW&E Composite category mapping
        category: isDcwe ? "Composite" : "",
        enlistmentClass: (e.registrationClass || "").trim(),
        referenceNumber: (e.registrationNumber || "").trim(),
        validityStartDate: formatDateString(e.validityStartDate),
        validityEndDate: formatDateString(e.validityEndDate),
        verificationStatus: e.verificationStatus || "self_declared",
        verificationReference: (e.verificationReference || "").trim(),
        isDemonstrationValue: false,
      });
    }
  }

  // Include Udyam registration if declared
  if (raw.udyamRegistrationNumber && raw.udyamRegistrationNumber.trim().length > 0) {
    registrations.push({
      registrationType: "Udyam",
      registrationNumber: raw.udyamRegistrationNumber.trim(),
      verificationStatus: "self_declared",
      isDemonstrationValue: false,
    });
  }

  // 2. Financial Records Mapping
  const financialRecords = [];
  if (Array.isArray(raw.financialRecords)) {
    for (let j = 0; j < raw.financialRecords.length; j++) {
      const f = raw.financialRecords[j];
      if (!f || typeof f !== "object") continue;

      const fy = (f.financialYear || "").trim();
      const turnover = parseFiniteNumber(f.annualTurnover);
      const profit = parseFiniteNumber(f.profitAfterTax);
      const isLoss = typeof f.lossStatus === "boolean" ? f.lossStatus : (profit !== null && profit < 0);

      const hasUdin = Boolean(raw.auditorUDIN && raw.auditorUDIN.trim().length > 0);
      const isAudited = raw.financialVerificationStatus === "verified" || f.verificationStatus === "verified";

      financialRecords.push({
        financialYear: fy,
        annualTurnover: turnover !== null ? turnover : 0,
        profitAfterTax: profit !== null ? profit : 0,
        lossStatus: isLoss,
        verificationStatus: f.verificationStatus || "self_declared",
        verificationReference: (f.verificationReference || "").trim(),
        isDemonstrationValue: false,
        // Statutory auditor UDIN reference
        udin: hasUdin ? raw.auditorUDIN.trim() : (f.verificationReference || "").trim(),
        statutoryAuditorCertified: isAudited && hasUdin,
        caCertified: isAudited && hasUdin,
        // Adjusted turnover figures cannot be fabricated or inferred
        adjustedTurnoverBasisDocumented: false,
        adjustedAnnualTurnover: undefined,
      });
    }
  }

  // 3. Completed Works Mapping
  const completedWorks = [];
  if (Array.isArray(raw.completedWorks)) {
    for (let k = 0; k < raw.completedWorks.length; k++) {
      const w = raw.completedWorks[k];
      if (!w || typeof w !== "object") continue;

      const compDateStr = formatDateString(w.completionDate);
      const startDateStr = formatDateString(w.startDate);
      const actualGross = parseFiniteNumber(w.actualGrossPayment);
      const contractVal = parseFiniteNumber(w.contractValue);

      completedWorks.push({
        workTitle: (w.workTitle || "").trim(),
        workDescription: (w.workDescription || "").trim(),
        workCategory: (raw.industry || "").trim(),
        clientOrganization: (w.department || "").trim(),
        workLocation: (w.location || "").trim(),
        contractValue: contractVal,
        originalContractPeriodValue: contractVal,
        actualGrossPayment: actualGross,
        actualGrossPaymentsOriginalPeriod: actualGross,
        originalContractPeriodStartDate: startDateStr,
        originalContractPeriodEndDate: compDateStr,
        completionDate: compDateStr,
        completionStatus: compDateStr ? "Completed" : "In Progress",
        isCompleted: Boolean(compDateStr),
        // Domain-specific technical criteria not captured in basic profile schema:
        // Preserved as undefined/null so matching engine accurately evaluates as needs_verification
        termContract: undefined,
        altitudeInFeet: undefined,
        altitudeAbove6500Feet: undefined,
        coveredByCPWDDSR: undefined,
        workPerformance: undefined,
        declaredSimilarWork: (w.workDescription || w.workTitle || "").trim(),
        verificationStatus: w.verificationStatus || "self_declared",
        isDemonstrationValue: false,
        certificateDetails: {
          actualCertificateDataAvailable: w.verificationStatus === "verified",
          declared: {
            statesWorkDuration: Boolean(startDateStr && compDateStr),
            statesWorkValue: Boolean(actualGross !== null || contractVal !== null),
          },
          certificateReference: (w.completionCertificateReference || "").trim(),
        },
      });
    }
  }

  // 4. Ongoing Works Commitments (Parameter B in bidding capacity formula)
  let totalOngoingCommitmentsB = 0;
  let hasOngoingWorks = false;
  if (Array.isArray(raw.ongoingWorks) && raw.ongoingWorks.length > 0) {
    hasOngoingWorks = true;
    for (let m = 0; m < raw.ongoingWorks.length; m++) {
      const ow = raw.ongoingWorks[m];
      if (ow && typeof ow === "object") {
        const remaining = parseFiniteNumber(ow.remainingValue);
        if (remaining !== null) {
          totalOngoingCommitmentsB += remaining;
        }
      }
    }
  }

  // 5. Bidding Capacity Declaration Mapping
  let biddingCapacityDeclaration = null;
  const declaredBidCapacity = parseFiniteNumber(raw.availableBidCapacity);
  const declarationRef = (raw.biddingCapacityDeclarationReference || "").trim();

  if (declaredBidCapacity !== null || declarationRef.length > 0) {
    biddingCapacityDeclaration = {
      availableBidCapacity: declaredBidCapacity,
      declarationSubmitted: declarationRef.length > 0,
      declarationReference: declarationRef,
      declaredCommitmentsNext12MonthsB: hasOngoingWorks ? totalOngoingCommitmentsB : null,
      // Parameter A (peak construction work executed over 5 years adjusted at 7%) is not separate in basic profile
      adjustedConstructionWorkExecutedA: null,
      verificationStatus: raw.biddingCapacityVerificationStatus || "self_declared",
      isDemonstrationValue: false,
      udin: (raw.auditorUDIN || "").trim(),
    };
  }

  return {
    isDemoData: false,
    isIndependentlyVerified: raw.profileVerificationStatus === "verified",
    preliminaryMatchingStatus:
      raw.profileVerificationStatus === "verified" ? "Verified" : "Needs Verification",
    companyName: (raw.legalName || raw.tradeName || "").trim(),
    legalName: (raw.legalName || "").trim(),
    tradeName: (raw.tradeName || "").trim(),
    enterpriseType: (raw.msmeCategory || "").trim(),
    industry: (raw.industry || "").trim(),
    location: {
      state: (raw.state || "").trim(),
      city: (raw.city || "").trim(),
      address: (raw.registeredAddress || "").trim(),
      pincode: (raw.pincode || "").trim(),
    },
    registrations,
    financialRecords,
    completedWorks,
    biddingCapacityDeclaration,
    // Original raw metadata references
    userId: raw.userId ? String(raw.userId) : null,
    profileVerificationStatus: raw.profileVerificationStatus || "self_declared",
  };
}
