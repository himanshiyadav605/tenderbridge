/**
 * Tender Dataset
 *
 * INT257: Modern Web Application Development
 * TenderBridge academic demonstration data.
 *
 * Records tnd-001 through tnd-006: Entirely fictional sample tenders created
 * solely for user interface rendering and dynamic routing exercises.
 * They do not represent official government tenders or procurement claims.
 *
 * Record tnd-007: Structured from an actual CPPP tender notice
 * (Tendernotice_1.pdf, DRDO, 2026). Tender facts are drawn from the notice.
 * Eligibility summaries are synthesized; the original notice remains
 * the authoritative source.
 */

export const DEMO_TENDERS = [
  {
    id: "tnd-001",
    title: "Supply and Installation of Rooftop Solar Photovoltaic Systems",
    department: "Public Works & Energy Department",
    category: "Electrical & Solar",
    location: "Jaipur, Rajasthan",
    estimatedValue: "₹35,00,000",
    submissionDeadline: "2026-12-10",
    description:
      "Demonstration tender for the supply, mounting, testing, and commissioning of grid-connected rooftop solar photovoltaic panels across municipal administrative complexes. Includes a 12-month initial maintenance and monitoring warranty.",
    eligibilityRequirements: [
      {
        criterion: "Annual Turnover",
        requirement: "Minimum annual turnover of ₹15,00,000 in the last financial year.",
        isMandatory: true,
      },
      {
        criterion: "Experience",
        requirement: "At least 2 years of operational experience in solar equipment installation.",
        isMandatory: true,
      },
      {
        criterion: "Enterprise Registration",
        requirement: "Valid MSME / Udyam registration in electrical or manufacturing category.",
        isMandatory: true,
      },
      {
        criterion: "Quality Standard",
        requirement: "Valid ISO 9001 quality management system certification.",
        isMandatory: false,
      },
    ],
  },
  {
    id: "tnd-002",
    title: "Development and Maintenance of Web-Based Public Redressal Portal",
    department: "Department of Information Technology & e-Governance",
    category: "IT & Software Services",
    location: "Bengaluru, Karnataka",
    estimatedValue: "₹18,50,000",
    submissionDeadline: "2026-12-05",
    description:
      "Demonstration tender for UI/UX design, frontend development, and 12-month post-launch maintenance of a citizen grievance intake and tracking portal with responsive layouts.",
    eligibilityRequirements: [
      {
        criterion: "Annual Turnover",
        requirement: "Minimum annual turnover of ₹10,00,000 in the last financial year.",
        isMandatory: true,
      },
      {
        criterion: "Experience",
        requirement: "Completion of at least 2 web portal or application projects for institutional clients.",
        isMandatory: true,
      },
      {
        criterion: "Tax & Compliance",
        requirement: "Active GSTIN and PAN registration with clean compliance filing history.",
        isMandatory: true,
      },
      {
        criterion: "Information Security",
        requirement: "ISO 27001 certification for software development processes.",
        isMandatory: false,
      },
    ],
  },
  {
    id: "tnd-003",
    title: "Supply of Desks, Ergonomic Chairs and Storage Cabinets for District Schools",
    department: "Department of School Education & Literacy",
    category: "Furniture & Supplies",
    location: "Bhopal, Madhya Pradesh",
    estimatedValue: "₹12,00,000",
    submissionDeadline: "2026-11-30",
    description:
      "Demonstration tender for the fabrication, batch inspection, delivery, and on-site assembly of dual student benches, ergonomic teacher chairs, and steel storage cupboards for 20 primary schools.",
    eligibilityRequirements: [
      {
        criterion: "Enterprise Status",
        requirement: "Registered Micro or Small manufacturing enterprise with valid Udyam registration.",
        isMandatory: true,
      },
      {
        criterion: "Annual Turnover",
        requirement: "Minimum annual turnover of ₹8,00,000 in furniture manufacturing.",
        isMandatory: true,
      },
      {
        criterion: "Safety Standard",
        requirement: "Adherence to BIS standard specifications for classroom furniture.",
        isMandatory: true,
      },
    ],
  },
  {
    id: "tnd-004",
    title: "Provision of Comprehensive Facility Maintenance and Janitorial Support",
    department: "Civil Aviation & Transport Authority",
    category: "Facility Management",
    location: "New Delhi",
    estimatedValue: "₹45,00,000",
    submissionDeadline: "2026-12-20",
    description:
      "Demonstration tender for daily mechanized cleaning, sanitization, waste disposal, and general maintenance services across administrative passenger terminal annex buildings.",
    eligibilityRequirements: [
      {
        criterion: "Experience",
        requirement: "At least 3 years of experience managing facility services for spaces exceeding 15,000 sq.ft.",
        isMandatory: true,
      },
      {
        criterion: "Annual Turnover",
        requirement: "Average annual turnover of ₹20,00,000 over the past 2 financial years.",
        isMandatory: true,
      },
      {
        criterion: "Statutory Compliance",
        requirement: "Valid EPF and ESIC registration with current deposit challans.",
        isMandatory: true,
      },
    ],
  },
  {
    id: "tnd-005",
    title: "Supply of High-Visibility Cotton Uniforms and Safety Gloves",
    department: "State Municipal Corporation",
    category: "Textiles & Apparel",
    location: "Ahmedabad, Gujarat",
    estimatedValue: "₹9,50,000",
    submissionDeadline: "2026-12-01",
    description:
      "Demonstration tender for stitching, quality-checking, packaging, and distribution of reflective cotton uniform sets and heavy-duty nitrile gloves for sanitation workers.",
    eligibilityRequirements: [
      {
        criterion: "Enterprise Status",
        requirement: "Registered Micro or Small garment manufacturing enterprise.",
        isMandatory: true,
      },
      {
        criterion: "Annual Turnover",
        requirement: "Minimum annual turnover of ₹5,00,000 in textile or garment manufacturing.",
        isMandatory: true,
      },
      {
        criterion: "Material Safety",
        requirement: "Textile safety certification (OEKO-TEX or equivalent domestic standard).",
        isMandatory: false,
      },
    ],
  },
  {
    id: "tnd-006",
    title: "Procurement of Agricultural Soil Testing Kits and Handheld Analyzers",
    department: "Department of Agriculture & Farmers Welfare",
    category: "Scientific & Agricultural Equipment",
    location: "Chandigarh",
    estimatedValue: "₹22,00,000",
    submissionDeadline: "2026-12-18",
    description:
      "Demonstration tender for the supply, initial calibration, and user manual documentation of 150 digital soil test kits for nitrogen, phosphorus, and pH measurement in village resource centers.",
    eligibilityRequirements: [
      {
        criterion: "Authorized Vendor",
        requirement: "Original Equipment Manufacturer (OEM) or authorized distributor with manufacturer authorization.",
        isMandatory: true,
      },
      {
        criterion: "Annual Turnover",
        requirement: "Minimum annual turnover of ₹12,00,000 in testing or scientific instruments.",
        isMandatory: true,
      },
      {
        criterion: "Warranty & Support",
        requirement: "Minimum 1-year warranty on testing sensors with local technical assistance.",
        isMandatory: true,
      },
    ],
  },
  {
    id: "tnd-007",
    tenderId: "2026_DRDO_934431_1",
    referenceNo: "CCE(EN)/TEZ/TC-02/TAWANG & SALARI/26-27/2602",
    title: "TERM CONTRACT FOR ARTIFICERS WORKS (INCLUDING MINOR WORKS) AT DRL DETACHMENT TAWANG AND SALARI (ARUNACHAL PRADESH)",
    department: "DRDO",
    category: "Artificers Works & Maintenance",
    contractType: "Percentage Rate Tender",
    contractDuration: "12 months",
    location: "Tawang and Salari, Arunachal Pradesh",
    estimatedValue: 3378571,
    emd: 67571,
    publicationDate: "2026-11-16",
    submissionDeadline: "2026-11-28T15:00:00",
    technicalBidOpening: "2026-11-30T15:30:00",
    source: "CPPP",
    sourceUrl: null,
    documentUrls: [],
    isExemptForMSME: null,
    description:
      "Term contract for artificers works (including minor works) comprising day-to-day maintenance of buildings, internal roads, water supply, sanitary fittings, and electrical installations at DRL Detachment Tawang and Salari, Arunachal Pradesh, adhering to CPWD DSR items.",
    eligibilitySummary:
      "Technical Eligibility (NIT para 2(a) & Appendix C): Eligible contractors must be enlisted with DCW&E in Composite Category in Classes IV, III, II, I, I(A), I(AA), I(AAA), or I(Super) & enlisted under DRDO-2024 BIM Framework in Classes BIM-IV, BIM-III, BIM-II, or BIM-I. The applicant must have satisfactorily completed similar work as a term contract for day-to-day maintenance services in high-altitude areas situated strictly above 6,500 feet MSL, including works covered under CPWD DSR during the last seven years ending last day of month previous to one in which applications are invited: Three similar completed works costing not less than 40% (Rs. 13,51,428/-) OR two similar completed works costing not less than 50% (Rs. 16,89,286/-) OR one similar completed work costing not less than 80% (Rs. 27,02,857/-) of estimated cost. Completion and performance certificates must state work duration and value. Work value shall be enhanced at simple rate of 7% per annum from specified completion date to previous day of bid submission. Available Bid Capacity = (A * N * 2) - B must be greater than or equal to Rs. 33,78,571/-, supported by Annexure VIII declaration, 5-year CA turnover with UDIN, LOI/work orders, and CA-certified ongoing commitments. Discrepancy: Table A requires audited turnover records with statutory auditor certification and P&L details for last 5 financial years, while Financial Soundness specifies average annual turnover >= Rs. 10.14 Lakh over immediate last 3 financial years and <= 2 loss-making years in last 5 financial years. Appendix D requires copies of valid registrations with Labour Commissioner, EPFO, and ESIC.",
    noticeDiscrepancyNotes:
      "Discrepancy notes: (1) Enlistment: NIT para 2(a) and Appendix C use the conjunction '&' between DCW&E Composite classes and DRDO-2024 BIM classes; administrative clarification is required whether dual enlistment or alternative eligibility is intended. (2) Financials: Financial Soundness requires average annual turnover >= Rs. 10.14 Lakh over 3 financial years and <= 2 loss-making years over 5 financial years, whereas Table A requires audited turnover records with statutory auditor certification covering 5 financial years.",
    eligibilityRequirements: [
      {
        criterion: "Departmental Enlistment (NIT para 2(a) & Appendix C)",
        requirement:
          "Enlistment with DCW&E in Composite Category (Classes IV, III, II, I, I(A), I(AA), I(AAA), or I(Super)) & under DRDO-2024 BIM Framework (Classes BIM-IV, BIM-III, BIM-II, or BIM-I). Requires clarification on dual vs. alternative enlistment.",
        isMandatory: true,
        criteriaKey: "departmentalEnlistment",
        requirementType: "enlistment",
        expectedValue: {
          conjunction: "&",
          dcweEnlistment: {
            category: "Composite",
            classesPermitted: [
              "Class IV",
              "Class III",
              "Class II",
              "Class I",
              "Class I(A)",
              "Class I(AA)",
              "Class I(AAA)",
              "Class I(Super)"
            ]
          },
          drdoBimEnlistment: {
            framework: "DRDO-2024 BIM",
            classesPermitted: ["BIM-IV", "BIM-III", "BIM-II", "BIM-I"]
          },
          clarificationRequired:
            "Relationship between DCW&E and DRDO-2024 BIM enlistment requires clarification from procuring authority"
        },
        verificationStatus: "needs_verification"
      },
      {
        criterion: "Similar Work Term Contract (Appendix C)",
        requirement:
          "Satisfactorily completed term contracts for day-to-day maintenance services in high-altitude areas strictly above 6,500 ft MSL conforming to CPWD DSR within the last 7 years: 1 work ≥ ₹27,02,857 (80%), 2 works ≥ ₹16,89,286 (50%), or 3 works ≥ ₹13,51,428 (40%). Certificates must state work duration and value. Enhanced at simple rate of 7% per annum from completion date to 27 Nov 2026.",
        isMandatory: true,
        criteriaKey: "similarTermContractWorks",
        requirementType: "experience",
        expectedValue: {
          mustBeTermContract: true,
          highAltitudeStrictlyAbove6500Feet: true,
          altitudeRule: "strictly above 6,500 feet MSL (> 6,500 ft MSL)",
          coveredByCPWDDSR: true,
          requiresWorkDurationAndValueInCertificate: true,
          escalationMethod: "simple_rate_of_7_percent_per_annum",
          escalationCutoffDate: "2026-11-27",
          qualifyingThresholds: [
            { count: 1, percentage: 80, minWorkValue: 2702857 },
            { count: 2, percentage: 50, minWorkValue: 1689286 },
            { count: 3, percentage: 40, minWorkValue: 1351428 }
          ]
        },
        verificationStatus: "needs_verification"
      },
      {
        criterion: "Annual Turnover (Appendix C)",
        requirement:
          "Average annual turnover of at least ₹10.14 lakh over the specified last three financial years (enhanced at simple rate of 7% per annum).",
        isMandatory: true,
        criteriaKey: "minAnnualTurnover",
        requirementType: "turnover",
        expectedValue: {
          minAverageTurnover: 1014000,
          yearsConsidered: 3,
          escalationRatePerAnnum: 0.07,
          escalationMethod: "simple_rate_of_7_percent_per_annum"
        },
        verificationStatus: "needs_verification"
      },
      {
        criterion: "Financial Soundness & Solvency (Appendix C)",
        requirement:
          "Not more than two loss-making financial years during the specified last five financial years.",
        isMandatory: true,
        criteriaKey: "maxLossYears",
        requirementType: "solvency",
        expectedValue: {
          maxPermissibleLossYears: 2,
          yearsEvaluated: 5
        },
        verificationStatus: "needs_verification"
      },
      {
        criterion: "Available Bidding Capacity (Appendix C)",
        requirement:
          "Available Bid Capacity = (A * N * 2) - B must be at least ₹33,78,571, where A is maximum construction works executed in any one year during last 5 years (completed + WIP) at simple rate of 7% per annum, N = 1 year, and B is ongoing commitments in next 12 months. Supported by Annexure VIII declaration, 5-year CA turnover with UDIN, LOI/work orders, and CA-certified commitments.",
        isMandatory: true,
        criteriaKey: "availableBidCapacity",
        requirementType: "bidding_capacity",
        expectedValue: {
          formula: "(A * N * 2) - B",
          minimumCapacityRequired: 3378571,
          completionPeriodYearsN: 1,
          definitionA:
            "Maximum value of construction works executed in any one year during last 5 years (completed + WIP) enhanced at simple rate of 7% per annum",
          definitionB:
            "Value of existing commitments and ongoing works to be completed during next 12 months",
          documentationRequired: [
            "Annexure VIII bidding-capacity declaration",
            "Turnover records for last 5 years signed by CA with UDIN",
            "LOI / work orders for works considered in calculation",
            "CA-certified existing commitments and ongoing works"
          ]
        },
        verificationStatus: "needs_verification"
      }
    ],
    requiredSubmissionDocuments: [
      {
        documentName: "Terms and Conditions Undertaking",
        description: "As specified in Table A of the tender notice.",
        isMandatory: true
      },
      {
        documentName: "Original EMD and Hard-Copy Submission",
        description: "Receipt/instrument of EMD and physical submission of hard copy.",
        isMandatory: true
      },
      {
        documentName: "Similar Work Completion and Performance Certificates",
        description:
          "Certificates containing work duration and value as specified in Table A and Appendix C.",
        isMandatory: true
      },
      {
        documentName: "Bidding Capacity Supporting Documents (Annexure VIII)",
        description:
          "Annexure VIII declaration, 5-year CA-certified turnover with UDIN, LOI/work orders, and CA-certified ongoing commitments.",
        isMandatory: true
      },
      {
        documentName: "Five-Year Audited Turnover Records (Table A)",
        description:
          "Audited turnover records for the last 5 financial years with statutory auditor certification and profit-and-loss details.",
        isMandatory: true
      },
      {
        documentName: "Banned Business Undertaking",
        description: "As specified in Table A of the tender notice.",
        isMandatory: true
      },
      {
        documentName: "Foreign National Partner Undertaking",
        description: "As specified in Table A of the tender notice.",
        isMandatory: true
      },
      {
        documentName: "Joint Venture / Consortium Undertaking",
        description: "As specified in Table A of the tender notice.",
        isMandatory: true
      }
    ],
    contractComplianceRequirements: [
      {
        complianceItem: "Labour Commissioner Registration",
        authority:
          "Office of the Labour Commissioner / Licensing Officer (Contract Labour Act, 1970)",
        requirementDetails: "Valid registration certificate and copy must be provided."
      },
      {
        complianceItem: "Employees' Provident Fund (EPF / PF) Registration",
        authority: "Employees' Provident Fund Organisation (EPFO)",
        requirementDetails: "Valid registration certificate and copy must be provided."
      },
      {
        complianceItem: "Employees' State Insurance (ESIC) Registration",
        authority: "Employees' State Insurance Corporation",
        requirementDetails: "Valid registration certificate and copy must be provided."
      }
    ]
  },
];

/**
 * Returns all demonstration tenders.
 */
export function getAllTenders() {
  return DEMO_TENDERS;
}

/**
 * Finds a demonstration tender by its ID.
 * Returns undefined if no match is found.
 */
export function getTenderById(id) {
  if (!id) return undefined;
  return DEMO_TENDERS.find((tender) => tender.id.toLowerCase() === id.toLowerCase());
}
