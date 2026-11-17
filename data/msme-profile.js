/**
 * Demonstration MSME Company Profile Dataset
 * INT257: Modern Web Application Development
 * Academic demonstration data for TenderBridge.
 * DISCLAIMER: This company profile is entirely fictional sample demonstration data.
 * All registration numbers, financial records, construction work execution values,
 * ongoing commitments, and document references are illustrative values created
 * solely for INT257 coursework. They do NOT represent real entities or verified credentials.
 */

export const DEMO_MSME_PROFILE = {
  isDemoData: true,
  isIndependentlyVerified: false,
  preliminaryMatchingStatus: "Needs Verification",
  companyName: "Eastern Himalayan Facility & Maintenance Services (Demo)",
  enterpriseType: "Small",
  industry: "Artificers Works & Infrastructure Maintenance",
  location: {
    state: "Arunachal Pradesh",
    city: "Itanagar",
    address: "Demonstration Commercial Complex, Sector B, Itanagar (Fictional Demo Address)",
  },

  // 1. registrations as an Array
  registrations: [
    {
      registrationType: "Departmental Enlistment",
      enlistmentBody: "DCW&E",
      category: "Composite",
      enlistmentClass: "Class IV",
      referenceNumber: "DEMO-DCWE-COMP-IV-0001",
      isDemonstrationValue: true,
      verificationStatus: "self_declared",
    },
    {
      registrationType: "DRDO-2024 BIM Enlistment",
      enlistmentBody: "DRDO-2024 BIM",
      enlistmentClass: "BIM-IV",
      referenceNumber: "DEMO-DRDO-BIM-IV-0001",
      isDemonstrationValue: true,
      verificationStatus: "self_declared",
    },
    {
      registrationType: "Udyam",
      registrationNumber: "UDYAM-DEMO-00-0000000",
      isDemonstrationValue: true,
      verificationStatus: "self_declared",
    },
  ],

  // 2. financialRecords as an Array (Loss-making years calculated from profitAfterTax < 0)
  financialRecords: [
    {
      financialYear: "2021-2022",
      annualTurnover: 1250000,
      profitAfterTax: 95000,
      isDemonstrationValue: true,
      verificationStatus: "self_declared",
    },
    {
      financialYear: "2022-2023",
      annualTurnover: 1180000,
      profitAfterTax: -45000, // Loss year: profitAfterTax < 0
      isDemonstrationValue: true,
      verificationStatus: "self_declared",
    },
    {
      financialYear: "2023-2024",
      annualTurnover: 1420000,
      profitAfterTax: 120000,
      isDemonstrationValue: true,
      verificationStatus: "self_declared",
    },
    {
      financialYear: "2024-2025",
      annualTurnover: 1580000,
      profitAfterTax: 145000,
      isDemonstrationValue: true,
      verificationStatus: "self_declared",
    },
    {
      financialYear: "2025-2026",
      annualTurnover: 1720000,
      profitAfterTax: 168000,
      isDemonstrationValue: true,
      verificationStatus: "self_declared",
    },
  ],

  // 3. annualWorkExecutionRecords (Construction Work Executed — Distinct from turnover)
  annualWorkExecutionRecords: [
    {
      financialYear: "2021-2022",
      constructionWorkExecuted: 1100000,
      isDemonstrationValue: true,
      caCertificationStatus: "unverified",
    },
    {
      financialYear: "2022-2023",
      constructionWorkExecuted: 1050000,
      isDemonstrationValue: true,
      caCertificationStatus: "unverified",
    },
    {
      financialYear: "2023-2024",
      constructionWorkExecuted: 1350000,
      isDemonstrationValue: true,
      caCertificationStatus: "unverified",
    },
    {
      financialYear: "2024-2025",
      constructionWorkExecuted: 1520000,
      isDemonstrationValue: true,
      caCertificationStatus: "unverified",
    },
    {
      financialYear: "2025-2026",
      constructionWorkExecuted: 1680000, // Unadjusted peak year for Parameter A
      isDemonstrationValue: true,
      caCertificationStatus: "unverified",
    },
  ],

  // 4. completedWorks as an Array
  completedWorks: [
    {
      workTitle:
        "Term Contract for Day-to-Day Artificer Maintenance Services at High-Altitude Station",
      workDescription:
        "Day-to-day maintenance of station buildings, internal roads, water supply, sanitary installations, and minor electrical works at a high-altitude defense detachment. Scope covered under CPWD DSR items. (Fictional demonstration description — not independently verified.)",
      workCategory: "Artificers Works & Maintenance",
      clientOrganization: "Defense Estate Unit, Tawang Sector",
      workLocation: "Tawang Sector, Arunachal Pradesh (Fictional Demo Location)",
      originalContractPeriodValue: 1850000,
      actualGrossPaymentsOriginalPeriod: null, // Not available from sample data — do not invent
      originalContractPeriodStartDate: "2023-04-01",
      originalContractPeriodEndDate: "2024-03-31",
      completionDate: "2024-03-31", // Used for 7% simple rate adjustment to 27 Nov 2026
      completionStatus: "Completed within original contract period",
      termContract: true,                // Must be a term contract per eligibility criterion
      highAltitudeWork: true,
      // altitudeAbove6500Feet derived from altitudeInFeet > 6500 (strict greater-than, not >=)
      altitudeInFeet: 8200,
      altitudeAbove6500Feet: true,       // 8200 > 6500 → true
      coveredByCPWDDSR: true,
      workPerformance:
        "Satisfactorily completed term maintenance contract within original stipulated duration with zero penalties",
      declaredSimilarWork:
        "Term contract for day-to-day maintenance services of buildings, roads, water supply, and electrical services in high-altitude area above 6,500 ft MSL conforming to CPWD DSR",
      certificateDetails: {
        // declared: what the certificate is stated to contain (not independently verified)
        declared: {
          statesWorkDuration: true,
          statesWorkValue: true,
        },
        actualCertificateDataAvailable: false, // Certificate content not independently checked
        verificationStatus: "self_declared",
      },
      isDemonstrationValue: true,
      verificationStatus: "self_declared",
      // Note: This record does not constitute verified qualifying experience.
      // All values are fictional and self-declared for demonstration purposes only.
    },
    {
      workTitle:
        "Term Contract for Maintenance of High-Altitude Infrastructure and Services",
      workDescription:
        "Day-to-day maintenance of station buildings, water supply, sanitary fittings, and ancillary civil works at a high-altitude border area post. Scope covered under CPWD DSR items. (Fictional demonstration description — not independently verified.)",
      workCategory: "Artificers Works & Maintenance",
      clientOrganization: "Border Area Infrastructure Wing, Salari / Bomdila",
      workLocation: "Salari / Bomdila Area, Arunachal Pradesh (Fictional Demo Location)",
      originalContractPeriodValue: 1450000,
      actualGrossPaymentsOriginalPeriod: null, // Not available from sample data — do not invent
      originalContractPeriodStartDate: "2022-04-01",
      originalContractPeriodEndDate: "2023-03-31",
      completionDate: "2023-03-31",
      completionStatus: "Completed within original contract period",
      termContract: true,
      highAltitudeWork: true,
      // altitudeAbove6500Feet derived from altitudeInFeet > 6500 (strict greater-than, not >=)
      altitudeInFeet: 7400,
      altitudeAbove6500Feet: true,       // 7400 > 6500 → true
      coveredByCPWDDSR: true,
      workPerformance: "Satisfactorily completed within contract duration",
      declaredSimilarWork:
        "Day-to-day maintenance of station buildings, water supply, and sanitary fittings covered under CPWD DSR",
      certificateDetails: {
        // declared: what the certificate is stated to contain (not independently verified)
        declared: {
          statesWorkDuration: true,
          statesWorkValue: true,
        },
        actualCertificateDataAvailable: false, // Certificate content not independently checked
        verificationStatus: "self_declared",
      },
      isDemonstrationValue: true,
      verificationStatus: "self_declared",
      // Note: This record does not constitute verified qualifying experience.
      // All values are fictional and self-declared for demonstration purposes only.
    },
  ],

  // 5. ongoingWorks (Existing commitments for Bidding Capacity Parameter B)
  ongoingWorks: [
    {
      workTitle: "Routine Station Complex Maintenance Works",
      clientOrganization: "Public Works Division, West Kameng",
      totalContractValue: 1200000,
      remainingValueToExecuteInNext12Months: 350000, // Value contributing to Parameter B
      anticipatedCompletionDate: "2027-04-30",
      isDemonstrationValue: true,
      verificationStatus: "self_declared",
      isIndependentlyVerified: false,
    },
  ],

  // Bidding Capacity Declaration Status (Annexure VIII Format)
  biddingCapacityDeclaration: {
    format: "Annexure VIII",
    declaredUnadjustedConstructionWorkExecutedA: 1680000, // Unadjusted peak year value
    declaredCommitmentsNext12MonthsB: 350000,             // Sum of ongoing commitments
    illustrativeUnadjustedBidCapacity: 3010000,          // (16,80,000 * 1 * 2) - 3,50,000 = 30,10,000 (Illustrative only, not final)
    minimumRequiredCapacity: 3378571,
    thresholdCheckPassed: null,                          // Set to null: cannot determine without adjusted A
    preliminaryCapacityStatus: "Cannot Determine — Adjusted A Unavailable",
    adjustedACalculationNote:
      "Adjusted parameter A cannot currently be calculated from sample data alone as itemized execution dates across 5 years are not present. The illustrative calculation (₹30,10,000) uses unadjusted declared A and is below the threshold, but is not a final eligibility determination.",
    caCertifiedWithUdin: false,
    caCertificationStatus: "unverified",
    declarationSubmitted: false,
    declarationStatus: "unsubmitted",
    hasWorkOrdersOrLoi: false,
    isDemonstrationValue: true,
    verificationStatus: "self_declared",
  },

  // 6. documents as an Array
  documents: [
    {
      documentType: "DCW&E Enlistment Order (Composite Class IV)",
      documentReference: "DEMO-DOC-DCWE-IV-0001",
      verificationStatus: "self_declared",
      isDemonstrationValue: true,
    },
    {
      documentType: "DRDO-2024 BIM Enlistment Certificate (Class BIM-IV)",
      documentReference: "DEMO-DOC-DRDO-BIM-IV-0001",
      verificationStatus: "self_declared",
      isDemonstrationValue: true,
    },
    {
      documentType:
        "Five-Year Audited Turnover Records & P&L with Statutory Auditor Certification (Table A)",
      documentReference: "DEMO-DOC-AUDIT-5YR-0001",
      verificationStatus: "self_declared",
      isDemonstrationValue: true,
    },
    {
      documentType:
        "Draft Annexure VIII Bidding Capacity Declaration & Supporting CA Records with UDIN",
      documentReference: "DEMO-DOC-ANNEX-VIII-DRAFT",
      verificationStatus: "self_declared",
      isDemonstrationValue: true,
    },
    {
      documentType:
        "Term Contract Completion & Performance Certificates with Duration and Value",
      documentReference: "DEMO-DOC-PERF-0001",
      verificationStatus: "self_declared",
      isDemonstrationValue: true,
    },
  ],
};
