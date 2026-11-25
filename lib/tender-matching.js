/**
 * lib/tender-matching.js
 *
 * INT257: Modern Web Application Development — Units I–IV (Topic 1)
 * TenderBridge Preliminary Tender-Matching Module
 *
 * Exports:
 *   evaluateTenderMatch(tender, companyProfile) → MatchResult
 *
 * DISCLAIMER:
 *   This module performs a preliminary, automated check only.
 *   A passing status does NOT guarantee acceptance by the tender authority.
 *   Self-declared and unverified data must be independently confirmed before
 *   submission. Eligibility determination rests solely with the procuring entity.
 *
 * Scope: Ordinary JS functions, arrays, objects, loops, and conditionals.
 *        No external packages. No authentication. No database. No APIs.
 */

// ---------------------------------------------------------------------------
// Status constants
// ---------------------------------------------------------------------------
var STATUS_PASS = "pass";
var STATUS_FAIL = "fail";
var STATUS_NEEDS_VERIFICATION = "needs_verification";

var OVERALL_ELIGIBLE = "Eligible";
var OVERALL_NOT_ELIGIBLE = "Not Eligible";
var OVERALL_NEEDS_VERIFICATION = "Needs Verification";

// ---------------------------------------------------------------------------
// Date helpers (Strict UTC Accessors)
// ---------------------------------------------------------------------------

/**
 * Parse a date string (YYYY-MM-DD or ISO-8601) and return a Date object.
 * Returns null if the string is falsy or unparseable.
 * When YYYY-MM-DD is passed, parses strictly as UTC.
 */
function parseDate(str) {
  if (!str) return null;
  if (str instanceof Date) {
    return isNaN(str.getTime()) ? null : str;
  }
  if (typeof str !== "string") return null;
  var s = str.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    s += "T00:00:00.000Z";
  }
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Calculate fractional years between two Dates using a simple 365.25-day year.
 * Returns null if either date is null.
 */
function yearsBetween(earlier, later) {
  if (!earlier || !later) return null;
  var msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  return (later.getTime() - earlier.getTime()) / msPerYear;
}

/**
 * Apply the 7% simple-rate-per-annum escalation.
 *
 *   adjustedValue = originalValue * (1 + 0.07 * years)
 *
 * Returns null if any input is missing or invalid.
 *
 * @param {number} originalValue  - Value at completion date.
 * @param {Date}   completionDate - Date from which escalation runs.
 * @param {Date}   cutoffDate     - Date to which escalation runs.
 */
function applySimpleRateEscalation(originalValue, completionDate, cutoffDate) {
  if (
    originalValue === null ||
    originalValue === undefined ||
    !completionDate ||
    !cutoffDate
  ) {
    return null;
  }
  if (typeof originalValue !== "number" || !Number.isFinite(originalValue) || originalValue < 0) {
    return null;
  }
  var years = yearsBetween(completionDate, cutoffDate);
  if (years === null) return null;
  if (years < 0) years = 0;
  return originalValue * (1 + 0.07 * years);
}

/**
 * Computes the seven-year lookback date range using strict UTC accessors.
 *
 * Tender notice wording:
 *   "during the last seven years ending last day of the month previous to the
 *   one in which applications are invited."
 *
 * For publication date 2026-11-16 (applications invited November 2026):
 * - Application month: November 2026 (UTC month index 10)
 * - Previous month: October 2026 (UTC month index 9)
 * - Window end: 2026-10-31 23:59:59.999 UTC (last millisecond of October 2026)
 * - Window start: 2019-11-01 00:00:00.000 UTC (seven full years ending on the last day of previous month)
 *
 * @param {string} publicationDateStr - tender.publicationDate (YYYY-MM-DD)
 * @returns {{ start: Date, end: Date } | null}
 */
function getSevenYearLookbackWindow(publicationDateStr) {
  var pub = parseDate(publicationDateStr);
  if (!pub) return null;

  var year = pub.getUTCFullYear();
  var month = pub.getUTCMonth(); // 0-based; e.g. 10 for November

  // Day 0 of publication month is the last day of the previous month:
  // e.g. Date.UTC(2026, 10, 0, 23, 59, 59, 999) -> 2026-10-31 23:59:59.999 UTC
  var lookbackEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  // Seven years prior starting on the 1st of the application month:
  // Date.UTC(2026 - 7, 10, 1, 0, 0, 0, 0) -> 2019-11-01 00:00:00.000 UTC
  var lookbackStart = new Date(Date.UTC(year - 7, month, 1, 0, 0, 0, 0));

  return {
    start: lookbackStart,
    end: lookbackEnd,
  };
}

// ---------------------------------------------------------------------------
// Shared Helper: Financial Year Validation
// ---------------------------------------------------------------------------

/**
 * Validates that records contain distinct, consecutive financial years in YYYY-YYYY format.
 *
 * @param {Array} records - Array of financial record objects
 * @param {number} yearsRequired - Number of years required
 * @returns {{ valid: boolean, selected?: Array, reason?: string }}
 */
/**
 * Validate and select financial-year records for turnover and solvency evaluation.
 *
 * Rules:
 * 1. Rejects null, non-object, or array entries before accessing properties.
 * 2. Selects the required most recent financial years.
 * 3. Does not allow malformed records outside the selected evaluation window to
 *    invalidate otherwise valid recent records.
 * 4. Validates format (YYYY-YYYY), span (endYear === startYear + 1), distinctness,
 *    and strict consecutive sequence for the selected window.
 * 5. Returns { valid: false, reason: "..." } on duplicate or conflicting records
 *    within the selected evaluation window (triggering Needs Verification).
 * 6. Ensures downstream functions never receive null or malformed selected records.
 */
function validateFinancialYears(records, yearsRequired) {
  if (!Array.isArray(records)) {
    return { valid: false, reason: "Financial records must be an array." };
  }
  if (typeof yearsRequired !== "number" || !Number.isInteger(yearsRequired) || yearsRequired <= 0) {
    return { valid: false, reason: "Invalid yearsRequired parameter." };
  }
  if (records.length < yearsRequired) {
    return { valid: false, reason: "Insufficient financial year records (" + records.length + " provided, " + yearsRequired + " required)." };
  }

  // Parse all records that have valid structure and financialYear
  // Records are scanned safely without throwing on null or non-objects
  var validEntries = [];
  var hasMalformedEntries = false;

  for (var i = 0; i < records.length; i++) {
    var rec = records[i];
    // Reject null, not an object, or an array before accessing properties
    if (rec === null || typeof rec !== "object" || Array.isArray(rec)) {
      hasMalformedEntries = true;
      continue;
    }

    if (typeof rec.financialYear !== "string") {
      hasMalformedEntries = true;
      continue;
    }

    var fy = rec.financialYear.trim();
    var m = /^(\d{4})-(\d{4})$/.exec(fy);
    if (!m) {
      hasMalformedEntries = true;
      continue;
    }

    var startYear = parseInt(m[1], 10);
    var endYear = parseInt(m[2], 10);
    if (endYear !== startYear + 1) {
      hasMalformedEntries = true;
      continue;
    }

    validEntries.push({
      startYear: startYear,
      endYear: endYear,
      financialYear: fy,
      record: rec,
      originalIndex: i,
    });
  }

  // If there are not even enough valid entries to satisfy yearsRequired:
  if (validEntries.length < yearsRequired) {
    return {
      valid: false,
      reason: "Insufficient valid financial records (" + validEntries.length + " valid parsed, " + yearsRequired + " required). Malformed or missing records detected.",
    };
  }

  // Determine the highest startYear among valid entries to anchor the evaluation window
  var maxStartYear = -Infinity;
  for (var v = 0; v < validEntries.length; v++) {
    if (validEntries[v].startYear > maxStartYear) {
      maxStartYear = validEntries[v].startYear;
    }
  }

  // The evaluation window consists of the most recent consecutive financial years:
  // [maxStartYear - yearsRequired + 1 ... maxStartYear]
  var selected = [];
  var minWindowYear = maxStartYear - yearsRequired + 1;

  for (var year = maxStartYear; year >= minWindowYear; year--) {
    var matching = [];
    for (var k = 0; k < validEntries.length; k++) {
      if (validEntries[k].startYear === year) {
        matching.push(validEntries[k]);
      }
    }

    // Missing year in consecutive sequence
    if (matching.length === 0) {
      return {
        valid: false,
        reason: "Non-consecutive financial years: missing record for " + year + "-" + (year + 1) + " in the evaluation window.",
      };
    }

    // Duplicate or conflicting records within the selected evaluation window
    if (matching.length > 1) {
      return {
        valid: false,
        reason: "Duplicate or conflicting record detected for financial year " + year + "-" + (year + 1) + " within the evaluation window.",
      };
    }

    // Exactly 1 match: verify record structure
    var chosen = matching[0];
    if (chosen.record === null || typeof chosen.record !== "object" || Array.isArray(chosen.record)) {
      return {
        valid: false,
        reason: "Malformed record in evaluation window: entry is null or not an object.",
      };
    }

    selected.push(chosen);
  }

  // Final check: selected must have exactly yearsRequired records, all distinct and valid
  if (selected.length !== yearsRequired) {
    return {
      valid: false,
      reason: "Could not select " + yearsRequired + " valid consecutive financial years.",
    };
  }

  return { valid: true, selected: selected };
}

// ---------------------------------------------------------------------------
// Criterion A — Departmental Enlistment
// ---------------------------------------------------------------------------

/**
 * Check DCW&E Composite enlistment and DRDO-2024 BIM enlistment.
 *
 * Rules:
 * - Evaluates all matching registrations for each authority (not first-match only).
 * - A company is not automatically disqualified if its first matching registration has
 *   a disallowed class when another independently valid registration for the same authority
 *   has a permitted class.
 * - If records conflict or cannot be reliably evaluated, returns STATUS_NEEDS_VERIFICATION.
 * - Preserves requirement for both authorities (& conjunction) and the administrative
 *   clarification note.
 *
 * @param {object} enlistmentCriterion - tender.eligibilityRequirements entry
 * @param {Array}  registrations       - companyProfile.registrations
 * @returns {{ status: string, reason: string }}
 */
