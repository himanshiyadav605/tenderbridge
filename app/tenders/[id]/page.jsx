import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllTenders, getTenderById } from "../../../data/tenders";
import { DEMO_MSME_PROFILE } from "../../../data/msme-profile";
import { evaluateTenderMatch } from "../../../lib/tender-matching";

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
  if (label === "Not Eligible") {
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

  const isCppp = tender.source === "CPPP";
  const requirements = Array.isArray(tender.eligibilityRequirements)
    ? tender.eligibilityRequirements
    : [];
  const hasRecognizedCriteria = requirements.some(
    (requirement) => requirement && RECOGNIZED_CRITERIA_KEYS.has(requirement.criteriaKey)
  );
  const matchResult =
    isCppp && hasRecognizedCriteria
      ? evaluateTenderMatch(tender, DEMO_MSME_PROFILE)
      : null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6">
        <Link
          href="/tenders"
          className="inline-flex items-center text-sm font-medium text-green-800 hover:underline"
        >
          ← Back to Browse Tenders
        </Link>
      </div>

      {isCppp ? (
        <div className="mb-6 rounded-md border border-sky-200 bg-sky-50 p-4 text-xs text-sky-950">
          <span className="mr-2 rounded bg-sky-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            CPPP
          </span>
          <span>
            This record is structured from a CPPP tender notice. The original notice remains the authoritative source.
          </span>
        </div>
      ) : (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <span className="mr-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            Demo Record
          </span>
          <span>
            This is fictional demonstration data for INT257: Modern Web Application Development. It does not represent an official government procurement notice.
          </span>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-4">
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-800">
            {tender.category}
          </span>
          <span className="font-mono text-xs font-semibold text-gray-500 uppercase">
            ID: {tender.id}
          </span>
        </div>

        <h1 className="mt-4 text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
          {tender.title}
        </h1>
        <p className="mt-2 text-base font-medium text-gray-600">
          {tender.department}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 rounded-md bg-gray-50 p-4 sm:grid-cols-3">
          <div>
            <span className="block text-xs uppercase tracking-wider text-gray-500">
              Estimated Value
            </span>
            <span className="mt-1 block text-lg font-bold text-green-800">
              {formatTenderValue(tender.estimatedValue)}
            </span>
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wider text-gray-500">
              Location
            </span>
            <span className="mt-1 block text-sm font-medium text-gray-900">
              {tender.location}
            </span>
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wider text-gray-500">
              Submission Deadline
            </span>
            <span className="mt-1 block text-sm font-medium text-gray-900">
              {formatTenderDate(tender.submissionDeadline)}
            </span>
          </div>
        </div>

        {isCppp ? (
          <div className="mt-8 border-t border-gray-100 pt-6">
            <h2 className="text-lg font-bold text-gray-900">CPPP Notice Details</h2>
            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wider text-gray-500">Reference No</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{tender.referenceNo}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-gray-500">Tender ID</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{tender.tenderId}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-gray-500">EMD</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">
                  {formatTenderValue(tender.emd)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-gray-500">Publication Date</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">
                  {formatTenderDate(tender.publicationDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-gray-500">
                  Technical Bid Opening
                </dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">
                  {formatTenderDate(tender.technicalBidOpening)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-gray-500">Contract Type</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{tender.contractType}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-gray-500">Contract Duration</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{tender.contractDuration}</dd>
              </div>
            </dl>

            {tender.eligibilitySummary ? (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-gray-900">Eligibility Summary</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-700">
                  {tender.eligibilitySummary}
                </p>
              </div>
            ) : null}

            {tender.noticeDiscrepancyNotes ? (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-gray-900">Notice Discrepancy Notes</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-700">
                  {tender.noticeDiscrepancyNotes}
                </p>
              </div>
            ) : null}

            {Array.isArray(tender.requiredSubmissionDocuments) &&
              tender.requiredSubmissionDocuments.length > 0 ? (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-gray-900">Required Submission Documents</h3>
                <ul className="mt-3 space-y-3">
                  {tender.requiredSubmissionDocuments.map((document) => (
                    <li
                      key={document.documentName}
                      className="rounded-md border border-gray-200 p-3"
                    >
                      <p className="text-sm font-medium text-gray-900">{document.documentName}</p>
                      <p className="mt-1 text-sm text-gray-700">{document.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {Array.isArray(tender.contractComplianceRequirements) &&
              tender.contractComplianceRequirements.length > 0 ? (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-gray-900">Contract Compliance</h3>
                <ul className="mt-3 space-y-3">
                  {tender.contractComplianceRequirements.map((item) => (
                    <li
                      key={item.complianceItem}
                      className="rounded-md border border-gray-200 p-3"
                    >
                      <p className="text-sm font-medium text-gray-900">{item.complianceItem}</p>
                      <p className="mt-1 text-sm text-gray-700">{item.authority}</p>
                      <p className="mt-1 text-sm text-gray-700">{item.requirementDetails}</p>
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
          <p className="mt-3 text-sm leading-relaxed text-gray-700">
            {tender.description}
          </p>
        </div>

        <div className="mt-8 border-t border-gray-100 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              Eligibility & Qualification Requirements
            </h2>
            <span className="text-xs text-gray-500">
              {requirements.length} criteria listed
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {matchResult
              ? "Structured criteria are evaluated against fictional demonstration company data only."
              : "Automated matching is implemented for structured criteria only. These requirements are listed for reading."}
          </p>

          <div className="mt-4 space-y-3">
            {requirements.map((req) => (
              <div
                key={req.criteriaKey || req.criterion}
                className="flex flex-col justify-between gap-2 rounded-md border border-gray-200 p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {req.criterion}
                  </span>
                  <p className="mt-1 text-sm font-medium text-gray-800">
                    {req.requirement}
                  </p>
                </div>
                <div className="shrink-0">
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

        {matchResult ? (
          <div className="mt-8 border-t border-gray-100 pt-6">
            <h2 className="text-lg font-bold text-gray-900">Sample Matching Result</h2>
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-950">
              Sample matching result calculated using fictional demonstration company data. This is not your company&apos;s eligibility assessment.
            </div>
            <p className="mt-3 text-sm text-gray-700">
              Demonstration company: {DEMO_MSME_PROFILE.companyName}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-xs uppercase tracking-wider text-gray-500">Overall status</span>
              <span
                className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName(matchResult.overallStatus)}`}
              >
                {matchResult.overallStatus}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-gray-700">{matchResult.summary}</p>

            <div className="mt-4 space-y-3">
              {matchResult.criteriaResults.map((result) => {
                const label = criterionStatusLabel(result.status);
                return (
                  <div
                    key={result.criteriaKey}
                    className="rounded-md border border-gray-200 p-4"
                  >
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <h3 className="text-sm font-semibold text-gray-900">{result.criterion}</h3>
                      <span
                        className={`inline-block w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName(label)}`}
                      >
                        {label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-gray-700">{result.reason}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-6">
          <Link
            href="/tenders"
            className="rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Back to Tenders
          </Link>
          <span className="text-sm text-gray-500">
            MSME profile registration will be available in a later stage.
          </span>
        </div>
      </div>
    </div>
  );
}
