import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllTenders, getTenderById } from "../../../data/tenders";
import { DEMO_MSME_PROFILE } from "../../../data/msme-profile";
import { evaluateTenderMatch } from "../../../lib/tender-matching";
import { getCurrentUser } from "../../../lib/current-user";
import connectDB from "../../../lib/db";
import MsmeProfile from "../../../models/MsmeProfile";
import { adaptProfileForMatching } from "../../../lib/profile-to-matching";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const RECOGNIZED_CRITERIA_KEYS = new Set([
  "departmentalEnlistment",
  "similarTermContractWorks",
  "minAnnualTurnover",
  "maxLossYears",
  "availableBidCapacity",
]);

function formatDateParts(year, month, day) {
  const monthIndex = Number(month) - 1;
  const monthName = MONTHS[monthIndex];
  if (!monthName) return null;
  return `${Number(day)} ${monthName} ${year}`;
}

function formatTenderDate(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    return formatDateParts(dateOnly[1], dateOnly[2], dateOnly[3]) ?? value;
  }
  const dateTime = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(
    trimmed
  );
  if (dateTime) {
    const dateLabel = formatDateParts(dateTime[1], dateTime[2], dateTime[3]);
    if (!dateLabel) return value;
    return `${dateLabel}, ${dateTime[4]}:${dateTime[5]}`;
  }
  return value;
}

function formatTenderValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `₹${value.toLocaleString("en-IN")}`;
  }
  return value;
}

function criterionStatusLabel(status) {
  if (status === "pass") return "Pass";
  if (status === "fail") return "Not Eligible";
  if (status === "needs_verification") return "Needs Verification";
  return status;
}

function statusClassName(label) {
  if (label === "Pass" || label === "Eligible") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (label === "Not Eligible" || label === "fail") {
    return "border-red-200 bg-red-50 text-red-800";
  }
  return "border-amber-200 bg-amber-50 text-amber-900";
}

export function generateStaticParams() {
  const tenders = getAllTenders();
  return tenders.map((tender) => ({
    id: tender.id,
  }));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const tender = getTenderById(id);

  if (!tender) {
    return {
      title: "Tender Not Found | TenderBridge",
      description: "The requested demonstration tender record could not be found.",
    };
  }

  return {
    title: `${tender.title} | TenderBridge`,
    description: tender.description,
  };
}