function checkDepartmentalEnlistment(enlistmentCriterion, registrations) {
  if (!enlistmentCriterion || !enlistmentCriterion.expectedValue) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "Enlistment criterion data missing from tender record. Cannot evaluate.",
    };
  }

  var ev = enlistmentCriterion.expectedValue;
  var permittedDcwe = Array.isArray(ev.dcweEnlistment && ev.dcweEnlistment.classesPermitted)
    ? ev.dcweEnlistment.classesPermitted
    : [];
  var permittedBim = Array.isArray(ev.drdoBimEnlistment && ev.drdoBimEnlistment.classesPermitted)
    ? ev.drdoBimEnlistment.classesPermitted
    : [];

  if (!Array.isArray(registrations) || registrations.length === 0) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "Missing enlistment evidence: no registration records found in company profile.",
    };
  }

  // Collect ALL registrations matching DCW&E Composite
  var dcweRegistrations = [];
  // Collect ALL registrations matching DRDO-2024 BIM
  var bimRegistrations = [];

  for (var i = 0; i < registrations.length; i++) {
    var reg = registrations[i];
    if (!reg || typeof reg !== "object") continue;

    var body = typeof reg.enlistmentBody === "string" ? reg.enlistmentBody : "";
    var cat = typeof reg.category === "string" ? reg.category : "";

    if (body.toUpperCase().indexOf("DCW") !== -1 && cat.toLowerCase() === "composite") {
      dcweRegistrations.push(reg);
    }

    if (body.toUpperCase().indexOf("DRDO") !== -1 && body.toUpperCase().indexOf("BIM") !== -1) {
      bimRegistrations.push(reg);
    }
  }

  // Helper to evaluate an authority's registrations across all declared records
  function evaluateAuthorityRegistrations(regs, permittedClasses, authorityName) {
    if (regs.length === 0) {
      return {
        hasPermitted: false,
        allDisallowed: false,
        isMissing: true,
        isConflictOrAmbiguous: false,
        bestRecord: null,
      };
    }

    var permittedMatches = [];
    var disallowedMatches = [];
    var malformedMatches = [];

    for (var j = 0; j < regs.length; j++) {
      var r = regs[j];
      var cls = r.enlistmentClass;
      if (typeof cls !== "string" || cls.trim().length === 0) {
        malformedMatches.push(r);
        continue;
      }

      var isPermitted = false;
      for (var p = 0; p < permittedClasses.length; p++) {
        var pc = permittedClasses[p];
        if (typeof pc === "string" && cls.toLowerCase() === pc.toLowerCase()) {
          isPermitted = true;
          break;
        }
      }

      if (isPermitted) {
        permittedMatches.push(r);
      } else {
        disallowedMatches.push(r);
      }
    }

    // If records conflict or cannot be reliably evaluated:
    // e.g. malformed records present
    if (malformedMatches.length > 0) {
      return {
        hasPermitted: permittedMatches.length > 0,
        allDisallowed: false,
        isMissing: false,
        isConflictOrAmbiguous: true,
        reason: authorityName + " registration record contains a malformed or missing enlistmentClass.",
        bestRecord: null,
      };
    }

    if (permittedMatches.length > 0) {
      // Pick best permitted record (prefer independently verified)
      var verifiedRecord = null;
      for (var m = 0; m < permittedMatches.length; m++) {
        var pr = permittedMatches[m];
        if (pr.verificationStatus === "verified" && pr.isDemonstrationValue !== true) {
          verifiedRecord = pr;
          break;
        }
      }
      var best = verifiedRecord || permittedMatches[0];

      return {
        hasPermitted: true,
        allDisallowed: false,
        isMissing: false,
        isConflictOrAmbiguous: false,
        bestRecord: best,
      };
    }

    // No permitted matches and no malformed matches => all declared records are disallowed
    return {
      hasPermitted: false,
      allDisallowed: true,
      isMissing: false,
      isConflictOrAmbiguous: false,
      reason:
        "Explicitly declared disallowed class for " + authorityName + ": '" +
        disallowedMatches.map(function (d) { return d.enlistmentClass; }).join("', '") +
        "'. Permitted classes are: " + permittedClasses.join(", ") + ".",
      bestRecord: null,
    };
  }

  var dcweEval = evaluateAuthorityRegistrations(dcweRegistrations, permittedDcwe, "DCW&E Composite");
  var bimEval = evaluateAuthorityRegistrations(bimRegistrations, permittedBim, "DRDO-2024 BIM");

  // Check conflicts or ambiguity first
  if (dcweEval.isConflictOrAmbiguous) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: dcweEval.reason + " Records conflict or cannot be reliably evaluated.",
    };
  }
  if (bimEval.isConflictOrAmbiguous) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: bimEval.reason + " Records conflict or cannot be reliably evaluated.",
    };
  }

  // Check definitive disqualification: if either authority has ALL matching registrations in disallowed classes
  if (dcweEval.allDisallowed) {
    return {
      status: STATUS_FAIL,
      reason: dcweEval.reason,
    };
  }
  if (bimEval.allDisallowed) {
    return {
      status: STATUS_FAIL,
      reason: bimEval.reason,
    };
  }

  // Check missing evidence
  if (dcweEval.isMissing && bimEval.isMissing) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "Missing enlistment evidence: Neither DCW&E Composite nor DRDO-2024 BIM registrations are declared in profile.",
    };
  }
  if (dcweEval.isMissing) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "Missing enlistment evidence: DCW&E Composite registration not declared. Both DCW&E & DRDO-2024 BIM are stated with conjunction '&'.",
    };
  }
  if (bimEval.isMissing) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "Missing enlistment evidence: DRDO-2024 BIM registration not declared. Both DCW&E & DRDO-2024 BIM are stated with conjunction '&'.",
    };
  }

  // Both authorities have at least one permitted registration.
  // Check verification status.
  var dcweBest = dcweEval.bestRecord;
  var bimBest = bimEval.bestRecord;
  var dcweVerified = dcweBest.verificationStatus === "verified" && dcweBest.isDemonstrationValue !== true;
  var bimVerified = bimBest.verificationStatus === "verified" && bimBest.isDemonstrationValue !== true;

  if (dcweVerified && bimVerified) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason:
        "Independently verified matching classes: DCW&E Composite (" + dcweBest.enlistmentClass +
        ") & DRDO-2024 BIM (" + bimBest.enlistmentClass + "). However, NIT para 2(a) and Appendix C use the unresolved conjunction '&' between DCW&E Composite and DRDO-2024 BIM. Administrative clarification from the procuring authority is required on whether dual enlistment or alternative eligibility is intended.",
    };
  }

  return {
    status: STATUS_NEEDS_VERIFICATION,
    reason:
      "Matching self-declared classes: DCW&E Composite (" + dcweBest.enlistmentClass +
      ") & DRDO-2024 BIM (" + bimBest.enlistmentClass + ") are within permitted classes. " +
      "However: (1) Records are self-declared and require independent verification. " +
      "(2) The conjunction '&' in NIT para 2(a) and Appendix C requires administrative clarification from the procuring authority.",
  };
}

// ---------------------------------------------------------------------------
// Criterion B — Similar Completed Term Contract Works
// ---------------------------------------------------------------------------

/**
 * Check if the work relates to day-to-day maintenance services.
 * Checks explicit negative statements before positive keyword matches.
 * Does not treat "artificer", "term maintenance", or generic "maintenance" alone as proof.
 * Return true only when the description explicitly establishes day-to-day or routine maintenance.
 * Ambiguous descriptions return null (Needs Verification).
 */
function isDayToDayMaintenanceWork(work) {
  var combined = [
    work.workTitle,
    work.workDescription,
    work.workCategory,
    work.declaredSimilarWork,
  ].filter(function (x) { return typeof x === "string" && x.trim().length > 0; }).join(" ").toLowerCase();

  if (!combined || combined.trim().length === 0) {
    return null; // Missing description -> ambiguous -> Needs Verification
  }

  // 1. Check explicit negative statements FIRST before positive keyword matches
  if (
    combined.indexOf("no maintenance") !== -1 ||
    combined.indexOf("excluding maintenance") !== -1 ||
    combined.indexOf("without maintenance") !== -1 ||
    combined.indexOf("non-maintenance") !== -1 ||
    combined.indexOf("not maintenance") !== -1
  ) {
    return false; // Explicitly disqualified
  }

  // 2. Return true ONLY when the description explicitly establishes day-to-day or routine maintenance services
  if (
    combined.indexOf("day-to-day") !== -1 ||
    combined.indexOf("day to day") !== -1 ||
    combined.indexOf("routine maintenance") !== -1 ||
    combined.indexOf("routine repair") !== -1 ||
    combined.indexOf("daily maintenance") !== -1
  ) {
    return true; // Relevant
  }

  // Generic maintenance or phrases like "artificer" / "term maintenance" alone do not establish day-to-day maintenance
  return null;
}

/**
 * Evaluate work performance.
 *
 * Rules:
 * - A project must have BOTH:
 *   1. Explicit poor/unsatisfactory performance evidence.
 *   2. Explicit evidence that compensation for delay was actually levied, imposed, or recovered.
 * - hasCompensationForDelay === true alone must not disqualify.
 * - compensationForDelayLevied === true alone must not disqualify.
 * - A text mention of "delay" alone must not disqualify.
 * - Phrases like "compensation for delay levied" alone without poor performance context must not disqualify.
 * - Return hasPoorPerformance: true only when both conditions are established.
 */
/**
 * Evaluate work performance.
 *
 * Rules:
 * - A project must have definitive evidence that poor/unsatisfactory performance AND
 *   actual compensation for delay or liquidated damages refer to the same work and
 *   the same performance incident.
 * - Do not combine unrelated keyword matches into a definitive poor-performance finding.
 * - If the relationship between the two facts is ambiguous, return a non-disqualifying
 *   Needs Verification result (hasPoorPerformance: false, isAmbiguous: true).
 * - A levy alone does NOT disqualify.
 * - Poor-performance evidence alone does NOT disqualify.
 * - Return hasPoorPerformance: true ONLY when both conditions are established for the same incident.
 */
