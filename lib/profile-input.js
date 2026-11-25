import { normalizeEmail } from "./user-input.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PINCODE_PATTERN = /^\d{6}$/;
const PHONE_PATTERN = /^[\d\s+\-()]{7,20}$/;
const FINANCIAL_YEAR_PATTERN = /^\d{4}-\d{4}$/;
const MSME_CATEGORIES = new Set(["Micro", "Small", "Medium"]);

const ALLOWED_PROFILE_KEYS = new Set([
  "legalName",
  "tradeName",
  "udyamRegistrationNumber",
  "msmeCategory",
  "constitutionType",
  "dateOfIncorporation",
  "industry",
  "businessDescription",
  "registeredAddress",
  "city",
  "state",
  "pincode",
  "contactPerson",
  "contactPhone",
  "contactEmail",
  "businessWebsite",
  "departmentalEnlistments",
  "financialRecords",
  "auditorName",
  "auditorUDIN",
  "completedWorks",
  "ongoingWorks",
  "availableBidCapacity",
  "biddingCapacityDeclarationReference",
]);

const FORBIDDEN_PRIVILEGED_KEYS = new Set([
  "_id",
  "userId",
  "role",
  "profileVerificationStatus",
  "lastVerifiedAt",
  "financialVerificationStatus",
  "biddingCapacityVerificationStatus",
  "createdAt",
  "updatedAt",
  "__v",
]);