export default async function TenderDetailPage({ params }) {
  const { id } = await params;
  const tender = getTenderById(id);

  if (!tender) {
    notFound();
  }

  // Load authenticated user and persistent MSME profile if signed in
  const auth = await getCurrentUser();
  const isSignedIn = Boolean(auth && auth.user);

  let userProfile = null;
  if (isSignedIn) {
    try {
      await connectDB();
      userProfile = await MsmeProfile.findOne({ userId: auth.user.id }).lean();
    } catch (err) {
      console.error("Failed to load user profile for tender matching:", err.message);
    }
  }

  const isCppp = tender.source === "CPPP";
  const requirements = Array.isArray(tender.eligibilityRequirements)
    ? tender.eligibilityRequirements
    : [];
  const hasRecognizedCriteria = requirements.some(
    (requirement) => requirement && RECOGNIZED_CRITERIA_KEYS.has(requirement.criteriaKey)
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-5">
        <Link
          href="/tenders"
          className="inline-flex items-center text-sm font-medium text-green-800 hover:underline"
        >
          &larr; Back to Browse Tenders
        </Link>
      </div>

      {isCppp ? (
        <div className="mb-5 rounded-lg border border-sky-200 bg-sky-50/80 p-3 text-xs leading-relaxed text-sky-950 sm:p-4">
          <span className="mr-2 inline-flex rounded bg-sky-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            CPPP
          </span>
          <span>
            This record is structured from a CPPP tender notice. The original notice remains the authoritative source.
          </span>
        </div>
      ) : (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-900 sm:p-4">
          <span className="mr-2 inline-flex rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            Demo Record
          </span>
          <span>
            This is fictional demonstration data for INT257: Modern Web Application Development. It does not represent an official government procurement notice.
          </span>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">
            {tender.category}
          </span>
          <span className="rounded-md bg-gray-100 px-2.5 py-1 font-mono text-xs font-semibold uppercase text-gray-600">
            ID: {tender.id}
          </span>
        </div>

        <h1 className="mt-4 max-w-4xl break-words text-2xl font-bold leading-tight tracking-tight text-gray-900 sm:text-3xl lg:text-4xl">
          {tender.title}
        </h1>
        <p className="mt-2 break-words text-base font-medium text-gray-600">
          {tender.department}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
          <div className="min-w-0 rounded-lg bg-white p-3">
            <span className="block text-xs uppercase tracking-wider text-gray-500">
              Estimated Value
            </span>
            <span className="mt-1 block break-words text-lg font-bold text-green-800">
              {formatTenderValue(tender.estimatedValue)}
            </span>
          </div>
          <div className="min-w-0 rounded-lg bg-white p-3">
            <span className="block text-xs uppercase tracking-wider text-gray-500">
              Location
            </span>
            <span className="mt-1 block break-words text-sm font-semibold text-gray-900">
              {tender.location}
            </span>
          </div>
          <div className="min-w-0 rounded-lg bg-white p-3 sm:col-span-2 lg:col-span-1">
            <span className="block text-xs uppercase tracking-wider text-gray-500">
              Submission Deadline
            </span>
            <span className="mt-1 block break-words text-sm font-semibold text-gray-900">
              {formatTenderDate(tender.submissionDeadline)}
            </span>
          </div>
        </div>

        {isCppp ? (
          <div className="mt-8 border-t border-gray-100 pt-6">
            <h2 className="text-lg font-bold text-gray-900">Tender Facts & Notice Parameters</h2>
            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="min-w-0 rounded-lg bg-gray-50/80 p-3">
                <dt className="text-xs uppercase tracking-wider text-gray-500">Tender Reference No.</dt>
                <dd className="mt-1 break-words text-sm font-medium text-gray-900">{tender.referenceNo}</dd>
              </div>
              <div className="min-w-0 rounded-lg bg-gray-50/80 p-3">
                <dt className="text-xs uppercase tracking-wider text-gray-500">Tender ID (CPPP)</dt>
                <dd className="mt-1 break-words text-sm font-medium text-gray-900">{tender.tenderId}</dd>
              </div>
              <div className="min-w-0 rounded-lg bg-gray-50/80 p-3">
                <dt className="text-xs uppercase tracking-wider text-gray-500">EMD Amount</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{formatTenderValue(tender.emd)}</dd>
              </div>
              <div className="min-w-0 rounded-lg bg-gray-50/80 p-3">
                <dt className="text-xs uppercase tracking-wider text-gray-500">Publication Date</dt>
                <dd className="mt-1 break-words text-sm font-medium text-gray-900">{formatTenderDate(tender.publicationDate)}</dd>
              </div>
              <div className="min-w-0 rounded-lg bg-gray-50/80 p-3">
                <dt className="text-xs uppercase tracking-wider text-gray-500">Contract Type</dt>
                <dd className="mt-1 break-words text-sm font-medium text-gray-900">{tender.contractType}</dd>
              </div>
              <div className="min-w-0 rounded-lg bg-gray-50/80 p-3">
                <dt className="text-xs uppercase tracking-wider text-gray-500">Contract Duration</dt>
                <dd className="mt-1 break-words text-sm font-medium text-gray-900">{tender.contractDuration}</dd>
              </div>
            </dl>

            {tender.eligibilitySummary ? (
              <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50/70 p-4">
                <h3 className="text-sm font-bold text-gray-900">Eligibility Summary</h3>
                <p className="mt-2 break-words text-sm leading-relaxed text-gray-700">
                  {tender.eligibilitySummary}
                </p>
              </div>
            ) : null}

            {tender.noticeDiscrepancyNotes ? (
              <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50/80 p-4">
                <h3 className="text-sm font-bold text-amber-950">Notice Discrepancy Notes</h3>
                <p className="mt-2 break-words text-sm leading-relaxed text-amber-900">
                  {tender.noticeDiscrepancyNotes}
                </p>
              </div>
            ) : null}

            {Array.isArray(tender.requiredSubmissionDocuments) &&
              tender.requiredSubmissionDocuments.length > 0 ? (
              <div className="mt-5">
                <h3 className="text-sm font-bold text-gray-900">Required Submission Documents</h3>
                <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {tender.requiredSubmissionDocuments.map((document) => (
                    <li
                      key={document.documentName}
                      className="min-w-0 rounded-lg border border-gray-200 bg-white p-3"
                    >
                      <p className="break-words text-sm font-semibold text-gray-900">{document.documentName}</p>
                      <p className="mt-1 break-words text-sm leading-relaxed text-gray-700">{document.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {Array.isArray(tender.contractComplianceRequirements) &&
              tender.contractComplianceRequirements.length > 0 ? (
              <div className="mt-5 rounded-lg border border-sky-200 bg-sky-50/40 p-4">
                <h3 className="text-sm font-bold text-sky-950">Contract Compliance</h3>
                <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {tender.contractComplianceRequirements.map((item) => (
                    <li
                      key={item.complianceItem}
                      className="min-w-0 rounded-lg border border-sky-100 bg-white p-3"
                    >
                      <p className="break-words text-sm font-semibold text-gray-900">{item.complianceItem}</p>
                      <p className="mt-1 break-words text-sm text-gray-700">{item.authority}</p>
                      <p className="mt-1 break-words text-sm leading-relaxed text-gray-700">{item.requirementDetails}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8 border-t border-gray-100 pt-6">
          <h2 className="text-lg font-bold text-gray-900">
            Scope of Work & Description
          </h2>
          <p className="mt-3 break-words text-sm leading-7 text-gray-700">
            {tender.description}
          </p>
        </div>

        <div className="mt-8 border-t border-gray-100 pt-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <h2 className="text-lg font-bold text-gray-900">
              Eligibility & Qualification Requirements
            </h2>
            <span className="w-fit rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
              {requirements.length} criteria listed
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-gray-500">
            Automated matching is implemented for structured eligibility criteria. Requirements are listed below for verification.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {requirements.map((req) => (
              <div
                key={req.criteriaKey || req.criterion}
                className="flex min-w-0 flex-col justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-start"
              >
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {req.criterion}
                  </span>
                  <p className="mt-1 break-words text-sm leading-relaxed text-gray-800">
                    {req.requirement}
                  </p>
                </div>
                <div className="shrink-0 self-start">
                  {req.isMandatory ? (
                    <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      Mandatory
                    </span>
                  ) : (
                    <span className="inline-block rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                      Optional
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* =========================================================================
            TENDER MATCHING EVALUATION SECTION
           ========================================================================= */}
        {isSignedIn ? (
          userProfile ? (
            hasRecognizedCriteria ? (
              // Case 1A: Authenticated user with saved profile & structured criteria
              (() => {
                const adapted = adaptProfileForMatching(userProfile);
                const matchResult = evaluateTenderMatch(tender, adapted);
                return (
                  <div id="personalized-match" className="mt-8 scroll-mt-6 border-t border-gray-100 pt-6">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <h2 className="text-lg font-bold text-gray-900">Personalized Tender Match</h2>
                        <p className="mt-1 break-words text-xs text-gray-500">
                          Evaluated against your saved MSME profile:{" "}
                          <span className="font-semibold text-gray-800">{userProfile.legalName}</span>
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <span
                          className={`inline-block rounded-full border px-3.5 py-1.5 text-sm font-bold shadow-xs ${statusClassName(matchResult.overallStatus)}`}
                        >
                          {matchResult.overallStatus}
                        </span>
                        <Link
                          href="/account/profile"
                          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Update Profile
                        </Link>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/70 p-4 sm:p-5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Evaluation Summary
                      </p>
                      <p className="mt-2 break-words text-sm leading-7 text-gray-700">
                        {matchResult.summary}
                      </p>
                    </div>

                    <div className="mt-5">
                      <h3 className="text-sm font-bold text-gray-900">Criteria Evaluation Breakdown</h3>
                      <div className="mt-3 grid grid-cols-1 items-start gap-3 md:grid-cols-2">
                        {matchResult.criteriaResults.map((result) => {
                          const label = criterionStatusLabel(result.status);
                          return (
                            <div
                              key={result.criteriaKey}
                              className="min-w-0 rounded-lg border border-gray-200 bg-white p-4"
                            >
                              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  <h4 className="break-words text-sm font-semibold text-gray-900">
                                    {result.criterion}
                                  </h4>
                                  {result.isMandatory ? (
                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                                      Mandatory
                                    </span>
                                  ) : null}
                                </div>
                                <span
                                  className={`inline-block w-fit shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName(label)}`}
                                >
                                  {label}
                                </span>
                              </div>
                              <p className="mt-2 break-words text-sm leading-relaxed text-gray-700">
                                {result.reason}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              // Case 1B: Authenticated user with profile, but tender lacks recognized criteria
              <div className="mt-8 border-t border-gray-100 pt-6">
                <h2 className="text-lg font-bold text-gray-900">Personalized Tender Match</h2>
                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/80 p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <span className="inline-block rounded-full border border-gray-300 bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700">
                      Matching criteria unavailable
                    </span>
                  </div>
                  <p className="mt-3 max-w-3xl break-words text-sm leading-relaxed text-gray-600">
                    This tender record does not contain automated eligibility criteria recognized by the matching engine. Please refer to the listed requirements above for manual evaluation.
                  </p>
                </div>
              </div>
            )
          ) : (
            // Case 2: Authenticated user WITHOUT a saved company profile
            <div className="mt-8 border-t border-gray-100 pt-6">
              <h2 className="text-lg font-bold text-gray-900">Personalized Tender Match</h2>
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 p-4 sm:p-5">
                <h3 className="font-semibold text-amber-900">Company Profile Required</h3>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-amber-800">
                  Create your MSME company profile to see personalized tender eligibility.
                </p>
                <div className="mt-4">
                  <Link
                    href="/account/profile"
                    className="inline-flex items-center rounded-md bg-green-800 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-green-900"
                  >
                    Create Company Profile &rarr;
                  </Link>
                </div>
              </div>
            </div>
          )
        ) : (
          // Case 3: Unauthenticated visitor (Public preview using DEMO profile where applicable)
          isCppp && hasRecognizedCriteria ? (
            (() => {
              const demoResult = evaluateTenderMatch(tender, DEMO_MSME_PROFILE);
              return (
                <div className="mt-8 border-t border-gray-100 pt-6">
                  <h2 className="text-lg font-bold text-gray-900">
                    Sample Matching Result (Public Preview)
                  </h2>
                  <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm font-medium leading-relaxed text-amber-950">
                    Sample matching result calculated using fictional demonstration company data. Sign in to your MSME account to view personalized eligibility.
                  </div>
                  <p className="mt-3 break-words text-sm text-gray-700">
                    Demonstration company: {DEMO_MSME_PROFILE.companyName}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 p-3">
                    <span className="text-xs uppercase tracking-wider text-gray-500">Overall status</span>
                    <span
                      className={`inline-block rounded-full border px-3.5 py-1.5 text-sm font-bold shadow-xs ${statusClassName(demoResult.overallStatus)}`}
                    >
                      {demoResult.overallStatus}
                    </span>
                  </div>
                  <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/70 p-4">
                    <p className="break-words text-sm leading-7 text-gray-700">{demoResult.summary}</p>
                  </div>

                  <div className="mt-5 grid grid-cols-1 items-start gap-3 md:grid-cols-2">
                    {demoResult.criteriaResults.map((result) => {
                      const label = criterionStatusLabel(result.status);
                      return (
                        <div
                          key={result.criteriaKey}
                          className="min-w-0 rounded-lg border border-gray-200 bg-white p-4"
                        >
                          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                            <h3 className="break-words text-sm font-semibold text-gray-900">{result.criterion}</h3>
                            <span
                              className={`inline-block w-fit shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName(label)}`}
                            >
                              {label}
                            </span>
                          </div>
                          <p className="mt-2 break-words text-sm leading-relaxed text-gray-700">{result.reason}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()
          ) : null
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-6">
          <Link
            href="/tenders"
            className="rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            &larr; Back to Tenders
          </Link>
          {isSignedIn ? (
            <Link
              href="/account/profile"
              className="text-sm font-medium text-green-800 hover:underline"
            >
              Manage your MSME company profile &rarr;
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium text-green-800 hover:underline"
            >
              Sign in to check tender eligibility &rarr;
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