function evaluateWorkPerformance(work) {
  var hasExplicitPoorPerformanceEvidence = false;
  var hasExplicitLevyEvidence = false;
  var isSameIncidentEstablished = false;
  var isAmbiguousRelationship = false;

  // 1. Structured property checks
  if (
    work.hasPoorPerformance === true ||
    work.performanceStatus === "poor" ||
    work.performanceStatus === "unsatisfactory"
  ) {
    hasExplicitPoorPerformanceEvidence = true;
  }

  if (work.compensationForDelayLevied === true) {
    hasExplicitLevyEvidence = true;
  }

  // If structured flags explicitly link compensation to poor performance on this work
  if (
    hasExplicitPoorPerformanceEvidence &&
    hasExplicitLevyEvidence &&
    (work.compensationLinkedToPoorPerformance === true || work.sameIncidentConfirmed === true)
  ) {
    isSameIncidentEstablished = true;
  }

  // 2. Textual workPerformance evaluation
  if (typeof work.workPerformance === "string") {
    var wp = work.workPerformance.toLowerCase().trim();

    var isNegated =
      wp.indexOf("zero penalties") !== -1 ||
      wp.indexOf("no penalty") !== -1 ||
      wp.indexOf("no penalties") !== -1 ||
      wp.indexOf("without penalty") !== -1 ||
      wp.indexOf("without penalties") !== -1 ||
      wp.indexOf("no compensation") !== -1 ||
      wp.indexOf("zero compensation") !== -1 ||
      wp.indexOf("no liquidated damages") !== -1 ||
      wp.indexOf("without liquidated damages") !== -1;

    if (!isNegated) {
      // Coherent phrases where poor performance AND actual levy refer to the same incident
      var mentionsCoherentSameIncident =
        wp.indexOf("compensation for delay levied due to poor performance") !== -1 ||
        wp.indexOf("compensation for delay levied due to unsatisfactory performance") !== -1 ||
        wp.indexOf("compensation for delay was levied due to poor performance") !== -1 ||
        wp.indexOf("compensation for delay was levied due to unsatisfactory performance") !== -1 ||
        wp.indexOf("unsatisfactory performance and compensation for delay levied") !== -1 ||
        wp.indexOf("unsatisfactory performance and compensation for delay was levied") !== -1 ||
        wp.indexOf("unsatisfactory performance with compensation for delay levied") !== -1 ||
        wp.indexOf("poor performance and compensation for delay levied") !== -1 ||
        wp.indexOf("poor performance and compensation for delay was levied") !== -1 ||
        wp.indexOf("poor performance with compensation for delay levied") !== -1 ||
        wp.indexOf("liquidated damages levied due to poor performance") !== -1 ||
        wp.indexOf("liquidated damages levied due to unsatisfactory performance") !== -1 ||
        wp.indexOf("liquidated damages was levied due to poor performance") !== -1 ||
        wp.indexOf("liquidated damages was levied due to unsatisfactory performance") !== -1 ||
        wp.indexOf("unsatisfactory performance and liquidated damages levied") !== -1 ||
        wp.indexOf("poor performance and liquidated damages levied") !== -1 ||
        wp.indexOf("poor performance resulted in compensation for delay levied") !== -1 ||
        wp.indexOf("unsatisfactory performance resulted in compensation for delay levied") !== -1;

      if (mentionsCoherentSameIncident) {
        hasExplicitPoorPerformanceEvidence = true;
        hasExplicitLevyEvidence = true;
        isSameIncidentEstablished = true;
      } else {
        // Check for isolated levy phrases
        var mentionsLevy =
          wp.indexOf("compensation for delay levied") !== -1 ||
          wp.indexOf("compensation for delay was levied") !== -1 ||
          wp.indexOf("compensation for delay imposed") !== -1 ||
          wp.indexOf("compensation for delay was imposed") !== -1 ||
          wp.indexOf("compensation for delay recovered") !== -1 ||
          wp.indexOf("compensation for delay was recovered") !== -1 ||
          wp.indexOf("penalty for delay levied") !== -1 ||
          wp.indexOf("penalties for delay levied") !== -1 ||
          wp.indexOf("liquidated damages levied") !== -1 ||
          wp.indexOf("liquidated damages was levied") !== -1 ||
          wp.indexOf("liquidated damages imposed") !== -1 ||
          wp.indexOf("liquidated damages was imposed") !== -1 ||
          wp.indexOf("liquidated damages recovered") !== -1;

        if (mentionsLevy) {
          hasExplicitLevyEvidence = true;
        }

        // Check for isolated poor / unsatisfactory performance phrases
        var mentionsPoor =
          wp.indexOf("poor performance") !== -1 ||
          wp.indexOf("unsatisfactory performance") !== -1 ||
          wp.indexOf("performance was poor") !== -1 ||
          wp.indexOf("performance was unsatisfactory") !== -1 ||
          wp.indexOf("unsatisfactory work") !== -1 ||
          wp.indexOf("adverse performance") !== -1;

        if (mentionsPoor) {
          hasExplicitPoorPerformanceEvidence = true;
        }

        // If both are found in the text or structured data but NOT coherently linked to the same incident:
        if (hasExplicitPoorPerformanceEvidence && hasExplicitLevyEvidence && !isSameIncidentEstablished) {
          isAmbiguousRelationship = true;
        }
      }
    }
  } else if (hasExplicitPoorPerformanceEvidence && hasExplicitLevyEvidence && !isSameIncidentEstablished) {
    // Both structured flags are present, but no evidence confirms they refer to the same incident
    isAmbiguousRelationship = true;
  }

  // Definitive disqualification: both conditions established for the same incident
  if (hasExplicitPoorPerformanceEvidence && hasExplicitLevyEvidence && isSameIncidentEstablished) {
    return {
      hasPoorPerformance: true,
      isAmbiguous: false,
      reason: "Explicit poor performance established in conjunction with compensation for delay actually levied for the same performance incident.",
    };
  }

  // Ambiguous relationship: do NOT combine unrelated matches into definitive failure; return non-disqualifying Needs Verification
  if (isAmbiguousRelationship) {
    return {
      hasPoorPerformance: false,
      isAmbiguous: true,
      reason: "Relationship between reported performance and compensation/liquidated damages is ambiguous (unconfirmed whether they refer to the same incident). Needs verification.",
    };
  }

  // Isolated levy or isolated poor performance or neither: does not fail
  if (work.workPerformance) {
    return { hasPoorPerformance: false, isAmbiguous: false, isDeclared: true };
  }
  return { hasPoorPerformance: false, isAmbiguous: false, isMissing: true };
}

/**
 * Evaluate project completion status.
 * - Explicitly detects "not completed" and other incomplete states before accepting completed status.
 * - A completion date alone does NOT establish independently verified completion.
 * - Missing or ambiguous completion status remains Needs Verification.
 * - Requires actual verified completion evidence before counting toward a passing route.
 */
function evaluateCompletionStatus(work) {
  if (work.isCompleted === false) {
    return {
      isExplicitlyIncomplete: true,
      isCompleted: false,
      reason: "Work is marked as not completed (isCompleted: false).",
    };
  }

  var isCompletedDeclared = false;
  var declaredReason = "";

  if (typeof work.completionStatus === "string") {
    var cs = work.completionStatus.toLowerCase().trim();

    // Explicitly detect incomplete states FIRST before accepting completed status
    if (
      cs.indexOf("not completed") !== -1 ||
      cs.indexOf("incomplete") !== -1 ||
      cs.indexOf("in progress") !== -1 ||
      cs.indexOf("in-progress") !== -1 ||
      cs.indexOf("ongoing") !== -1 ||
      cs.indexOf("terminated") !== -1 ||
      cs.indexOf("abandoned") !== -1 ||
      cs.indexOf("uncompleted") !== -1
    ) {
      return {
        isExplicitlyIncomplete: true,
        isCompleted: false,
        reason: "Work is explicitly incomplete or ongoing ('" + work.completionStatus + "').",
      };
    }

    if (
      cs === "completed" ||
      cs.indexOf("satisfactorily completed") !== -1 ||
      cs.indexOf("completed within") !== -1 ||
      cs.indexOf("completed on") !== -1 ||
      cs.indexOf("work completed") !== -1 ||
      cs.indexOf("successfully completed") !== -1
    ) {
      isCompletedDeclared = true;
      declaredReason = work.completionStatus;
    }
  }

  // A completion date alone must NOT establish completion if status is missing or ambiguous
  if (!isCompletedDeclared) {
    return {
      isExplicitlyIncomplete: false,
      isCompleted: false,
      isMissing: true,
      reason: "Completion status is missing or ambiguous. A completion date alone does not establish completion.",
    };
  }

  // Check actual verified completion evidence
  // Requires: verificationStatus === "verified", isDemonstrationValue !== true,
  // and certificateDetails.actualCertificateDataAvailable === true.
  // The standalone work.completionVerified === true condition is removed.
  var cert = work.certificateDetails;
  var hasCertEvidence = Boolean(
    cert &&
    typeof cert === "object" &&
    cert.actualCertificateDataAvailable === true
  );

  var hasVerifiedEvidence =
    work.verificationStatus === "verified" &&
    work.isDemonstrationValue !== true &&
    hasCertEvidence;

  return {
    isExplicitlyIncomplete: false,
    isCompleted: true,
    isVerified: hasVerifiedEvidence,
    reason: declaredReason || "Completed",
  };
}

/**
 * Derives a reliable explicit project identifier for deduplication.
 * Does not merge distinct projects solely because title, client, and completion date match.
 * When no reliable identifier exists, does not invent an identity or silently merge records.
 */
function getProjectIdentifier(work, index) {
  if (work.workId && typeof work.workId === "string" && work.workId.trim()) {
    return { id: "id:" + work.workId.trim(), hasExplicitIdentifier: true };
  }
  if (work.id && typeof work.id === "string" && work.id.trim()) {
    return { id: "id:" + work.id.trim(), hasExplicitIdentifier: true };
  }
  if (work.contractNumber && typeof work.contractNumber === "string" && work.contractNumber.trim()) {
    return { id: "contract:" + work.contractNumber.trim(), hasExplicitIdentifier: true };
  }
  if (work.workOrderNumber && typeof work.workOrderNumber === "string" && work.workOrderNumber.trim()) {
    return { id: "order:" + work.workOrderNumber.trim(), hasExplicitIdentifier: true };
  }
  if (work.referenceNumber && typeof work.referenceNumber === "string" && work.referenceNumber.trim()) {
    return { id: "ref:" + work.referenceNumber.trim(), hasExplicitIdentifier: true };
  }

  // No reliable explicit identifier: do NOT invent an identity that silently merges records!
  return { id: "unidentified_" + index, hasExplicitIdentifier: false };
}