function parseIsoDate(val, fieldName) {
  if (val === null || val === undefined || val === "") {
    return null;
  }
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date format for ${fieldName}.`);
  }
  return d;
}

function parseNonNegativeNumber(val, fieldName) {
  if (val === null || val === undefined || val === "") {
    return 0;
  }
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }
  return num;
}

function parseNumber(val, fieldName) {
  if (val === null || val === undefined || val === "") {
    return 0;
  }
  const num = Number(val);
  if (!Number.isFinite(num)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }
  return num;
}

function sanitizeString(val, maxLength = 255) {
  if (typeof val !== "string") {
    return "";
  }
  return val.trim().slice(0, maxLength);
}

/**
 * Validate and sanitize departmental enlistments array.
 * Enforces "self_declared" status on every subdocument.
 */
function validateEnlistments(enlistments) {
  if (!Array.isArray(enlistments)) {
    return { ok: false, error: "Departmental enlistments must be an array." };
  }

  const allowedSubKeys = new Set([
    "authority",
    "registrationClass",
    "registrationNumber",
    "validityStartDate",
    "validityEndDate",
    "verificationReference",
  ]);

  const clean = [];
  for (let i = 0; i < enlistments.length; i++) {
    const item = enlistments[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: `Invalid enlistment record at index ${i}.` };
    }

    for (const key of Object.keys(item)) {
      if (key === "verificationStatus" || key === "_id") {
        return {
          ok: false,
          error: `Client cannot set privileged field "${key}" on enlistment at index ${i}.`,
        };
      }
      if (!allowedSubKeys.has(key)) {
        return { ok: false, error: `Unrecognized field "${key}" on enlistment at index ${i}.` };
      }
    }

    const authority = sanitizeString(item.authority, 150);
    const registrationClass = sanitizeString(item.registrationClass, 50);
    const registrationNumber = sanitizeString(item.registrationNumber, 100);

    if (!authority || !registrationClass || !registrationNumber) {
      return {
        ok: false,
        error: `Enlistment at index ${i} requires authority, registrationClass, and registrationNumber.`,
      };
    }

    let validityStartDate = null;
    let validityEndDate = null;
    try {
      validityStartDate = parseIsoDate(item.validityStartDate, `validityStartDate [index ${i}]`);
      validityEndDate = parseIsoDate(item.validityEndDate, `validityEndDate [index ${i}]`);
    } catch (err) {
      return { ok: false, error: err.message };
    }

    if (validityStartDate && validityEndDate && validityEndDate < validityStartDate) {
      return {
        ok: false,
        error: `Enlistment at index ${i} has validityEndDate earlier than validityStartDate.`,
      };
    }

    clean.push({
      authority,
      registrationClass,
      registrationNumber,
      validityStartDate,
      validityEndDate,
      verificationReference: sanitizeString(item.verificationReference, 200),
      verificationStatus: "self_declared",
    });
  }

  return { ok: true, data: clean };
}

/**
 * Validate and sanitize financial records array.
 * Enforces "self_declared" status on every subdocument.
 */
function validateFinancialRecords(records) {
  if (!Array.isArray(records)) {
    return { ok: false, error: "Financial records must be an array." };
  }

  const allowedSubKeys = new Set([
    "financialYear",
    "annualTurnover",
    "profitAfterTax",
    "lossStatus",
    "verificationReference",
  ]);

  const clean = [];
  for (let i = 0; i < records.length; i++) {
    const item = records[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: `Invalid financial record at index ${i}.` };
    }

    for (const key of Object.keys(item)) {
      if (key === "verificationStatus" || key === "_id") {
        return {
          ok: false,
          error: `Client cannot set privileged field "${key}" on financial record at index ${i}.`,
        };
      }
      if (!allowedSubKeys.has(key)) {
        return { ok: false, error: `Unrecognized field "${key}" on financial record at index ${i}.` };
      }
    }

    const financialYear = sanitizeString(item.financialYear, 20);
    if (!FINANCIAL_YEAR_PATTERN.test(financialYear)) {
      return {
        ok: false,
        error: `Financial record at index ${i} has invalid financialYear "${financialYear}". Expected YYYY-YYYY format.`,
      };
    }

    let annualTurnover = 0;
    let profitAfterTax = 0;
    try {
      annualTurnover = parseNonNegativeNumber(item.annualTurnover, `annualTurnover [index ${i}]`);
      profitAfterTax = parseNumber(item.profitAfterTax, `profitAfterTax [index ${i}]`);
    } catch (err) {
      return { ok: false, error: err.message };
    }

    const hasProfitAfterTax =
      item.profitAfterTax !== null &&
      item.profitAfterTax !== undefined &&
      item.profitAfterTax !== "";

    let lossStatus;
    if (hasProfitAfterTax) {
      lossStatus = profitAfterTax < 0;
    } else if (typeof item.lossStatus === "boolean") {
      lossStatus = item.lossStatus;
    } else {
      lossStatus = false;
    }

    clean.push({
      financialYear,
      annualTurnover,
      profitAfterTax,
      lossStatus,
      verificationReference: sanitizeString(item.verificationReference, 200),
      verificationStatus: "self_declared",
    });
  }

  return { ok: true, data: clean };
}

/**
 * Validate and sanitize completed works array.
 * Enforces "self_declared" status on every subdocument.
 */
function validateCompletedWorks(works) {
  if (!Array.isArray(works)) {
    return { ok: false, error: "Completed works must be an array." };
  }

  const allowedSubKeys = new Set([
    "workTitle",
    "department",
    "workDescription",
    "location",
    "contractValue",
    "actualGrossPayment",
    "startDate",
    "completionDate",
    "completionCertificateReference",
  ]);

  const clean = [];
  for (let i = 0; i < works.length; i++) {
    const item = works[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: `Invalid completed work record at index ${i}.` };
    }

    for (const key of Object.keys(item)) {
      if (key === "verificationStatus" || key === "_id") {
        return {
          ok: false,
          error: `Client cannot set privileged field "${key}" on completed work at index ${i}.`,
        };
      }
      if (!allowedSubKeys.has(key)) {
        return { ok: false, error: `Unrecognized field "${key}" on completed work at index ${i}.` };
      }
    }

    const workTitle = sanitizeString(item.workTitle, 200);
    if (!workTitle) {
      return { ok: false, error: `Completed work at index ${i} requires a workTitle.` };
    }

    let contractValue = 0;
    let actualGrossPayment = 0;
    let startDate = null;
    let completionDate = null;
    try {
      contractValue = parseNonNegativeNumber(item.contractValue, `contractValue [index ${i}]`);
      actualGrossPayment = parseNonNegativeNumber(
        item.actualGrossPayment,
        `actualGrossPayment [index ${i}]`
      );
      startDate = parseIsoDate(item.startDate, `startDate [index ${i}]`);
      completionDate = parseIsoDate(item.completionDate, `completionDate [index ${i}]`);
    } catch (err) {
      return { ok: false, error: err.message };
    }

    if (startDate && completionDate && completionDate < startDate) {
      return {
        ok: false,
        error: `Completed work at index ${i} has completionDate earlier than startDate.`,
      };
    }

    clean.push({
      workTitle,
      department: sanitizeString(item.department, 150),
      workDescription: sanitizeString(item.workDescription, 2000),
      location: sanitizeString(item.location, 200),
      contractValue,
      actualGrossPayment,
      startDate,
      completionDate,
      completionCertificateReference: sanitizeString(item.completionCertificateReference, 200),
      verificationStatus: "self_declared",
    });
  }

  return { ok: true, data: clean };
}

/**
 * Validate and sanitize ongoing works array.
 * Enforces "self_declared" status on every subdocument.
 */
function validateOngoingWorks(works) {
  if (!Array.isArray(works)) {
    return { ok: false, error: "Ongoing works must be an array." };
  }

  const allowedSubKeys = new Set([
    "workTitle",
    "department",
    "contractValue",
    "remainingValue",
    "expectedCompletionDate",
  ]);

  const clean = [];
  for (let i = 0; i < works.length; i++) {
    const item = works[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: `Invalid ongoing work record at index ${i}.` };
    }

    for (const key of Object.keys(item)) {
      if (key === "verificationStatus" || key === "_id") {
        return {
          ok: false,
          error: `Client cannot set privileged field "${key}" on ongoing work at index ${i}.`,
        };
      }
      if (!allowedSubKeys.has(key)) {
        return { ok: false, error: `Unrecognized field "${key}" on ongoing work at index ${i}.` };
      }
    }

    const workTitle = sanitizeString(item.workTitle, 200);
    if (!workTitle) {
      return { ok: false, error: `Ongoing work at index ${i} requires a workTitle.` };
    }

    let contractValue = 0;
    let remainingValue = 0;
    let expectedCompletionDate = null;
    try {
      contractValue = parseNonNegativeNumber(item.contractValue, `contractValue [index ${i}]`);
      remainingValue = parseNonNegativeNumber(item.remainingValue, `remainingValue [index ${i}]`);
      expectedCompletionDate = parseIsoDate(
        item.expectedCompletionDate,
        `expectedCompletionDate [index ${i}]`
      );
    } catch (err) {
      return { ok: false, error: err.message };
    }

    clean.push({
      workTitle,
      department: sanitizeString(item.department, 150),
      contractValue,
      remainingValue,
      expectedCompletionDate,
      verificationStatus: "self_declared",
    });
  }

  return { ok: true, data: clean };
}

/**
 * Validate incoming company profile payload for POST or PUT requests.
 *
 * @param {object} body - Request JSON body
 * @param {boolean} isUpdate - True if PUT request (partial updates permitted)
 * @returns {{ ok: boolean, status?: number, error?: string, data?: object }}
 */
export function validateProfileInput(body, isUpdate = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Invalid request body." };
  }

  // 1. Check for privileged / forbidden keys
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_PRIVILEGED_KEYS.has(key)) {
      return {
        ok: false,
        status: 400,
        error: `Field "${key}" is protected and cannot be submitted or altered by client.`,
      };
    }
    if (!ALLOWED_PROFILE_KEYS.has(key)) {
      return {
        ok: false,
        status: 400,
        error: `Unrecognized field "${key}" rejected. Mass assignment is prohibited.`,
      };
    }
  }

  const data = {};

  // 2. Validate Company Identity
  if (!isUpdate || Object.prototype.hasOwnProperty.call(body, "legalName")) {
    const legalName = sanitizeString(body.legalName, 200);
    if (!legalName || legalName.length < 2) {
      return { ok: false, status: 400, error: "legalName is required (at least 2 characters)." };
    }
    data.legalName = legalName;
  }

  if (Object.prototype.hasOwnProperty.call(body, "tradeName")) {
    data.tradeName = sanitizeString(body.tradeName, 200);
  }

  if (Object.prototype.hasOwnProperty.call(body, "udyamRegistrationNumber")) {
    data.udyamRegistrationNumber = sanitizeString(body.udyamRegistrationNumber, 50);
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(body, "msmeCategory")) {
    const category = typeof body.msmeCategory === "string" ? body.msmeCategory.trim() : "";
    if (!MSME_CATEGORIES.has(category)) {
      return {
        ok: false,
        status: 400,
        error: "msmeCategory must be one of: Micro, Small, Medium.",
      };
    }
    data.msmeCategory = category;
  }

  if (Object.prototype.hasOwnProperty.call(body, "constitutionType")) {
    data.constitutionType = sanitizeString(body.constitutionType, 100);
  }

  if (Object.prototype.hasOwnProperty.call(body, "dateOfIncorporation")) {
    try {
      data.dateOfIncorporation = parseIsoDate(body.dateOfIncorporation, "dateOfIncorporation");
    } catch (err) {
      return { ok: false, status: 400, error: err.message };
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "industry")) {
    data.industry = sanitizeString(body.industry, 150);
  }

  if (Object.prototype.hasOwnProperty.call(body, "businessDescription")) {
    data.businessDescription = sanitizeString(body.businessDescription, 2000);
  }

  // 3. Validate Contact and Address
  if (!isUpdate || Object.prototype.hasOwnProperty.call(body, "registeredAddress")) {
    const addr = sanitizeString(body.registeredAddress, 500);
    if (!addr) {
      return { ok: false, status: 400, error: "registeredAddress is required." };
    }
    data.registeredAddress = addr;
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(body, "city")) {
    const city = sanitizeString(body.city, 100);
    if (!city) {
      return { ok: false, status: 400, error: "city is required." };
    }
    data.city = city;
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(body, "state")) {
    const state = sanitizeString(body.state, 100);
    if (!state) {
      return { ok: false, status: 400, error: "state is required." };
    }
    data.state = state;
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(body, "pincode")) {
    const pincode = sanitizeString(body.pincode, 10);
    if (!PINCODE_PATTERN.test(pincode)) {
      return { ok: false, status: 400, error: "pincode must be a 6-digit Indian postal code." };
    }
    data.pincode = pincode;
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(body, "contactPerson")) {
    const cp = sanitizeString(body.contactPerson, 100);
    if (!cp) {
      return { ok: false, status: 400, error: "contactPerson is required." };
    }
    data.contactPerson = cp;
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(body, "contactPhone")) {
    const phone = sanitizeString(body.contactPhone, 20);
    if (!PHONE_PATTERN.test(phone)) {
      return { ok: false, status: 400, error: "contactPhone must be a valid phone number (7-20 digits)." };
    }
    data.contactPhone = phone;
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(body, "contactEmail")) {
    const email = normalizeEmail(body.contactEmail);
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return { ok: false, status: 400, error: "contactEmail must be a valid email address." };
    }
    data.contactEmail = email;
  }

  if (Object.prototype.hasOwnProperty.call(body, "businessWebsite")) {
    data.businessWebsite = sanitizeString(body.businessWebsite, 255);
  }

  // 4. Validate Departmental Enlistments
  if (Object.prototype.hasOwnProperty.call(body, "departmentalEnlistments")) {
    const enlistmentResult = validateEnlistments(body.departmentalEnlistments);
    if (!enlistmentResult.ok) {
      return { ok: false, status: 400, error: enlistmentResult.error };
    }
    data.departmentalEnlistments = enlistmentResult.data;
  }

  // 5. Validate Financial Information
  if (Object.prototype.hasOwnProperty.call(body, "financialRecords")) {
    const financialResult = validateFinancialRecords(body.financialRecords);
    if (!financialResult.ok) {
      return { ok: false, status: 400, error: financialResult.error };
    }
    data.financialRecords = financialResult.data;
  }

  if (Object.prototype.hasOwnProperty.call(body, "auditorName")) {
    data.auditorName = sanitizeString(body.auditorName, 100);
  }

  if (Object.prototype.hasOwnProperty.call(body, "auditorUDIN")) {
    data.auditorUDIN = sanitizeString(body.auditorUDIN, 50);
  }

  // 6. Validate Completed Works
  if (Object.prototype.hasOwnProperty.call(body, "completedWorks")) {
    const worksResult = validateCompletedWorks(body.completedWorks);
    if (!worksResult.ok) {
      return { ok: false, status: 400, error: worksResult.error };
    }
    data.completedWorks = worksResult.data;
  }

  // 7. Validate Ongoing Works and Bidding Commitments
  if (Object.prototype.hasOwnProperty.call(body, "ongoingWorks")) {
    const ongoingResult = validateOngoingWorks(body.ongoingWorks);
    if (!ongoingResult.ok) {
      return { ok: false, status: 400, error: ongoingResult.error };
    }
    data.ongoingWorks = ongoingResult.data;
  }

  if (Object.prototype.hasOwnProperty.call(body, "availableBidCapacity")) {
    if (body.availableBidCapacity === null || body.availableBidCapacity === undefined || body.availableBidCapacity === "") {
      data.availableBidCapacity = null;
    } else {
      const value = body.availableBidCapacity;
      if (
        (typeof value !== "number" && typeof value !== "string") ||
        (typeof value === "string" && value.trim() === "")
      ) {
        return { ok: false, status: 400, error: "availableBidCapacity must be a valid number." };
      }

      const num = Number(value);
      if (!Number.isFinite(num)) {
        return { ok: false, status: 400, error: "availableBidCapacity must be a valid number." };
      }
      if (num < 0) {
        return {
          ok: false,
          status: 400,
          error: "availableBidCapacity must be a non-negative number.",
        };
      }
      data.availableBidCapacity = num;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "biddingCapacityDeclarationReference")) {
    data.biddingCapacityDeclarationReference = sanitizeString(
      body.biddingCapacityDeclarationReference,
      200
    );
  }

  return { ok: true, data };
}
