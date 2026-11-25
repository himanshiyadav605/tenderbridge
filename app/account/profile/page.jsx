"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProfileVerificationBadge from "../../../components/ProfileVerificationBadge";
import { calculateProfileCompletion } from "../../../lib/profile-completion";

const SECTIONS = [
  { id: "company", label: "A. Company Info", short: "Company" },
  { id: "contact", label: "B. Contact & Address", short: "Contact" },
  { id: "enlistments", label: "C. Enlistments", short: "Enlistments" },
  { id: "financials", label: "D. Financials", short: "Financials" },
  { id: "completedWorks", label: "E. Completed Works", short: "Completed" },
  { id: "ongoingWorks", label: "F. Ongoing Works", short: "Ongoing" },
  { id: "bidding", label: "G. Bidding Capacity", short: "Bidding" },
];

function formatDateForInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function emptyProfileState() {
  return {
    legalName: "",
    tradeName: "",
    udyamRegistrationNumber: "",
    msmeCategory: "Small",
    constitutionType: "",
    dateOfIncorporation: "",
    industry: "",
    businessDescription: "",
    registeredAddress: "",
    city: "",
    state: "",
    pincode: "",
    contactPerson: "",
    contactPhone: "",
    contactEmail: "",
    businessWebsite: "",
    departmentalEnlistments: [],
    financialRecords: [],
    auditorName: "",
    auditorUDIN: "",
    completedWorks: [],
    ongoingWorks: [],
    availableBidCapacity: "",
    biddingCapacityDeclarationReference: "",
    // Read-only verification metadata stored from server
    profileVerificationStatus: "self_declared",
    financialVerificationStatus: "self_declared",
    biddingCapacityVerificationStatus: "self_declared",
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("company");
  const [formData, setFormData] = useState(emptyProfileState());
  const [isEdit, setIsEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // 1. Load existing profile on mount
  useEffect(() => {
    let isMounted = true;

    async function fetchProfile() {
      try {
        setLoading(true);
        setErrorMessage("");
        const res = await fetch("/api/profile");
        if (res.status === 401) {
          router.push("/login?error=expired");
          return;
        }
        if (!res.ok) {
          throw new Error("Failed to load company profile. Please try again.");
        }
        const data = await res.json();
        if (isMounted) {
          if (data.profile) {
            setIsEdit(true);
            setFormData({
              legalName: data.profile.legalName || "",
              tradeName: data.profile.tradeName || "",
              udyamRegistrationNumber: data.profile.udyamRegistrationNumber || "",
              msmeCategory: data.profile.msmeCategory || "Small",
              constitutionType: data.profile.constitutionType || "",
              dateOfIncorporation: formatDateForInput(data.profile.dateOfIncorporation),
              industry: data.profile.industry || "",
              businessDescription: data.profile.businessDescription || "",
              registeredAddress: data.profile.registeredAddress || "",
              city: data.profile.city || "",
              state: data.profile.state || "",
              pincode: data.profile.pincode || "",
              contactPerson: data.profile.contactPerson || "",
              contactPhone: data.profile.contactPhone || "",
              contactEmail: data.profile.contactEmail || "",
              businessWebsite: data.profile.businessWebsite || "",
              departmentalEnlistments: Array.isArray(data.profile.departmentalEnlistments)
                ? data.profile.departmentalEnlistments.map((item) => ({
                    ...item,
                    validityStartDate: formatDateForInput(item.validityStartDate),
                    validityEndDate: formatDateForInput(item.validityEndDate),
                  }))
                : [],
              financialRecords: Array.isArray(data.profile.financialRecords)
                ? data.profile.financialRecords.map((item) => ({
                    ...item,
                    annualTurnover: item.annualTurnover ?? 0,
                    profitAfterTax: item.profitAfterTax ?? 0,
                  }))
                : [],
              auditorName: data.profile.auditorName || "",
              auditorUDIN: data.profile.auditorUDIN || "",
              completedWorks: Array.isArray(data.profile.completedWorks)
                ? data.profile.completedWorks.map((item) => ({
                    ...item,
                    contractValue: item.contractValue ?? 0,
                    actualGrossPayment: item.actualGrossPayment ?? 0,
                    startDate: formatDateForInput(item.startDate),
                    completionDate: formatDateForInput(item.completionDate),
                  }))
                : [],
              ongoingWorks: Array.isArray(data.profile.ongoingWorks)
                ? data.profile.ongoingWorks.map((item) => ({
                    ...item,
                    contractValue: item.contractValue ?? 0,
                    remainingValue: item.remainingValue ?? 0,
                    expectedCompletionDate: formatDateForInput(item.expectedCompletionDate),
                  }))
                : [],
              availableBidCapacity:
                data.profile.availableBidCapacity !== null &&
                data.profile.availableBidCapacity !== undefined
                  ? String(data.profile.availableBidCapacity)
                  : "",
              biddingCapacityDeclarationReference:
                data.profile.biddingCapacityDeclarationReference || "",
              profileVerificationStatus: data.profile.profileVerificationStatus || "self_declared",
              financialVerificationStatus:
                data.profile.financialVerificationStatus || "self_declared",
              biddingCapacityVerificationStatus:
                data.profile.biddingCapacityVerificationStatus || "self_declared",
            });
          } else {
            setIsEdit(false);
          }
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage(err.message || "An unexpected error occurred.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // Form field changes
  function handleFieldChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  // --- Subdocument Array Handlers ---

  // 1. Departmental Enlistments
  function addEnlistment() {
    setFormData((prev) => ({
      ...prev,
      departmentalEnlistments: [
        ...prev.departmentalEnlistments,
        {
          authority: "",
          registrationClass: "",
          registrationNumber: "",
          validityStartDate: "",
          validityEndDate: "",
          verificationReference: "",
          verificationStatus: "self_declared",
        },
      ],
    }));
  }

  function removeEnlistment(index) {
    setFormData((prev) => ({
      ...prev,
      departmentalEnlistments: prev.departmentalEnlistments.filter((_, i) => i !== index),
    }));
  }

  function updateEnlistment(index, field, value) {
    setFormData((prev) => {
      const updated = [...prev.departmentalEnlistments];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, departmentalEnlistments: updated };
    });
  }

  // 2. Financial Records
  function addFinancialRecord() {
    setFormData((prev) => ({
      ...prev,
      financialRecords: [
        ...prev.financialRecords,
        {
          financialYear: "",
          annualTurnover: "",
          profitAfterTax: "",
          verificationReference: "",
          verificationStatus: "self_declared",
        },
      ],
    }));
  }

  function removeFinancialRecord(index) {
    setFormData((prev) => ({
      ...prev,
      financialRecords: prev.financialRecords.filter((_, i) => i !== index),
    }));
  }

  function updateFinancialRecord(index, field, value) {
    setFormData((prev) => {
      const updated = [...prev.financialRecords];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, financialRecords: updated };
    });
  }

  // 3. Completed Works
  function addCompletedWork() {
    setFormData((prev) => ({
      ...prev,
      completedWorks: [
        ...prev.completedWorks,
        {
          workTitle: "",
          department: "",
          workDescription: "",
          location: "",
          contractValue: "",
          actualGrossPayment: "",
          startDate: "",
          completionDate: "",
          completionCertificateReference: "",
          verificationStatus: "self_declared",
        },
      ],
    }));
  }

  function removeCompletedWork(index) {
    setFormData((prev) => ({
      ...prev,
      completedWorks: prev.completedWorks.filter((_, i) => i !== index),
    }));
  }

  function updateCompletedWork(index, field, value) {
    setFormData((prev) => {
      const updated = [...prev.completedWorks];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, completedWorks: updated };
    });
  }

  // 4. Ongoing Works
  function addOngoingWork() {
    setFormData((prev) => ({
      ...prev,
      ongoingWorks: [
        ...prev.ongoingWorks,
        {
          workTitle: "",
          department: "",
          contractValue: "",
          remainingValue: "",
          expectedCompletionDate: "",
          verificationStatus: "self_declared",
        },
      ],
    }));
  }

  function removeOngoingWork(index) {
    setFormData((prev) => ({
      ...prev,
      ongoingWorks: prev.ongoingWorks.filter((_, i) => i !== index),
    }));
  }

  function updateOngoingWork(index, field, value) {
    setFormData((prev) => {
      const updated = [...prev.ongoingWorks];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, ongoingWorks: updated };
    });
  }

  // Client-side validation
  function validateForm() {
    const errors = {};

    if (!formData.legalName || formData.legalName.trim().length < 2) {
      errors.legalName = "Legal company name is required (at least 2 characters).";
    }
    if (!["Micro", "Small", "Medium"].includes(formData.msmeCategory)) {
      errors.msmeCategory = "Please select a valid MSME category.";
    }
    if (!formData.registeredAddress || formData.registeredAddress.trim().length === 0) {
      errors.registeredAddress = "Registered address is required.";
    }
    if (!formData.city || formData.city.trim().length === 0) {
      errors.city = "City is required.";
    }
    if (!formData.state || formData.state.trim().length === 0) {
      errors.state = "State is required.";
    }
    if (!formData.pincode || !/^\d{6}$/.test(formData.pincode.trim())) {
      errors.pincode = "PIN code must be exactly 6 digits.";
    }
    if (!formData.contactPerson || formData.contactPerson.trim().length === 0) {
      errors.contactPerson = "Contact person name is required.";
    }
    if (!formData.contactPhone || formData.contactPhone.trim().length < 7) {
      errors.contactPhone = "Valid contact phone number is required (at least 7 digits).";
    }
    if (!formData.contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail.trim())) {
      errors.contactEmail = "Valid contact email address is required.";
    }

    // Enlistments chronology
    for (let i = 0; i < formData.departmentalEnlistments.length; i++) {
      const item = formData.departmentalEnlistments[i];
      if (item.validityStartDate && item.validityEndDate && item.validityEndDate < item.validityStartDate) {
        errors[`enlistment_${i}`] = `Enlistment #${i + 1}: Validity End Date cannot be earlier than Start Date.`;
      }
    }

    // Financial year pattern
    for (let i = 0; i < formData.financialRecords.length; i++) {
      const item = formData.financialRecords[i];
      if (item.financialYear && !/^\d{4}-\d{4}$/.test(item.financialYear.trim())) {
        errors[`financial_${i}`] = `Financial Record #${i + 1}: Financial Year must follow the format YYYY-YYYY (e.g. 2024-2025).`;
      }
    }

    // Completed works chronology
    for (let i = 0; i < formData.completedWorks.length; i++) {
      const item = formData.completedWorks[i];
      if (item.startDate && item.completionDate && item.completionDate < item.startDate) {
        errors[`completed_${i}`] = `Completed Work #${i + 1}: Completion Date cannot be earlier than Start Date.`;
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Form submission
  async function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!validateForm()) {
      setErrorMessage("Please resolve the highlighted validation errors before saving.");
      return;
    }

    setSubmitting(true);

    try {
      // Build clean payload stripping privileged verification fields and _id
      const payload = {
        legalName: formData.legalName.trim(),
        tradeName: formData.tradeName.trim(),
        udyamRegistrationNumber: formData.udyamRegistrationNumber.trim(),
        msmeCategory: formData.msmeCategory,
        constitutionType: formData.constitutionType.trim(),
        dateOfIncorporation: formData.dateOfIncorporation || null,
        industry: formData.industry.trim(),
        businessDescription: formData.businessDescription.trim(),
        registeredAddress: formData.registeredAddress.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim(),
        contactPerson: formData.contactPerson.trim(),
        contactPhone: formData.contactPhone.trim(),
        contactEmail: formData.contactEmail.trim(),
        businessWebsite: formData.businessWebsite.trim(),
        departmentalEnlistments: formData.departmentalEnlistments.map((item) => ({
          authority: item.authority.trim(),
          registrationClass: item.registrationClass.trim(),
          registrationNumber: item.registrationNumber.trim(),
          validityStartDate: item.validityStartDate || null,
          validityEndDate: item.validityEndDate || null,
          verificationReference: (item.verificationReference || "").trim(),
        })),
        financialRecords: formData.financialRecords.map((item) => ({
          financialYear: item.financialYear.trim(),
          annualTurnover: item.annualTurnover === "" ? 0 : Number(item.annualTurnover),
          profitAfterTax: item.profitAfterTax === "" ? 0 : Number(item.profitAfterTax),
          verificationReference: (item.verificationReference || "").trim(),
        })),
        auditorName: formData.auditorName.trim(),
        auditorUDIN: formData.auditorUDIN.trim(),
        completedWorks: formData.completedWorks.map((item) => ({
          workTitle: item.workTitle.trim(),
          department: (item.department || "").trim(),
          workDescription: (item.workDescription || "").trim(),
          location: (item.location || "").trim(),
          contractValue: item.contractValue === "" ? 0 : Number(item.contractValue),
          actualGrossPayment: item.actualGrossPayment === "" ? 0 : Number(item.actualGrossPayment),
          startDate: item.startDate || null,
          completionDate: item.completionDate || null,
          completionCertificateReference: (item.completionCertificateReference || "").trim(),
        })),
        ongoingWorks: formData.ongoingWorks.map((item) => ({
          workTitle: item.workTitle.trim(),
          department: (item.department || "").trim(),
          contractValue: item.contractValue === "" ? 0 : Number(item.contractValue),
          remainingValue: item.remainingValue === "" ? 0 : Number(item.remainingValue),
          expectedCompletionDate: item.expectedCompletionDate || null,
        })),
        availableBidCapacity:
          formData.availableBidCapacity === ""
            ? null
            : Number(formData.availableBidCapacity),
        biddingCapacityDeclarationReference:
          formData.biddingCapacityDeclarationReference.trim(),
      };

      const method = isEdit ? "PUT" : "POST";
      const res = await fetch("/api/profile", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(result.error || `Failed to ${isEdit ? "update" : "create"} company profile.`);
      }

      setIsEdit(true);
      setSuccessMessage(
        isEdit
          ? "Company profile successfully updated!"
          : "Company profile created and saved successfully!"
      );

      // Scroll to top
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErrorMessage(err.message || "An error occurred while saving your profile.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-center space-x-3 text-green-800">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-800 border-t-transparent" />
          <span className="text-base font-medium">Loading MSME company profile form...</span>
        </div>
      </div>
    );
  }

  const completion = calculateProfileCompletion(formData);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Header Breadcrumb & Title */}
      <div className="border-b border-gray-100 pb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/account" className="hover:text-green-800">
            &larr; Account Dashboard
          </Link>
          <span>/</span>
          <span className="font-medium text-gray-800">
            {isEdit ? "Edit Company Profile" : "Create Company Profile"}
          </span>
        </div>

        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              {isEdit ? "Edit MSME Company Profile" : "Register MSME Company Profile"}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Provide your business credentials, departmental enlistments, and past project experience.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ProfileVerificationBadge status={formData.profileVerificationStatus} />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center rounded-md bg-green-800 px-5 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-green-900 disabled:opacity-60"
            >
              {submitting ? "Saving..." : isEdit ? "Save Changes" : "Create Profile"}
            </button>
          </div>
        </div>
      </div>

      {/* Profile Completion Indicator */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
          <span>Profile Completion</span>
          <span className="text-green-800">{completion.percentage}% Complete</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-green-800 transition-all duration-300"
            style={{ width: `${completion.percentage}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <span>
            {completion.completedCount} of {completion.totalCount} mandatory criteria completed.
          </span>
          <span className="italic">
            Note: Completion percentage reflects entered data and is separate from verification status.
          </span>
        </div>
      </div>

      {/* Success & Error Feedback Alerts */}
      {successMessage ? (
        <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="alert">
          <p className="font-semibold">{successMessage}</p>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
          <p className="font-semibold">{errorMessage}</p>
        </div>
      ) : null}

      {/* Verification Notice Banner */}
      <div className="mt-6 rounded-md border border-blue-100 bg-blue-50/70 p-4 text-xs text-blue-900">
        <p className="font-semibold">Verification Metadata Notice:</p>
        <p className="mt-0.5">
          All newly entered records receive a <span className="font-medium text-blue-800">&quot;Self-Declared&quot;</span> status by default. Official verification badges (<span className="font-medium text-emerald-800">&quot;Verified&quot;</span>) are established via statutory audits and government verification workflows.
        </p>
      </div>

      {/* Section Navigation Tabs */}
      <div className="mt-8 border-b border-gray-200">
        <nav className="-mb-px flex space-x-2 overflow-x-auto pb-1" aria-label="Tabs">
          {SECTIONS.map((sec) => {
            const isActive = activeTab === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveTab(sec.id)}
                className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-green-800 text-green-900 font-semibold"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                {sec.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* FORM SECTIONS */}
      <form onSubmit={handleSubmit} className="mt-6">
        {/* =========================================================================
            SECTION A: COMPANY INFORMATION
           ========================================================================= */}
        {activeTab === "company" && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
            <h2 className="text-lg font-bold text-gray-900">Section A: Company Information</h2>
            <p className="mt-1 text-xs text-gray-500">
              Basic statutory and business identity details of your MSME enterprise.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="legalName" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Legal Entity Name <span className="text-red-600">*</span>
                </label>
                <input
                  id="legalName"
                  name="legalName"
                  type="text"
                  required
                  value={formData.legalName}
                  onChange={handleFieldChange}
                  placeholder="e.g. Himalayan Infra Solutions Pvt Ltd"
                  className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-800 ${
                    fieldErrors.legalName ? "border-red-500 bg-red-50/30" : "border-gray-300"
                  }`}
                />
                {fieldErrors.legalName ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.legalName}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="tradeName" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Trade / Brand Name
                </label>
                <input
                  id="tradeName"
                  name="tradeName"
                  type="text"
                  value={formData.tradeName}
                  onChange={handleFieldChange}
                  placeholder="e.g. Himalayan Infra"
                  className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-800"
                />
              </div>

              <div>
                <label htmlFor="udyamRegistrationNumber" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Udyam Registration Number
                </label>
                <input
                  id="udyamRegistrationNumber"
                  name="udyamRegistrationNumber"
                  type="text"
                  value={formData.udyamRegistrationNumber}
                  onChange={handleFieldChange}
                  placeholder="e.g. UDYAM-AR-00-1234567"
                  className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-800"
                />
              </div>

              <div>
                <label htmlFor="msmeCategory" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  MSME Category <span className="text-red-600">*</span>
                </label>
                <select
                  id="msmeCategory"
                  name="msmeCategory"
                  value={formData.msmeCategory}
                  onChange={handleFieldChange}
                  className="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-800"
                >
                  <option value="Micro">Micro Enterprise</option>
                  <option value="Small">Small Enterprise</option>
                  <option value="Medium">Medium Enterprise</option>
                </select>
              </div>

              <div>
                <label htmlFor="constitutionType" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Constitution Type
                </label>
                <input
                  id="constitutionType"
                  name="constitutionType"
                  type="text"
                  value={formData.constitutionType}
                  onChange={handleFieldChange}
                  placeholder="e.g. Private Limited, Partnership, Proprietorship"
                  className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-800"
                />
              </div>

              <div>
                <label htmlFor="dateOfIncorporation" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Date of Incorporation
                </label>
                <input
                  id="dateOfIncorporation"
                  name="dateOfIncorporation"
                  type="date"
                  value={formData.dateOfIncorporation}
                  onChange={handleFieldChange}
                  className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-800"
                />
              </div>

              <div>
                <label htmlFor="industry" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Industry / Sector
                </label>
                <input
                  id="industry"
                  name="industry"
                  type="text"
                  value={formData.industry}
                  onChange={handleFieldChange}
                  placeholder="e.g. Infrastructure Maintenance"
                  className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="businessDescription" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Business Description
                </label>
                <textarea
                  id="businessDescription"
                  name="businessDescription"
                  rows={3}
                  value={formData.businessDescription}
                  onChange={handleFieldChange}
                  placeholder="Briefly describe your company's core operations, technical capabilities, and services."
                  className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION B: CONTACT AND ADDRESS
           ========================================================================= */}
        {activeTab === "contact" && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
            <h2 className="text-lg font-bold text-gray-900">Section B: Contact & Registered Address</h2>
            <p className="mt-1 text-xs text-gray-500">
              Official communication coordinates and registered office location.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="registeredAddress" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Registered Address <span className="text-red-600">*</span>
                </label>
                <input
                  id="registeredAddress"
                  name="registeredAddress"
                  type="text"
                  required
                  value={formData.registeredAddress}
                  onChange={handleFieldChange}
                  placeholder="Plot/Shop number, Street, Industrial Area"
                  className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-800 ${
                    fieldErrors.registeredAddress ? "border-red-500 bg-red-50/30" : "border-gray-300"
                  }`}
                />
                {fieldErrors.registeredAddress ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.registeredAddress}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="city" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  City <span className="text-red-600">*</span>
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  required
                  value={formData.city}
                  onChange={handleFieldChange}
                  placeholder="e.g. Itanagar"
                  className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-800 ${
                    fieldErrors.city ? "border-red-500 bg-red-50/30" : "border-gray-300"
                  }`}
                />
                {fieldErrors.city ? <p className="mt-1 text-xs text-red-600">{fieldErrors.city}</p> : null}
              </div>

              <div>
                <label htmlFor="state" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  State / Union Territory <span className="text-red-600">*</span>
                </label>
                <input
                  id="state"
                  name="state"
                  type="text"
                  required
                  value={formData.state}
                  onChange={handleFieldChange}
                  placeholder="e.g. Arunachal Pradesh"
                  className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-800 ${
                    fieldErrors.state ? "border-red-500 bg-red-50/30" : "border-gray-300"
                  }`}
                />
                {fieldErrors.state ? <p className="mt-1 text-xs text-red-600">{fieldErrors.state}</p> : null}
              </div>

              <div>
                <label htmlFor="pincode" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  PIN Code <span className="text-red-600">*</span> (6 digits)
                </label>
                <input
                  id="pincode"
                  name="pincode"
                  type="text"
                  maxLength={6}
                  required
                  value={formData.pincode}
                  onChange={handleFieldChange}
                  placeholder="e.g. 791111"
                  className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-800 ${
                    fieldErrors.pincode ? "border-red-500 bg-red-50/30" : "border-gray-300"
                  }`}
                />
                {fieldErrors.pincode ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.pincode}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="contactPerson" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Authorized Contact Person <span className="text-red-600">*</span>
                </label>
                <input
                  id="contactPerson"
                  name="contactPerson"
                  type="text"
                  required
                  value={formData.contactPerson}
                  onChange={handleFieldChange}
                  placeholder="e.g. Tenzing Norbu"
                  className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-800 ${
                    fieldErrors.contactPerson ? "border-red-500 bg-red-50/30" : "border-gray-300"
                  }`}
                />
                {fieldErrors.contactPerson ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.contactPerson}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="contactPhone" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Contact Phone Number <span className="text-red-600">*</span>
                </label>
                <input
                  id="contactPhone"
                  name="contactPhone"
                  type="tel"
                  required
                  value={formData.contactPhone}
                  onChange={handleFieldChange}
                  placeholder="e.g. +91 9436098765"
                  className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-800 ${
                    fieldErrors.contactPhone ? "border-red-500 bg-red-50/30" : "border-gray-300"
                  }`}
                />
                {fieldErrors.contactPhone ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.contactPhone}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="contactEmail" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Official Contact Email <span className="text-red-600">*</span>
                </label>
                <input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  required
                  value={formData.contactEmail}
                  onChange={handleFieldChange}
                  placeholder="e.g. contact@himalayaninfra.com"
                  className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-800 ${
                    fieldErrors.contactEmail ? "border-red-500 bg-red-50/30" : "border-gray-300"
                  }`}
                />
                {fieldErrors.contactEmail ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.contactEmail}</p>
                ) : null}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="businessWebsite" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Business Website
                </label>
                <input
                  id="businessWebsite"
                  name="businessWebsite"
                  type="url"
                  value={formData.businessWebsite}
                  onChange={handleFieldChange}
                  placeholder="https://example.com"
                  className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION C: DEPARTMENTAL ENLISTMENTS
           ========================================================================= */}
        {activeTab === "enlistments" && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Section C: Departmental Enlistments</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Registrations and enlistment classes with government departments (e.g. DCW&E, MES, CPWD).
                </p>
              </div>
              <button
                type="button"
                onClick={addEnlistment}
                className="inline-flex items-center rounded-md border border-green-800 bg-green-50 px-3.5 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-100"
              >
                + Add Enlistment
              </button>
            </div>

            {formData.departmentalEnlistments.length === 0 ? (
              <div className="mt-6 rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                No departmental enlistments recorded. Click &quot;+ Add Enlistment&quot; to add your department credentials.
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                {formData.departmentalEnlistments.map((item, index) => (
                  <div key={index} className="rounded-md border border-gray-200 bg-gray-50/50 p-5">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm text-gray-800">
                          Enlistment #{index + 1}
                        </span>
                        <ProfileVerificationBadge status={item.verificationStatus} size="sm" />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEnlistment(index)}
                        className="text-xs font-medium text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>

                    {fieldErrors[`enlistment_${index}`] ? (
                      <p className="mt-2 text-xs font-medium text-red-600">
                        {fieldErrors[`enlistment_${index}`]}
                      </p>
                    ) : null}

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Authority <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={item.authority}
                          onChange={(e) => updateEnlistment(index, "authority", e.target.value)}
                          placeholder="e.g. DCW&E or MES"
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Registration Class <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={item.registrationClass}
                          onChange={(e) => updateEnlistment(index, "registrationClass", e.target.value)}
                          placeholder="e.g. Class IV"
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Registration Number <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={item.registrationNumber}
                          onChange={(e) => updateEnlistment(index, "registrationNumber", e.target.value)}
                          placeholder="e.g. DCWE-IV-456"
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Validity Start Date
                        </label>
                        <input
                          type="date"
                          value={item.validityStartDate}
                          onChange={(e) => updateEnlistment(index, "validityStartDate", e.target.value)}
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Validity End Date
                        </label>
                        <input
                          type="date"
                          value={item.validityEndDate}
                          onChange={(e) => updateEnlistment(index, "validityEndDate", e.target.value)}
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Verification Reference
                        </label>
                        <input
                          type="text"
                          value={item.verificationReference || ""}
                          onChange={(e) => updateEnlistment(index, "verificationReference", e.target.value)}
                          placeholder="Certificate or Order Ref No."
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            SECTION D: FINANCIAL INFORMATION
           ========================================================================= */}
        {activeTab === "financials" && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-gray-900">Section D: Financial Information</h2>
                  <ProfileVerificationBadge status={formData.financialVerificationStatus} size="sm" />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Annual turnover figures and profit/loss records per financial year.
                </p>
              </div>
              <button
                type="button"
                onClick={addFinancialRecord}
                className="inline-flex items-center rounded-md border border-green-800 bg-green-50 px-3.5 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-100"
              >
                + Add Financial Year
              </button>
            </div>

            {/* Auditor Details */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-md border border-gray-200 bg-gray-50/40 p-4">
              <div>
                <label htmlFor="auditorName" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Statutory Auditor / CA Name
                </label>
                <input
                  id="auditorName"
                  name="auditorName"
                  type="text"
                  value={formData.auditorName}
                  onChange={handleFieldChange}
                  placeholder="e.g. Das & Associates, Chartered Accountants"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                />
              </div>

              <div>
                <label htmlFor="auditorUDIN" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Auditor UDIN
                </label>
                <input
                  id="auditorUDIN"
                  name="auditorUDIN"
                  type="text"
                  value={formData.auditorUDIN}
                  onChange={handleFieldChange}
                  placeholder="e.g. 24987654BBBB22"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                />
              </div>
            </div>

            {formData.financialRecords.length === 0 ? (
              <div className="mt-6 rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                No financial year records added yet. Click &quot;+ Add Financial Year&quot; to enter turnover history.
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                {formData.financialRecords.map((item, index) => {
                  const profitNum = Number(item.profitAfterTax);
                  const isDerivedLoss = Number.isFinite(profitNum) && profitNum < 0;

                  return (
                    <div key={index} className="rounded-md border border-gray-200 bg-gray-50/50 p-5">
                      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-sm text-gray-800">
                            Financial Year: {item.financialYear || `#${index + 1}`}
                          </span>
                          <ProfileVerificationBadge status={item.verificationStatus} size="sm" />
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              isDerivedLoss
                                ? "bg-red-100 text-red-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {isDerivedLoss ? "Loss-making Year" : "Profitable / Break-even"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFinancialRecord(index)}
                          className="text-xs font-medium text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>

                      {fieldErrors[`financial_${index}`] ? (
                        <p className="mt-2 text-xs font-medium text-red-600">
                          {fieldErrors[`financial_${index}`]}
                        </p>
                      ) : null}

                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                            Financial Year <span className="text-red-600">*</span> (YYYY-YYYY)
                          </label>
                          <input
                            type="text"
                            required
                            value={item.financialYear}
                            onChange={(e) => updateFinancialRecord(index, "financialYear", e.target.value)}
                            placeholder="e.g. 2024-2025"
                            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                            Annual Turnover (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.annualTurnover}
                            onChange={(e) => updateFinancialRecord(index, "annualTurnover", e.target.value)}
                            placeholder="0"
                            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                            Profit After Tax (₹)
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={item.profitAfterTax}
                            onChange={(e) => updateFinancialRecord(index, "profitAfterTax", e.target.value)}
                            placeholder="0 (negative for loss)"
                            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                            Audit Reference
                          </label>
                          <input
                            type="text"
                            value={item.verificationReference || ""}
                            onChange={(e) => updateFinancialRecord(index, "verificationReference", e.target.value)}
                            placeholder="e.g. AUDIT-2025"
                            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            SECTION E: COMPLETED WORKS
           ========================================================================= */}
        {activeTab === "completedWorks" && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Section E: Completed Works</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Executed project contracts with completion certificates (qualifying experience).
                </p>
              </div>
              <button
                type="button"
                onClick={addCompletedWork}
                className="inline-flex items-center rounded-md border border-green-800 bg-green-50 px-3.5 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-100"
              >
                + Add Completed Work
              </button>
            </div>

            {formData.completedWorks.length === 0 ? (
              <div className="mt-6 rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                No completed work records added. Click &quot;+ Add Completed Work&quot; to enter past contracts.
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                {formData.completedWorks.map((item, index) => (
                  <div key={index} className="rounded-md border border-gray-200 bg-gray-50/50 p-5">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm text-gray-800">
                          Work #{index + 1}: {item.workTitle || "Untitled"}
                        </span>
                        <ProfileVerificationBadge status={item.verificationStatus} size="sm" />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCompletedWork(index)}
                        className="text-xs font-medium text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>

                    {fieldErrors[`completed_${index}`] ? (
                      <p className="mt-2 text-xs font-medium text-red-600">
                        {fieldErrors[`completed_${index}`]}
                      </p>
                    ) : null}

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Work Title <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={item.workTitle}
                          onChange={(e) => updateCompletedWork(index, "workTitle", e.target.value)}
                          placeholder="e.g. Annual Term Maintenance of Cantonment Buildings"
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Department / Client
                        </label>
                        <input
                          type="text"
                          value={item.department}
                          onChange={(e) => updateCompletedWork(index, "department", e.target.value)}
                          placeholder="e.g. Defense Estate / MES"
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Location
                        </label>
                        <input
                          type="text"
                          value={item.location}
                          onChange={(e) => updateCompletedWork(index, "location", e.target.value)}
                          placeholder="e.g. Tawang, Arunachal Pradesh"
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Contract Value (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.contractValue}
                          onChange={(e) => updateCompletedWork(index, "contractValue", e.target.value)}
                          placeholder="0"
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Actual Gross Payment (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.actualGrossPayment}
                          onChange={(e) => updateCompletedWork(index, "actualGrossPayment", e.target.value)}
                          placeholder="0"
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Contract Start Date
                        </label>
                        <input
                          type="date"
                          value={item.startDate}
                          onChange={(e) => updateCompletedWork(index, "startDate", e.target.value)}
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Actual Completion Date
                        </label>
                        <input
                          type="date"
                          value={item.completionDate}
                          onChange={(e) => updateCompletedWork(index, "completionDate", e.target.value)}
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Completion Certificate Reference
                        </label>
                        <input
                          type="text"
                          value={item.completionCertificateReference}
                          onChange={(e) => updateCompletedWork(index, "completionCertificateReference", e.target.value)}
                          placeholder="Certificate Reference or Order No."
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Work Description
                        </label>
                        <textarea
                          rows={2}
                          value={item.workDescription}
                          onChange={(e) => updateCompletedWork(index, "workDescription", e.target.value)}
                          placeholder="Summary of scope of work performed."
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            SECTION F: ONGOING WORKS & BIDDING COMMITMENTS
           ========================================================================= */}
        {activeTab === "ongoingWorks" && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Section F: Ongoing Works & Bidding Commitments
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Active contracts currently under execution and committed values.
                </p>
              </div>
              <button
                type="button"
                onClick={addOngoingWork}
                className="inline-flex items-center rounded-md border border-green-800 bg-green-50 px-3.5 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-100"
              >
                + Add Ongoing Work
              </button>
            </div>

            {formData.ongoingWorks.length === 0 ? (
              <div className="mt-6 rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                No ongoing work commitments recorded. Click &quot;+ Add Ongoing Work&quot; if your enterprise has active contracts.
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                {formData.ongoingWorks.map((item, index) => (
                  <div key={index} className="rounded-md border border-gray-200 bg-gray-50/50 p-5">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm text-gray-800">
                          Ongoing Work #{index + 1}: {item.workTitle || "Untitled"}
                        </span>
                        <ProfileVerificationBadge status={item.verificationStatus} size="sm" />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOngoingWork(index)}
                        className="text-xs font-medium text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Work Title <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={item.workTitle}
                          onChange={(e) => updateOngoingWork(index, "workTitle", e.target.value)}
                          placeholder="e.g. Barrack Renovation Project"
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Department / Client
                        </label>
                        <input
                          type="text"
                          value={item.department}
                          onChange={(e) => updateOngoingWork(index, "department", e.target.value)}
                          placeholder="e.g. MES Shillong"
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Contract Value (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.contractValue}
                          onChange={(e) => updateOngoingWork(index, "contractValue", e.target.value)}
                          placeholder="0"
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Remaining / Balance Value (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.remainingValue}
                          onChange={(e) => updateOngoingWork(index, "remainingValue", e.target.value)}
                          placeholder="0"
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Expected Completion Date
                        </label>
                        <input
                          type="date"
                          value={item.expectedCompletionDate}
                          onChange={(e) => updateOngoingWork(index, "expectedCompletionDate", e.target.value)}
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-green-800"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            SECTION G: BIDDING CAPACITY
           ========================================================================= */}
        {activeTab === "bidding" && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-900">Section G: Bidding Capacity</h2>
              <ProfileVerificationBadge status={formData.biddingCapacityVerificationStatus} size="sm" />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Assessed available bidding capacity formula declaration (e.g. 2 * A * N - B).
            </p>

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="availableBidCapacity" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Available Bid Capacity (₹)
                </label>
                <input
                  id="availableBidCapacity"
                  name="availableBidCapacity"
                  type="number"
                  step="any"
                  value={formData.availableBidCapacity}
                  onChange={handleFieldChange}
                  placeholder="e.g. 3500000"
                  className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-800"
                />
              </div>

              <div>
                <label htmlFor="biddingCapacityDeclarationReference" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Declaration Reference
                </label>
                <input
                  id="biddingCapacityDeclarationReference"
                  name="biddingCapacityDeclarationReference"
                  type="text"
                  value={formData.biddingCapacityDeclarationReference}
                  onChange={handleFieldChange}
                  placeholder="e.g. CA Certificate Ref No."
                  className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer Navigation & Save Actions */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-6 sm:flex-row">
          <div className="flex items-center gap-2">
            {activeTab !== "company" && (
              <button
                type="button"
                onClick={() => {
                  const idx = SECTIONS.findIndex((s) => s.id === activeTab);
                  if (idx > 0) setActiveTab(SECTIONS[idx - 1].id);
                }}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                &larr; Previous Section
              </button>
            )}

            {activeTab !== "bidding" && (
              <button
                type="button"
                onClick={() => {
                  const idx = SECTIONS.findIndex((s) => s.id === activeTab);
                  if (idx < SECTIONS.length - 1) setActiveTab(SECTIONS[idx + 1].id);
                }}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Next Section &rarr;
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/account"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center rounded-md bg-green-800 px-6 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-green-900 disabled:opacity-60"
            >
              {submitting ? "Saving..." : isEdit ? "Save Profile Changes" : "Submit Company Profile"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