/**
 * Evaluate a single work for similarity.
 *
 * Rules:
 * - termContract === false and coveredByCPWDDSR === false disqualify a work.
 * - Accept only actual Boolean values: true means declared satisfied; false means explicitly failed;
 *   any other value means Needs Verification.
 * - Reject non-finite altitude values.
 * - Missing or unverified values return Needs Verification, NOT disqualification.
 * - Altitude must be strictly > 6500 ft MSL.
 */
function evaluateSingleWork(work, lookbackWindow, escalationCutoff, index) {
  var pIdent = getProjectIdentifier(work, index);
  var projectId = pIdent.id;
  var hasExplicitIdentifier = pIdent.hasExplicitIdentifier;

  // 1. Performance check (compensation for delay in context of poor performance)
  var perf = evaluateWorkPerformance(work);
  if (perf.hasPoorPerformance) {
    return {
      projectId: projectId,
      hasExplicitIdentifier: hasExplicitIdentifier,
      isDisqualified: true,
      hasExplicitPoorPerformance: true,
      reason: perf.reason,
      adjustedValue: null,
      isFullyVerified: false,
      canPotentiallyQualify: false,
    };
  }
  var isPerfAmbiguous = perf.isAmbiguous === true;

  // 2. Term contract check: accept ONLY actual Boolean values
  var isTermContractMissing = false;
  if (typeof work.termContract !== "boolean") {
    isTermContractMissing = true;
  } else if (work.termContract === false) {
    return {
      projectId: projectId,
      hasExplicitIdentifier: hasExplicitIdentifier,
      isDisqualified: true,
      hasExplicitPoorPerformance: false,
      reason: "Work is explicitly not a term contract (termContract: false).",
      adjustedValue: null,
      isFullyVerified: false,
      canPotentiallyQualify: false,
    };
  }

  // 3. High altitude check: strictly > 6500 ft MSL; reject non-finite values
  var isAltitudeMissing = false;
  if (typeof work.altitudeInFeet !== "number" || !Number.isFinite(work.altitudeInFeet)) {
    isAltitudeMissing = true;
  } else if (work.altitudeInFeet <= 6500) {
    return {
      projectId: projectId,
      hasExplicitIdentifier: hasExplicitIdentifier,
      isDisqualified: true,
      hasExplicitPoorPerformance: false,
      reason: "Work altitude (" + work.altitudeInFeet + " ft MSL) is not strictly above 6,500 ft MSL.",
      adjustedValue: null,
      isFullyVerified: false,
      canPotentiallyQualify: false,
    };
  }

  // 4. CPWD DSR coverage check: accept ONLY actual Boolean values
  var isCpwdDsrMissing = false;
  if (typeof work.coveredByCPWDDSR !== "boolean") {
    isCpwdDsrMissing = true;
  } else if (work.coveredByCPWDDSR === false) {
    return {
      projectId: projectId,
      hasExplicitIdentifier: hasExplicitIdentifier,
      isDisqualified: true,
      hasExplicitPoorPerformance: false,
      reason: "Work is explicitly not covered under CPWD DSR (coveredByCPWDDSR: false).",
      adjustedValue: null,
      isFullyVerified: false,
      canPotentiallyQualify: false,
    };
  }

  // 5. Completion status check: explicitly incomplete disqualifies; missing requires verification
  var compStatus = evaluateCompletionStatus(work);
  if (compStatus.isExplicitlyIncomplete) {
    return {
      projectId: projectId,
      hasExplicitIdentifier: hasExplicitIdentifier,
      isDisqualified: true,
      hasExplicitPoorPerformance: false,
      reason: compStatus.reason,
      adjustedValue: null,
      isFullyVerified: false,
      canPotentiallyQualify: false,
    };
  }
  var isCompletionMissing = !compStatus.isCompleted || compStatus.isMissing === true;

  // 6. Lookback window check (strict UTC boundaries)
  var compDate = parseDate(work.completionDate);
  var isLookbackMissing = !compDate;
  if (compDate && lookbackWindow) {
    if (compDate.getTime() < lookbackWindow.start.getTime() || compDate.getTime() > lookbackWindow.end.getTime()) {
      return {
        projectId: projectId,
        hasExplicitIdentifier: hasExplicitIdentifier,
        isDisqualified: true,
        hasExplicitPoorPerformance: false,
        reason:
          "Work completion date (" + work.completionDate +
          ") is outside the seven-year lookback window (" +
          lookbackWindow.start.toISOString().slice(0, 10) + " to " +
          lookbackWindow.end.toISOString().slice(0, 10) + ").",
        adjustedValue: null,
        isFullyVerified: false,
        canPotentiallyQualify: false,
      };
    }
  }

  // 7. Day-to-day maintenance relevance: explicitly negative disqualifies; ambiguous requires verification
  var maint = isDayToDayMaintenanceWork(work);
  if (maint === false) {
    return {
      projectId: projectId,
      hasExplicitIdentifier: hasExplicitIdentifier,
      isDisqualified: true,
      hasExplicitPoorPerformance: false,
      reason: "Work description explicitly excludes day-to-day maintenance services.",
      adjustedValue: null,
      isFullyVerified: false,
      canPotentiallyQualify: false,
    };
  }
  var isMaintAmbiguous = maint === null;

  // 8. Value check (actual gross payments - NOT originalContractPeriodValue)
  var actualPayments = work.actualGrossPaymentsOriginalPeriod;
  var isPaymentMissing = actualPayments === null || actualPayments === undefined;
  var isPaymentInvalid = !isPaymentMissing && (typeof actualPayments !== "number" || !Number.isFinite(actualPayments) || actualPayments < 0);

  if (isPaymentInvalid) {
    return {
      projectId: projectId,
      hasExplicitIdentifier: hasExplicitIdentifier,
      isDisqualified: false,
      hasExplicitPoorPerformance: false,
      reason: "Actual gross payments value is invalid (" + actualPayments + "). Needs verification.",
      adjustedValue: null,
      isFullyVerified: false,
      canPotentiallyQualify: true,
    };
  }

  // 9. Calculate 7% simple rate adjustment if actual payments and date are available
  var adjustedValue = null;
  if (!isPaymentMissing && compDate && escalationCutoff) {
    adjustedValue = applySimpleRateEscalation(actualPayments, compDate, escalationCutoff);
  }

  var recordedValue = null;
  if (typeof adjustedValue === "number" && Number.isFinite(adjustedValue)) {
    recordedValue = adjustedValue;
  } else if (typeof actualPayments === "number" && Number.isFinite(actualPayments)) {
    recordedValue = actualPayments;
  } else if (typeof work.actualGrossPayment === "number" && Number.isFinite(work.actualGrossPayment)) {
    recordedValue = work.actualGrossPayment;
  } else if (typeof work.contractValue === "number" && Number.isFinite(work.contractValue)) {
    recordedValue = work.contractValue;
  } else if (typeof work.originalContractPeriodValue === "number" && Number.isFinite(work.originalContractPeriodValue)) {
    recordedValue = work.originalContractPeriodValue;
  }

  // 10. Verification status & certificate
  var cert = work.certificateDetails;
  var hasCertDurationAndValue =
    cert &&
    cert.declared &&
    cert.declared.statesWorkDuration === true &&
    cert.declared.statesWorkValue === true;

  var hasAnyMissingSimilarityInfo =
    isPerfAmbiguous ||
    isTermContractMissing ||
    isAltitudeMissing ||
    isCpwdDsrMissing ||
    isCompletionMissing ||
    isLookbackMissing ||
    isMaintAmbiguous ||
    isPaymentMissing ||
    adjustedValue === null;

  var isVerified =
    !hasAnyMissingSimilarityInfo &&
    compStatus.isVerified === true &&
    work.verificationStatus === "verified" &&
    work.isDemonstrationValue !== true &&
    cert &&
    cert.actualCertificateDataAvailable === true;

  if (isVerified && hasCertDurationAndValue) {
    return {
      projectId: projectId,
      hasExplicitIdentifier: hasExplicitIdentifier,
      isDisqualified: false,
      hasExplicitPoorPerformance: false,
      reason:
        "Verified qualifying work. Adjusted value (7% simple rate to cutoff): ₹" +
        Math.round(adjustedValue).toLocaleString("en-IN") + ".",
      adjustedValue: adjustedValue,
      recordedValue: recordedValue,
      isFullyVerified: true,
      canPotentiallyQualify: true,
    };
  }

  var pendingItems = [];
  if (isPerfAmbiguous) pendingItems.push("clarification of ambiguous performance/compensation relationship");
  if (isTermContractMissing) pendingItems.push("term contract boolean status");
  if (isAltitudeMissing) pendingItems.push("finite altitude");
  if (isCpwdDsrMissing) pendingItems.push("CPWD DSR coverage boolean status");
  if (isCompletionMissing) pendingItems.push("verified completion evidence");
  if (isLookbackMissing) pendingItems.push("completion date");
  if (isMaintAmbiguous) pendingItems.push("day-to-day routine maintenance scope");
  if (isPaymentMissing) pendingItems.push("actual gross payments");
  if (adjustedValue !== null) {
    pendingItems.push("independent verification of 7%-adjusted value (₹" + Math.round(adjustedValue).toLocaleString("en-IN") + ")");
  }

  return {
    projectId: projectId,
    hasExplicitIdentifier: hasExplicitIdentifier,
    isDisqualified: false,
    hasExplicitPoorPerformance: false,
    reason:
      "Passes structural conditions, pending verification of: " + pendingItems.join(", ") + ".",
    adjustedValue: adjustedValue,
    recordedValue: recordedValue,
    isFullyVerified: false,
    canPotentiallyQualify: true,
  };
}

/**
 * Check the similar completed term contract works criterion across three alternative routes.
 *
 * Routes:
 *   Route 1 (80%): 1 work  ≥ ₹27,02,857
 *   Route 2 (50%): 2 works ≥ ₹16,89,286 each
 *   Route 3 (40%): 3 works ≥ ₹13,51,428 each
 *
 * Deduplication:
 * - Uses reliable explicit identifiers for deduplication.
 * - Does not merge distinct projects solely because title, client, and completion date match.
 * - When no reliable identifier exists, does not invent an identity or silently merge records.
 */
function checkSimilarWork(similarWorkCriterion, completedWorks, publicationDateStr) {
  if (!similarWorkCriterion || !similarWorkCriterion.expectedValue) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "Similar work criterion data missing from tender record.",
    };
  }

  // Lookback configuration check: if publication date or lookback window is invalid, return Needs Verification
  var lookbackWindow = getSevenYearLookbackWindow(publicationDateStr);
  if (!lookbackWindow) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason:
        "Tender publication date ('" + publicationDateStr +
        "') is missing or invalid; seven-year lookback window cannot be established. Works cannot pass without a valid lookback window.",
    };
  }

  var ev = similarWorkCriterion.expectedValue;
  var thresholds = Array.isArray(ev.qualifyingThresholds) ? ev.qualifyingThresholds : [];
  var t80 = null;
  var t50 = null;
  var t40 = null;

  for (var t = 0; t < thresholds.length; t++) {
    var item = thresholds[t];
    if (item && item.count === 1) t80 = item.minWorkValue;
    else if (item && item.count === 2) t50 = item.minWorkValue;
    else if (item && item.count === 3) t40 = item.minWorkValue;
  }

  // Validate threshold values: each must be a finite, non-negative number
  var isT80Valid = typeof t80 === "number" && Number.isFinite(t80) && t80 >= 0;
  var isT50Valid = typeof t50 === "number" && Number.isFinite(t50) && t50 >= 0;
  var isT40Valid = typeof t40 === "number" && Number.isFinite(t40) && t40 >= 0;

  if (!isT80Valid || !isT50Valid || !isT40Valid) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason:
        "Tender similar-work qualifying thresholds (t80, t50, t40) are invalid or missing from criteria. Malformed threshold configuration returns Needs Verification.",
    };
  }

  var escalationCutoff = parseDate(ev.escalationCutoffDate) || parseDate("2026-11-27");

  if (!Array.isArray(completedWorks) || completedWorks.length === 0) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "No completed works found in company profile.",
    };
  }

  var evaluatedWorks = [];
  var hasAnyPoorPerformance = false;
  var poorPerformanceReason = "";

  for (var i = 0; i < completedWorks.length; i++) {
    var work = completedWorks[i];
    var evalRes = evaluateSingleWork(work, lookbackWindow, escalationCutoff, i);
    evalRes.workTitle = work.workTitle || ("Work " + (i + 1));
    evaluatedWorks.push(evalRes);

    if (evalRes.hasExplicitPoorPerformance) {
      hasAnyPoorPerformance = true;
      poorPerformanceReason = evalRes.reason;
    }
  }

  // 1. Explicit poor performance involving compensation for delay fails the criterion immediately
  if (hasAnyPoorPerformance) {
    return {
      status: STATUS_FAIL,
      reason:
        "Criterion failed: Explicit poor performance involving compensation for delay was established. " +
        poorPerformanceReason,
    };
  }

  // 2. Separate into disqualified vs viable works
  var viableWorks = [];
  var disqualifiedWorks = [];

  for (var j = 0; j < evaluatedWorks.length; j++) {
    var ew = evaluatedWorks[j];
    if (ew.isDisqualified) {
      disqualifiedWorks.push(ew);
    } else {
      viableWorks.push(ew);
    }
  }

  // If no works survived disqualification:
  if (viableWorks.length === 0) {
    var disqReasons = disqualifiedWorks.map(function (d) {
      return '"' + d.workTitle + '": ' + d.reason;
    }).join(" | ");
    return {
      status: STATUS_FAIL,
      reason:
        "None of the declared works satisfy the mandatory similarity conditions. " +
        disqReasons,
    };
  }

  // 3. Deduplicate viable works ONLY when reliable explicit identifiers match
  var uniqueViableMap = {};
  var uniqueViableWorks = [];
  var hasUnidentifiedProjects = false;

  for (var k = 0; k < viableWorks.length; k++) {
    var vWork = viableWorks[k];
    if (vWork.hasExplicitIdentifier) {
      var pId = vWork.projectId;
      if (!uniqueViableMap[pId]) {
        uniqueViableMap[pId] = vWork;
        uniqueViableWorks.push(vWork);
      } else {
        var existing = uniqueViableMap[pId];
        if (!existing.isFullyVerified && vWork.isFullyVerified) {
          uniqueViableMap[pId] = vWork;
          var idx = uniqueViableWorks.indexOf(existing);
          if (idx !== -1) uniqueViableWorks[idx] = vWork;
        }
      }
    } else {
      // Work lacks an explicit reliable identifier: do not silently merge!
      hasUnidentifiedProjects = true;
      uniqueViableWorks.push(vWork);
    }
  }

  // 4. Check verified passing works against the 3 routes
  var verifiedWorks = uniqueViableWorks.filter(function (w) {
    return w.isFullyVerified && typeof w.adjustedValue === "number";
  });

  var verifiedWorksMeeting80 = verifiedWorks.filter(function (w) { return w.adjustedValue >= t80; });
  var verifiedWorksMeeting50 = verifiedWorks.filter(function (w) { return w.adjustedValue >= t50; });
  var verifiedWorksMeeting40 = verifiedWorks.filter(function (w) { return w.adjustedValue >= t40; });

  var route1Verified = verifiedWorksMeeting80.length >= 1;
  var route2Verified = verifiedWorksMeeting50.length >= 2;
  var route3Verified = verifiedWorksMeeting40.length >= 3;

  if (route1Verified || route2Verified || route3Verified) {
    var satisfiedRoute = route1Verified
      ? "Route 1 (one qualifying work ≥ ₹" + t80.toLocaleString("en-IN") + ")"
      : route2Verified
      ? "Route 2 (two qualifying works each ≥ ₹" + t50.toLocaleString("en-IN") + ")"
      : "Route 3 (three qualifying works each ≥ ₹" + t40.toLocaleString("en-IN") + ")";

    return {
      status: STATUS_PASS,
      reason:
        "Satisfies similar work requirement via verified " + satisfiedRoute + ".",
    };
  }

  // 5. Check if all distinct viable works are fully verified, but none reached required thresholds
  var allViableAreVerified = uniqueViableWorks.every(function (w) { return w.isFullyVerified; });

  if (allViableAreVerified) {
    return {
      status: STATUS_FAIL,
      reason:
        "Verified works do not meet any qualifying threshold route: " +
        "Route 1 (≥ ₹" + t80.toLocaleString("en-IN") + "): " + verifiedWorksMeeting80.length + " distinct work(s); " +
        "Route 2 (2 works ≥ ₹" + t50.toLocaleString("en-IN") + "): " + verifiedWorksMeeting50.length + " distinct work(s); " +
        "Route 3 (3 works ≥ ₹" + t40.toLocaleString("en-IN") + "): " + verifiedWorksMeeting40.length + " distinct work(s).",
    };
  }

  // 6. Unverified viable works remain that could satisfy at least one route
  var totalViableDistinct = uniqueViableWorks.length;
  var viableReasons = uniqueViableWorks.map(function (w) {
    return '"' + w.workTitle + '": ' + w.reason;
  }).join(" | ");

  var noteOnDisqualified = "";
  if (disqualifiedWorks.length > 0) {
    noteOnDisqualified =
      " (Note: " + disqualifiedWorks.length + " work(s) did not qualify individually, but other viable works remain).";
  }

  var noteOnIdentifiers = "";
  if (hasUnidentifiedProjects) {
    noteOnIdentifiers =
      " (Note: Project records without reliable explicit contract/work identifiers were not silently merged, but require verification of contract numbers).";
  }

  // Evaluate candidate works against numerical thresholds
  var worksMeeting80 = uniqueViableWorks.filter(function (w) {
    var v = typeof w.adjustedValue === "number" ? w.adjustedValue : (typeof w.recordedValue === "number" ? w.recordedValue : null);
    return v !== null && v >= t80;
  });
  var worksMeeting50 = uniqueViableWorks.filter(function (w) {
    var v = typeof w.adjustedValue === "number" ? w.adjustedValue : (typeof w.recordedValue === "number" ? w.recordedValue : null);
    return v !== null && v >= t50;
  });
  var worksMeeting40 = uniqueViableWorks.filter(function (w) {
    var v = typeof w.adjustedValue === "number" ? w.adjustedValue : (typeof w.recordedValue === "number" ? w.recordedValue : null);
    return v !== null && v >= t40;
  });

  var potentiallySatisfiedRoutes = [];
  if (worksMeeting80.length >= 1) {
    potentiallySatisfiedRoutes.push("Route 1 (1 work ≥ ₹" + t80.toLocaleString("en-IN") + ")");
  }
  if (worksMeeting50.length >= 2) {
    potentiallySatisfiedRoutes.push("Route 2 (2 works ≥ ₹" + t50.toLocaleString("en-IN") + " each)");
  }
  if (worksMeeting40.length >= 3) {
    potentiallySatisfiedRoutes.push("Route 3 (3 works ≥ ₹" + t40.toLocaleString("en-IN") + " each)");
  }

  var tenderRoutesText =
    "Tender qualification routes: Route 1 (1 work ≥ ₹" +
    t80.toLocaleString("en-IN") +
    "), Route 2 (2 works ≥ ₹" +
    t50.toLocaleString("en-IN") +
    " each), Route 3 (3 works ≥ ₹" +
    t40.toLocaleString("en-IN") +
    " each).";

  var workEvalText = "";
  if (potentiallySatisfiedRoutes.length > 0) {
    workEvalText =
      "Company work evaluation: Recorded work values potentially satisfy " +
      potentiallySatisfiedRoutes.join(", ") +
      ".";
  } else {
    workEvalText =
      "Company work evaluation: No recorded work currently meets the numerical threshold.";
  }

  return {
    status: STATUS_NEEDS_VERIFICATION,
    reason:
      "Similar work evaluation requires verification of actual gross payments and completion certificates for " +
      totalViableDistinct +
      " viable work(s): " +
      viableReasons +
      noteOnDisqualified +
      noteOnIdentifiers +
      " " +
      tenderRoutesText +
      " " +
      workEvalText +
      " Final qualification cannot be determined until actual gross payment certificates and completion evidence are verified.",
  };
}

// ---------------------------------------------------------------------------
// Criterion C — Annual Turnover
// ---------------------------------------------------------------------------

/**
 * Check average annual turnover over the tender's specified three financial years.
 *
 * Rules:
 * - Validate yearsRequired and minAverage before calculations (positive integer, non-negative).
 * - Validate selected financial-year records (YYYY-YYYY format, consecutive, distinct).
 * - Require explicit non-empty UDIN string in rec.udin or rec.caUdin (Boolean flags do not count).
 * - Require rec.verificationStatus === "verified" and rec.isDemonstrationValue !== true.
 * - Require explicit statutory auditor/CA certification evidence.
 * - Require rec.adjustedTurnoverBasisDocumented === true.
 * - Require a finite, non-negative rec.adjustedAnnualTurnover.
 * - Do not invent an adjustment formula.
 */
function checkAnnualTurnover(turnoverCriterion, financialRecords) {
  if (!turnoverCriterion || !turnoverCriterion.expectedValue) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "Turnover criterion data missing from tender record.",
    };
  }

  var ev = turnoverCriterion.expectedValue;
  var minAverage = ev.minAverageTurnover;
  var yearsRequired = ev.yearsConsidered;

  // Validate yearsRequired and minAverage before calculations
  var isYearsReqValid = typeof yearsRequired === "number" && Number.isInteger(yearsRequired) && yearsRequired > 0;
  var isMinAvgValid = typeof minAverage === "number" && Number.isFinite(minAverage) && minAverage >= 0;

  if (!isYearsReqValid || !isMinAvgValid) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "Invalid turnover criteria configuration (yearsRequired or minAverage invalid). Verification required.",
    };
  }

  // Validate financial-year records (YYYY-YYYY format, consecutive, distinct)
  var valResult = validateFinancialYears(financialRecords, yearsRequired);
  if (!valResult.valid) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "Financial records validation failed: " + valResult.reason,
    };
  }

  var selected = valResult.selected;
  var total = 0;
  var yearLabels = [];
  var anyMissingOrInvalid = false;
  var allHaveAuditorUdin = true;
  var hasDocumentedAdjustedTurnover = true;
  var hasInvalidAdjustedTurnover = false;

  for (var i = 0; i < selected.length; i++) {
    var item = selected[i];
    var rec = item.record;
    yearLabels.push(item.financialYear);

    // Finite positive number check for annualTurnover
    if (typeof rec.annualTurnover !== "number" || !Number.isFinite(rec.annualTurnover) || rec.annualTurnover < 0) {
      anyMissingOrInvalid = true;
    } else {
      total += rec.annualTurnover;
    }

    // Explicit non-empty UDIN string required in rec.udin or rec.caUdin. Boolean flags do not count.
    var hasUdinString =
      (typeof rec.udin === "string" && rec.udin.trim().length > 0) ||
      (typeof rec.caUdin === "string" && rec.caUdin.trim().length > 0);

    // Explicit statutory auditor/CA certification evidence
    var hasCertificationEvidence =
      rec.statutoryAuditorCertified === true ||
      rec.caCertified === true ||
      rec.auditorCertified === true ||
      rec.isCaCertified === true ||
      rec.statutoryAuditorCertification === true ||
      rec.caCertifiedWithUdin === true;

    var isIndependentlyVerified =
      rec.verificationStatus === "verified" &&
      rec.isDemonstrationValue !== true &&
      hasUdinString &&
      hasCertificationEvidence;

    if (!isIndependentlyVerified) {
      allHaveAuditorUdin = false;
    }

    // Check adjustedAnnualTurnover
    if (!rec.adjustedTurnoverBasisDocumented || typeof rec.adjustedAnnualTurnover !== "number") {
      hasDocumentedAdjustedTurnover = false;
    } else {
      // Reject non-finite and negative adjusted turnover values
      if (!Number.isFinite(rec.adjustedAnnualTurnover) || rec.adjustedAnnualTurnover < 0) {
        hasInvalidAdjustedTurnover = true;
      }
    }
  }

  if (anyMissingOrInvalid) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason:
        "Annual turnover values are missing, non-finite, or invalid in the required " +
        yearsRequired + " financial years (" + yearLabels.join(", ") + ").",
    };
  }

  if (hasInvalidAdjustedTurnover) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason:
        "Adjusted annual turnover contains non-finite (e.g. Infinity) or negative values. Invalid adjustment figures rejected.",
    };
  }

  var average = total / yearsRequired;
  var yearsStr = yearLabels.join(", ");
  var minFormatted = "₹" + minAverage.toLocaleString("en-IN");

  // Require explicit statutory auditor certification with UDIN string and independently verified adjusted figures
  if (!allHaveAuditorUdin || !hasDocumentedAdjustedTurnover) {
    var unadjustedStatusNote = average >= minAverage
      ? "Unadjusted average annual turnover (₹" + Math.round(average).toLocaleString("en-IN") +
        ") meets the numerical threshold before adjustment"
      : "Unadjusted average annual turnover (₹" + Math.round(average).toLocaleString("en-IN") +
        ") is below the threshold before adjustment";

    var missingRequirements = [];
    if (!allHaveAuditorUdin) missingRequirements.push("statutory auditor/CA certification with an actual UDIN string");
    if (!hasDocumentedAdjustedTurnover) missingRequirements.push("independently verified adjusted figures with a documented 7% adjustment basis");

    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason:
        unadjustedStatusNote + ", but turnover eligibility cannot pass on unadjusted or unverified figures. " +
        "Pending: " + missingRequirements.join(" and ") + ". The adjustment calculation method cannot be inferred or invented.",
    };
  }

  var totalAdjusted = 0;
  for (var j = 0; j < selected.length; j++) {
    totalAdjusted += selected[j].record.adjustedAnnualTurnover;
  }
  var adjustedAverage = totalAdjusted / yearsRequired;

  if (adjustedAverage < minAverage) {
    return {
      status: STATUS_FAIL,
      reason:
        "Verified 7%-adjusted average annual turnover over " + yearsStr + " is ₹" +
        Math.round(adjustedAverage).toLocaleString("en-IN") +
        ", which fails the required minimum threshold of " + minFormatted + ".",
    };
  }

  return {
    status: STATUS_PASS,
    reason:
      "Verified 7%-adjusted average annual turnover over " + yearsStr + " is ₹" +
      Math.round(adjustedAverage).toLocaleString("en-IN") +
      " (minimum required: " + minFormatted + ") and is verified by statutory auditor certification with UDIN.",
  };
}

// ---------------------------------------------------------------------------
// Criterion D — Financial Solvency (Loss-Making Years)
// ---------------------------------------------------------------------------

/**
 * Check the number of loss-making financial years over the last 5 FYs.
 *
 * Rules:
 * - Validate yearsRequired and maxLoss before calculations (positive integer, non-negative).
 * - Validate financial years (YYYY-YYYY format, consecutive, distinct).
 * - Count losses only when profitAfterTax is a finite number below zero.
 * - Require verificationStatus === "verified", isDemonstrationValue !== true, an actual non-empty UDIN string,
 *   and explicit statutory auditor/CA verification of the P&L account.
 * - A Boolean flag alone is not sufficient.
 * - Do not treat more than two self-declared loss years as a confirmed failure.
 * - Only independently verified P&L records may trigger a definitive pass or fail.
 */
function checkFinancialSolvency(solvencyCriterion, financialRecords) {
  if (!solvencyCriterion || !solvencyCriterion.expectedValue) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "Financial solvency criterion data missing from tender record.",
    };
  }

  var ev = solvencyCriterion.expectedValue;
  var maxLoss = ev.maxPermissibleLossYears;
  var yearsRequired = ev.yearsEvaluated;

  var isYearsReqValid = typeof yearsRequired === "number" && Number.isInteger(yearsRequired) && yearsRequired > 0;
  var isMaxLossValid = typeof maxLoss === "number" && Number.isInteger(maxLoss) && maxLoss >= 0;

  if (!isYearsReqValid || !isMaxLossValid) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "Invalid solvency criteria configuration (yearsEvaluated or maxPermissibleLossYears invalid). Verification required.",
    };
  }

  // Validate financial-year records (YYYY-YYYY format, consecutive, distinct)
  var valResult = validateFinancialYears(financialRecords, yearsRequired);
  if (!valResult.valid) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "Financial records validation failed: " + valResult.reason,
    };
  }

  var selected = valResult.selected;
  var lossYears = [];
  var validYearsCount = 0;
  var invalidOrMissingYears = [];
  var allVerified = true;

  for (var i = 0; i < selected.length; i++) {
    var item = selected[i];
    var rec = item.record;
    var val = rec.profitAfterTax;
    var isFiniteProfit = typeof val === "number" && Number.isFinite(val);

    // Require actual non-empty UDIN string, verified status, and explicit P&L verification
    var hasUdinString =
      (typeof rec.udin === "string" && rec.udin.trim().length > 0) ||
      (typeof rec.caUdin === "string" && rec.caUdin.trim().length > 0);

    var hasPlAuditorVerification =
      rec.plAuditedByStatutoryAuditor === true ||
      rec.plCertifiedByCa === true ||
      rec.statutoryAuditorCertified === true ||
      rec.caCertified === true ||
      rec.plVerified === true ||
      rec.isPlVerified === true ||
      rec.profitAfterTaxVerified === true ||
      rec.auditorCertified === true ||
      rec.caCertifiedWithUdin === true;

    var isRecVerified =
      rec.verificationStatus === "verified" &&
      rec.isDemonstrationValue !== true &&
      hasUdinString &&
      hasPlAuditorVerification;

    if (isFiniteProfit) {
      validYearsCount++;
      if (val < 0) {
        lossYears.push({ year: item.financialYear, isVerified: isRecVerified });
      }
      if (!isRecVerified) {
        allVerified = false;
      }
    } else {
      invalidOrMissingYears.push(item.financialYear);
    }
  }

  var lossCount = lossYears.length;

  // If loss count exceeds max permissible limit
  if (lossCount > maxLoss) {
    var verifiedLosses = lossYears.filter(function (l) { return l.isVerified; });
    var lossYearNames = lossYears.map(function (l) { return l.year; }).join(", ");

    // Only independently established financial records with valid UDIN may trigger a definitive failure!
    if (verifiedLosses.length > maxLoss) {
      return {
        status: STATUS_FAIL,
        reason:
          "Confirmed loss-making years from independently established records with statutory auditor UDIN: " +
          verifiedLosses.length + " (" + verifiedLosses.map(function (l) { return l.year; }).join(", ") +
          ") across the evaluated years. This exceeds the maximum permissible limit of " +
          maxLoss + " loss-making years.",
      };
    }

    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason:
        "Records indicate " + lossCount + " loss-making years (" +
        lossYearNames + ") across the evaluated years, exceeding the permissible limit of " +
        maxLoss + ". However, records lack verified statutory auditor UDIN certification; a definitive failure determination requires independently established P&L records.",
    };
  }

  // If any values are missing, non-finite, or invalid, treat as insufficient information
  if (invalidOrMissingYears.length > 0) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason:
        "profitAfterTax data is missing, non-finite, or invalid for " + invalidOrMissingYears.length +
        " financial year(s) (" + invalidOrMissingYears.join(", ") + "). " +
        "Cannot verify solvency without complete financial records.",
    };
  }

  // All years are valid finite numbers and lossCount <= maxLoss
  if (!allVerified) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason:
        "Declared loss-making years: " + lossCount +
        (lossCount > 0 ? " (" + lossYears.map(function (l) { return l.year; }).join(", ") + ")" : "") +
        " across " + yearsRequired + " evaluated financial years. " +
        "Declared count is within the maximum permissible limit of " + maxLoss +
        ", but records require statutory auditor UDIN certification of the P&L account.",
    };
  }

  return {
    status: STATUS_PASS,
    reason:
      "Verified loss-making years: " + lossCount +
      (lossCount > 0 ? " (" + lossYears.map(function (l) { return l.year; }).join(", ") + ")" : "") +
      " across " + yearsRequired + " financial years. Complies with the maximum permissible limit of " +
      maxLoss + ".",
  };
}

// ---------------------------------------------------------------------------
// Criterion E — Available Bidding Capacity
// ---------------------------------------------------------------------------

/**
 * Check available bidding capacity: (A × N × 2) − B ≥ required.
 *
 * Rules:
 * - Validate required as a finite, non-negative number.
 * - Validate N as a finite, positive number.
 * - Validate adjustedA and B as finite, non-negative numbers.
 * - Calculate calculatedCapacity = (adjustedA * N * 2) - B.
 * - If calculatedCapacity is non-finite or overflows, return STATUS_NEEDS_VERIFICATION.
 * - Verification requires: verificationStatus === "verified", isDemonstrationValue !== true,
 *   actual non-empty UDIN string in decl.udin or decl.caUdin, explicit CA certification covering
 *   BOTH parameter A and parameter B, and Annexure VIII declaration confirmed as submitted.
 * - Do not accept caCertifiedWithUdin === true as a substitute for an actual UDIN string.
 */
function checkBiddingCapacity(bidCriterion, biddingCapacityDeclaration) {
  if (!bidCriterion || !bidCriterion.expectedValue) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "Bidding capacity criterion data missing from tender record.",
    };
  }

  var ev = bidCriterion.expectedValue;
  var required = ev.minimumCapacityRequired;
  var N = ev.completionPeriodYearsN;

  // Validate required as a finite, non-negative number
  if (typeof required !== "number" || !Number.isFinite(required) || required < 0) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "Invalid bidding capacity minimumCapacityRequired configuration. Verification required.",
    };
  }

  // Reject non-finite, negative, or invalid N values
  if (typeof N !== "number" || !Number.isFinite(N) || N <= 0) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "Completion period N is non-finite, non-positive, or invalid (" + N + ").",
    };
  }

  if (!biddingCapacityDeclaration) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "No bidding capacity declaration found in company profile.",
    };
  }

  var decl = biddingCapacityDeclaration;

  // Extract adjusted A
  var adjustedA = null;
  if (typeof decl.adjustedConstructionWorkExecutedA === "number") {
    adjustedA = decl.adjustedConstructionWorkExecutedA;
  } else if (typeof decl.adjustedA === "number") {
    adjustedA = decl.adjustedA;
  }

  // Extract parameter B (commitments for next 12 months)
  var B = null;
  if (typeof decl.declaredCommitmentsNext12MonthsB === "number") {
    B = decl.declaredCommitmentsNext12MonthsB;
  } else if (typeof decl.commitmentsNext12MonthsB === "number") {
    B = decl.commitmentsNext12MonthsB;
  }

  // Reject non-finite, negative, or invalid A and B values
  if (adjustedA !== null && (typeof adjustedA !== "number" || !Number.isFinite(adjustedA) || adjustedA < 0)) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "Adjusted construction work execution value A is non-finite, negative, or invalid (" + adjustedA + ").",
    };
  }
  if (B !== null && (typeof B !== "number" || !Number.isFinite(B) || B < 0)) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "Commitments value B is non-finite, negative, or invalid (" + B + ").",
    };
  }

  // If adjusted A is unavailable, return needs_verification (never definitive failure from unadjusted A)
  if (adjustedA === null) {
    var illustrativeNote = "";
    if (typeof decl.illustrativeUnadjustedBidCapacity === "number") {
      illustrativeNote =
        " Illustrative unadjusted calculation: ₹" +
        decl.illustrativeUnadjustedBidCapacity.toLocaleString("en-IN") +
        " (using unadjusted A=" + (decl.declaredUnadjustedConstructionWorkExecutedA || "N/A") +
        ", N=" + N + ", B=" + (B !== null ? B : "N/A") +
        "). This is below the required threshold of ₹" +
        required.toLocaleString("en-IN") +
        ", but unadjusted A cannot be used for a definitive eligibility determination.";
    }
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason:
        "Adjusted parameter A (maximum annual construction work execution over last 5 years, " +
        "enhanced at simple rate of 7% per annum) is not available from sample records. " +
        "Bidding capacity threshold cannot be determined without adjusted A." +
        illustrativeNote +
        " Supporting Annexure VIII declaration and CA certification with UDIN are unverified.",
    };
  }

  if (B === null) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "Parameter B (ongoing commitments for next 12 months) is unavailable. Cannot calculate bidding capacity.",
    };
  }

  var calculatedCapacity = (adjustedA * N * 2) - B;
  if (!Number.isFinite(calculatedCapacity)) {
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason: "Calculated bidding capacity is non-finite or overflowed. Verification required.",
    };
  }

  var meetsThreshold = calculatedCapacity >= required;

  // Verification requirements:
  // - decl.verificationStatus === "verified"
  // - decl.isDemonstrationValue !== true
  // - Actual non-empty UDIN string in decl.udin or decl.caUdin
  // - Explicit CA certification covering BOTH adjusted parameter A and commitments parameter B
  // - Annexure VIII declaration is confirmed as submitted
  var hasUdinString =
    (typeof decl.udin === "string" && decl.udin.trim().length > 0) ||
    (typeof decl.caUdin === "string" && decl.caUdin.trim().length > 0);

  var coversBothAandB =
    (decl.caCertifiedA === true && decl.caCertifiedB === true) ||
    decl.caCertifiedParametersAandB === true ||
    decl.caCoversBothAandB === true ||
    (decl.caCertificationDetails && decl.caCertificationDetails.coversParameterA === true && decl.caCertificationDetails.coversParameterB === true) ||
    (decl.caCertifiedWithUdin === true && decl.caCertifiedA === true && decl.caCertifiedB === true);

  var isAnnexureVIIISubmitted =
    decl.declarationSubmitted === true ||
    decl.annexureVIIISubmitted === true ||
    decl.declarationStatus === "submitted" ||
    decl.annexureVIIIConfirmedSubmitted === true;

  var isVerified =
    decl.verificationStatus === "verified" &&
    decl.isDemonstrationValue !== true &&
    hasUdinString &&
    coversBothAandB &&
    isAnnexureVIIISubmitted;

  if (!isVerified) {
    if (!meetsThreshold) {
      return {
        status: STATUS_NEEDS_VERIFICATION,
        reason:
          "Calculated bidding capacity using unverified adjusted A (₹" +
          Math.round(calculatedCapacity).toLocaleString("en-IN") +
          ") is below the required threshold of ₹" +
          required.toLocaleString("en-IN") +
          ". However, figures lack verified CA UDIN certification covering parameters A & B and Annexure VIII confirmation.",
      };
    }
    return {
      status: STATUS_NEEDS_VERIFICATION,
      reason:
        "Calculated bidding capacity ₹" +
        Math.round(calculatedCapacity).toLocaleString("en-IN") +
        " meets the required threshold of ₹" +
        required.toLocaleString("en-IN") +
        ", but figures are self-declared and require CA certification with an actual UDIN string covering A & B and Annexure VIII submission confirmation.",
    };
  }

  if (!meetsThreshold) {
    return {
      status: STATUS_FAIL,
      reason:
        "Available Bid Capacity (A=" + Math.round(adjustedA).toLocaleString("en-IN") +
        ", N=" + N + ", B=" + Math.round(B).toLocaleString("en-IN") + "): ₹" +
        Math.round(calculatedCapacity).toLocaleString("en-IN") +
        " is below the required minimum threshold of ₹" +
        required.toLocaleString("en-IN") + " based on verified CA certification with UDIN.",
    };
  }

  return {
    status: STATUS_PASS,
    reason:
      "Available Bid Capacity ₹" +
      Math.round(calculatedCapacity).toLocaleString("en-IN") +
      " meets the required threshold of ₹" +
      required.toLocaleString("en-IN") +
      " and is verified by CA certification with UDIN covering parameters A & B and confirmed Annexure VIII submission.",
  };
}

// ---------------------------------------------------------------------------
// Overall status aggregation
// ---------------------------------------------------------------------------

/**
 * Aggregate individual criterion statuses into an overall status.
 *
 * Precedence:
 *   1. If no mandatory criteria were evaluated, return "Needs Verification", not "Eligible".
 *   2. Any mandatory criterion STATUS_FAIL -> "Not Eligible"
 *   3. Any mandatory criterion STATUS_NEEDS_VERIFICATION -> "Needs Verification"
 *   4. All mandatory criteria STATUS_PASS -> "Eligible"
 *
 * Missing value is not automatically a failure.
 */
function aggregateOverallStatus(criteriaResults) {
  var mandatoryCount = 0;
  var hasFail = false;
  var hasNeedsVerification = false;

  for (var i = 0; i < criteriaResults.length; i++) {
    var result = criteriaResults[i];
    if (!result.isMandatory) continue;
    mandatoryCount++;
    if (result.status === STATUS_FAIL) {
      hasFail = true;
    } else if (result.status === STATUS_NEEDS_VERIFICATION) {
      hasNeedsVerification = true;
    }
  }

  // If no mandatory criteria were evaluated, return Needs Verification, not Eligible
  if (mandatoryCount === 0) {
    return OVERALL_NEEDS_VERIFICATION;
  }
  if (hasFail) return OVERALL_NOT_ELIGIBLE;
  if (hasNeedsVerification) return OVERALL_NEEDS_VERIFICATION;
  return OVERALL_ELIGIBLE;
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildSummary(overallStatus, criteriaResults) {
  var passCount = 0;
  var failCount = 0;
  var nvCount = 0;

  for (var i = 0; i < criteriaResults.length; i++) {
    if (!criteriaResults[i].isMandatory) continue;
    if (criteriaResults[i].status === STATUS_PASS) passCount++;
    else if (criteriaResults[i].status === STATUS_FAIL) failCount++;
    else if (criteriaResults[i].status === STATUS_NEEDS_VERIFICATION) nvCount++;
  }

  var parts = [];
  if (failCount > 0) parts.push(failCount + " criterion/criteria clearly fail");
  if (nvCount > 0) parts.push(nvCount + " criterion/criteria need verification");
  if (passCount > 0) parts.push(passCount + " criterion/criteria pass");

  var detail = parts.length > 0 ? " (" + parts.join("; ") + ")." : ".";

  var disclaimer =
    " This is a preliminary automated check only. " +
    "A '" + overallStatus + "' result does NOT guarantee acceptance by the tender authority. " +
    "All self-declared information must be independently verified before submission.";

  return "Overall status: " + overallStatus + detail + disclaimer;
}

var RELEVANCE_GENERIC_TERMS = {
  work: true,
  works: true,
  service: true,
  services: true,
  company: true,
  companies: true,
  business: true,
  businesses: true,
  supply: true,
  supplies: true,
  supplier: true,
  suppliers: true,
  tender: true,
  tenders: true,
  procurement: true,
  development: true,
  equipment: true,
  systems: true
};

function normalizeRelevanceText(value) {
  if (typeof value !== "string") return "";
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectProfileRelevanceText(companyProfile) {
  if (!companyProfile || typeof companyProfile !== "object") return "";

  var parts = [];
  if (typeof companyProfile.industry === "string") parts.push(companyProfile.industry);
  if (typeof companyProfile.businessDescription === "string") {
    parts.push(companyProfile.businessDescription);
  }

  if (Array.isArray(companyProfile.completedWorks)) {
    for (var i = 0; i < companyProfile.completedWorks.length; i++) {
      var completed = companyProfile.completedWorks[i];
      if (!completed || typeof completed !== "object") continue;
      if (typeof completed.workTitle === "string") parts.push(completed.workTitle);
      if (typeof completed.workDescription === "string") parts.push(completed.workDescription);
      if (typeof completed.declaredSimilarWork === "string") {
        parts.push(completed.declaredSimilarWork);
      }
    }
  }

  if (Array.isArray(companyProfile.ongoingWorks)) {
    for (var j = 0; j < companyProfile.ongoingWorks.length; j++) {
      var ongoing = companyProfile.ongoingWorks[j];
      if (!ongoing || typeof ongoing !== "object") continue;
      if (typeof ongoing.workTitle === "string") parts.push(ongoing.workTitle);
      if (typeof ongoing.workDescription === "string") parts.push(ongoing.workDescription);
    }
  }

  return normalizeRelevanceText(parts.join(" "));
}

function collectTenderRelevanceText(tender) {
  if (!tender || typeof tender !== "object") return "";

  var parts = [];
  if (typeof tender.title === "string") parts.push(tender.title);
  if (typeof tender.category === "string") parts.push(tender.category);
  if (typeof tender.description === "string") parts.push(tender.description);
  if (Array.isArray(tender.relevanceKeywords)) {
    parts = parts.concat(tender.relevanceKeywords.filter(function (keyword) {
      return typeof keyword === "string";
    }));
  }

  return normalizeRelevanceText(parts.join(" "));
}

function getMeaningfulTerms(text) {
  var normalized = normalizeRelevanceText(text);
  if (!normalized) return new Set();

  var terms = new Set();
  var words = normalized.split(" ");
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    if (
      word.length >= 4 &&
      !RELEVANCE_GENERIC_TERMS[word] &&
      !/^\d+$/.test(word)
    ) {
      terms.add(word);
    }
  }
  return terms;
}

/**
 * Evaluate industry-independent tender relevance separately from mandatory eligibility.
 *
 * @param {object|null} tender - Tender record.
 * @param {object|null} companyProfile - Adapted or persistent plain profile.
 * @returns {{classification:string, explanation:string, matchingTerms:string[]}}
 */
function evaluateTenderRelevance(tender, companyProfile) {
  var tenderText = collectTenderRelevanceText(tender);
  var profileText = collectProfileRelevanceText(companyProfile);

  if (!profileText || getMeaningfulTerms(profileText).size === 0) {
    return {
      classification: "Insufficient Information",
      explanation: "Your profile does not provide enough industry or activity information.",
      matchingTerms: [],
    };
  }

  if (!tenderText || getMeaningfulTerms(tenderText).size === 0) {
    return {
      classification: "Insufficient Information",
      explanation: "This tender does not provide enough descriptive information for relevance matching.",
      matchingTerms: [],
    };
  }

  var tenderTerms = getMeaningfulTerms(tenderText);
  var profileTerms = getMeaningfulTerms(profileText);
  var matchingTerms = [];

  tenderTerms.forEach(function (term) {
    if (profileTerms.has(term)) matchingTerms.push(term);
  });
  matchingTerms.sort();

  var keywordPhraseMatches = [];
  if (tender && Array.isArray(tender.relevanceKeywords)) {
    for (var k = 0; k < tender.relevanceKeywords.length; k++) {
      var keyword = normalizeRelevanceText(tender.relevanceKeywords[k]);
      if (!keyword) continue;

      var keywordTerms = getMeaningfulTerms(keyword);
      var meaningfulKeywordTerms = Array.from(keywordTerms);
      if (
        keywordTerms.size > 0 &&
        meaningfulKeywordTerms.length >= 2 &&
        (" " + profileText + " ").indexOf(" " + keyword + " ") !== -1
      ) {
        keywordPhraseMatches.push(keyword);
      }
    }
  }

  var uniqueMatches = matchingTerms.concat(keywordPhraseMatches).filter(function (term, index, all) {
    return all.indexOf(term) === index;
  });

  if (uniqueMatches.length === 0) {
    return {
      classification: "Not Relevant",
      explanation: "No meaningful industry or business-activity match was found.",
      matchingTerms: [],
    };
  }

  var isStrongMatch =
    keywordPhraseMatches.length > 0 ||
    uniqueMatches.length >= 2;

  if (isStrongMatch) {
    return {
      classification: "Relevant",
      explanation: "Matches your profile terms: " + uniqueMatches.slice(0, 5).join(", ") + ".",
      matchingTerms: uniqueMatches.slice(0, 5),
    };
  }

  return {
    classification: "Possibly Relevant",
    explanation: "A limited match was found with: " + uniqueMatches[0] + ".",
    matchingTerms: uniqueMatches.slice(0, 5),
  };
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Evaluate a tender against a company profile.
 *
 * Currently implements the five mandatory criteria for tnd-007 (DRDO CPPP tender).
 * For tenders without structured eligibilityRequirements, all criteria are
 * returned as needs_verification.
 *
 * @param {object} tender         - A tender record from DEMO_TENDERS.
 * @param {object} companyProfile - DEMO_MSME_PROFILE or equivalent structure.
 * @returns {object} MatchResult
 */
export function evaluateTenderMatch(tender, companyProfile) {
  if (!tender) {
    return {
      tenderId: null,
      overallStatus: OVERALL_NEEDS_VERIFICATION,
      criteriaResults: [],
      summary:
        "No tender provided. Cannot evaluate. " +
        "This is a preliminary automated check only.",
    };
  }

  if (!companyProfile) {
    return {
      tenderId: tender.id || null,
      overallStatus: OVERALL_NEEDS_VERIFICATION,
      criteriaResults: [],
      summary:
        "No company profile provided. Cannot evaluate. " +
        "This is a preliminary automated check only.",
    };
  }

  var tenderId = tender.id || null;
  var requirements = Array.isArray(tender.eligibilityRequirements)
    ? tender.eligibilityRequirements
    : [];

  if (requirements.length === 0) {
    return {
      tenderId: tenderId,
      overallStatus: OVERALL_NEEDS_VERIFICATION,
      criteriaResults: [],
      summary:
        "No structured eligibility requirements found for this tender. " +
        "Manual review required. " +
        "This is a preliminary automated check only.",
    };
  }

  var criteriaResults = [];

  for (var i = 0; i < requirements.length; i++) {
    var req = requirements[i];
    var key = req.criteriaKey || ("criterion_" + i);
    var criterion = req.criterion || "Unknown Criterion";
    var isMandatory = req.isMandatory === true;
    var evalResult = { status: STATUS_NEEDS_VERIFICATION, reason: "Not evaluated." };

    if (key === "departmentalEnlistment") {
      evalResult = checkDepartmentalEnlistment(req, companyProfile.registrations);
    } else if (key === "similarTermContractWorks") {
      evalResult = checkSimilarWork(
        req,
        companyProfile.completedWorks,
        tender.publicationDate
      );
    } else if (key === "minAnnualTurnover") {
      evalResult = checkAnnualTurnover(req, companyProfile.financialRecords);
    } else if (key === "maxLossYears") {
      evalResult = checkFinancialSolvency(req, companyProfile.financialRecords);
    } else if (key === "availableBidCapacity") {
      evalResult = checkBiddingCapacity(
        req,
        companyProfile.biddingCapacityDeclaration
      );
    }

    criteriaResults.push({
      criteriaKey: key,
      criterion: criterion,
      status: evalResult.status,
      reason: evalResult.reason,
      isMandatory: isMandatory,
    });
  }

  var overallStatus = aggregateOverallStatus(criteriaResults);
  var summary = buildSummary(overallStatus, criteriaResults);

  return {
    tenderId: tenderId,
    overallStatus: overallStatus,
    criteriaResults: criteriaResults,
    summary: summary,
  };
}

export { evaluateTenderRelevance };
