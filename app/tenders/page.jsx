import Link from "next/link";
import { getCatalogueTenders } from "../../lib/tender-data";
import { evaluateTenderMatch, evaluateTenderRelevance } from "../../lib/tender-matching";
import { getCurrentUser } from "../../lib/current-user";
import connectDB from "../../lib/db";
import MsmeProfile from "../../models/MsmeProfile";
import { adaptProfileForMatching } from "../../lib/profile-to-matching";

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

function statusClassName(label) {
  if (label === "Pass" || label === "Eligible") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (label === "Not Eligible" || label === "fail") {
    return "border-red-200 bg-red-50 text-red-800";
  }
  return "border-amber-200 bg-amber-50 text-amber-900";
}

export const metadata = {
  title: "Browse Tenders | TenderBridge",
  description: "Explore government tender opportunities and view detailed requirements for MSMEs.",
};

export const dynamic = "force-dynamic";

export default async function TendersPage() {
  const tenders = await getCatalogueTenders();

  // Load authenticated user and profile
  const auth = await getCurrentUser();
  const isSignedIn = Boolean(auth && auth.user);

  let userProfile = null;
  if (isSignedIn) {
    try {
      await connectDB();
      userProfile = await MsmeProfile.findOne({ userId: auth.user.id }).lean();
    } catch (err) {
      console.error("Failed to load user profile on tenders catalogue:", err.message);
    }
  }

  const adaptedProfile = userProfile ? adaptProfileForMatching(userProfile) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 border-b border-gray-100 pb-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-green-800">
          Opportunities Catalogue
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Browse Government Tenders
        </h1>
        <p className="mt-2 max-w-3xl text-base text-gray-600">
          Explore active tender opportunities matching various business sectors. Click any tender to inspect detailed eligibility requirements. Each card identifies a fictional sample or a CPPP-structured record.
        </p>
        <p className="mt-3 max-w-3xl rounded-md border border-sky-100 bg-sky-50/60 px-3 py-2 text-xs text-sky-950">
          Live GeM records are periodically refreshed, with coverage limited to the most recent 100 results configured for the actor.
        </p>
      </div>

      {/* Authenticated State Banners */}
      {isSignedIn ? (
        userProfile ? (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50/70 p-4 text-sm text-green-950">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-600" />
                  <p className="font-semibold text-green-900">Personalized Tender Matching Active</p>
                </div>
                <p className="mt-0.5 text-xs text-green-800">
                  Eligibility evaluated against stored profile for <span className="font-semibold">{userProfile.legalName}</span>.
                </p>
              </div>
              <Link
                href="/account/profile"
                className="inline-flex shrink-0 items-center rounded-md border border-green-800 bg-white px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-50"
              >
                Edit Profile
              </Link>
            </div>
          </div>
        ) : (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="font-semibold">Personalized Matching Available</p>
                <p className="text-xs text-amber-800">
                  Create your MSME company profile to see personalized tender eligibility across all opportunities.
                </p>
              </div>
              <Link
                href="/account/profile"
                className="inline-flex shrink-0 items-center rounded-md bg-green-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-green-900"
              >
                Create Profile &rarr;
              </Link>
            </div>
          </div>
        )
      ) : null}

      <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3">
        {tenders.map((tender) => {
          const isCppp = tender.source === "CPPP";
          const isGem = tender.source === "GEM";
          const requirements = Array.isArray(tender.eligibilityRequirements)
            ? tender.eligibilityRequirements
            : [];
          const hasRecognizedCriteria = requirements.some(
            (req) => req && RECOGNIZED_CRITERIA_KEYS.has(req.criteriaKey)
          );

          // Calculate match for authenticated user with profile
          let matchResult = null;
          const relevanceResult = adaptedProfile
            ? evaluateTenderRelevance(tender, adaptedProfile)
            : null;
          if (adaptedProfile && hasRecognizedCriteria) {
            matchResult = evaluateTenderMatch(tender, adaptedProfile);
          }

          return (
            <article
              key={tender.id}
              className={`flex h-full min-w-0 flex-col justify-between rounded-lg border bg-white p-5 shadow-xs transition-shadow hover:shadow-md ${
                isCppp
                  ? "border-sky-200 lg:col-span-3"
                  : "border-gray-200"
              }`}
            >
              <div
                className={
                  isCppp
                    ? "flex-1 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-6"
                    : "flex-1"
                }
              >
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-block max-w-full rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-800">
                      {tender.category || (isGem ? "Live GeM Bid" : "Uncategorised")}
                    </span>
                    <span className="shrink-0 font-mono text-xs uppercase text-gray-400">
                      {tender.id}
                    </span>
                  </div>

                  <h2 className="mt-4 min-w-0 break-words text-lg font-bold leading-snug text-gray-900">
                    <Link
                      href={`/tenders/${tender.id}`}
                      className="break-words hover:text-green-800 hover:underline"
                    >
                      {tender.title}
                    </Link>
                  </h2>

                  <p className="mt-2 break-words text-sm font-medium text-gray-600">
                    {tender.department || (isGem ? "Department unavailable" : "Department unavailable")}
                  </p>

                  {isGem ? (
                    <div className="mt-3 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-950">
                      <span className="mr-2 rounded bg-violet-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                        Live GeM
                      </span>
                      GeM bid discovery record. Eligibility criteria unavailable.
                    </div>
                  ) : isCppp ? (
                    <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
                      <span className="mr-2 rounded bg-sky-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                        CPPP
                      </span>
                      Structured from a CPPP tender notice.
                    </div>
                  ) : (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-100 bg-amber-50/60 px-2.5 py-1.5 text-xs leading-relaxed text-amber-800">
                      <span className="inline-flex shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                        Demo Data
                      </span>
                      Fictional sample record for academic demonstration in INT257. Not an official government procurement notice.
                    </div>
                  )}
                </div>

                <div className={isCppp ? "min-w-0 lg:mt-0" : ""}>
                  {relevanceResult ? (
                    <div className="mt-4 rounded-md border border-blue-100 bg-blue-50/60 p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-gray-700">Industry Relevance:</span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 font-semibold ${
                            relevanceResult.classification === "Relevant"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : relevanceResult.classification === "Insufficient Information"
                                ? "border-gray-200 bg-white text-gray-600"
                                : "border-amber-200 bg-amber-50 text-amber-900"
                          }`}
                        >
                          {relevanceResult.classification}
                        </span>
                      </div>
                      <p className="mt-1.5 break-words text-[11px] text-gray-600">
                        {relevanceResult.explanation}
                      </p>
                    </div>
                  ) : null}

                  {/* Personalized Eligibility Badge on Card */}
                  {adaptedProfile ? (
                    hasRecognizedCriteria && matchResult ? (
                      (() => {
                        const mandatoryResults = Array.isArray(matchResult.criteriaResults)
                          ? matchResult.criteriaResults.filter((c) => c && c.isMandatory)
                          : [];
                        let passCount = 0;
                        let failCount = 0;
                        let nvCount = 0;
                        for (const c of mandatoryResults) {
                          if (c.status === "pass") passCount++;
                          else if (c.status === "fail") failCount++;
                          else if (c.status === "needs_verification") nvCount++;
                        }
                        const parts = [];
                        if (passCount > 0) parts.push(`${passCount} passed`);
                        if (failCount > 0) parts.push(`${failCount} failed`);
                        if (nvCount > 0) parts.push(`${nvCount} need verification`);
                        const summaryText =
                          parts.length > 0
                            ? parts.join(" · ")
                            : "No mandatory criteria evaluated";

                        return (
                          <div className="mt-4 rounded-md border border-gray-100 bg-gray-50/80 p-3 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-gray-700">
                                Your Profile Match:
                              </span>
                              <span
                                className={`shrink-0 rounded-full border px-2.5 py-0.5 font-semibold ${statusClassName(matchResult.overallStatus)}`}
                              >
                                {matchResult.overallStatus}
                              </span>
                            </div>
                            <p className="mt-1.5 text-[11px] text-gray-600">{summaryText}</p>
                            <div className="mt-2 border-t border-gray-200/60 pt-2 text-right">
                              <Link
                                href={`/tenders/${tender.id}#personalized-match`}
                                className="font-medium text-green-800 hover:text-green-950 hover:underline"
                              >
                                View match details &rarr;
                              </Link>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-100 bg-gray-50/50 px-3 py-2 text-xs">
                        <span className="text-gray-500">Qualification Eligibility:</span>
                        <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 font-medium text-gray-600">
                          Qualification criteria unavailable
                        </span>
                      </div>
                    )
                  ) : isSignedIn ? (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-amber-200 bg-amber-50/60 px-3 py-2 text-xs">
                      <span className="text-gray-700">Your Profile Match:</span>
                      <Link
                        href="/account/profile"
                        className="font-medium text-green-800 hover:underline"
                      >
                        Set up your company profile &rarr;
                      </Link>
                    </div>
                  ) : null}

                  <div className="mt-4 min-w-0 space-y-2 border-t border-gray-100 pt-3 text-sm text-gray-600">
                    {isGem ? (
                      <>
                        <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
                          <span className="text-xs text-gray-500">GeM Bid ID</span>
                          <span className="min-w-0 break-words text-right font-mono font-medium text-gray-800">
                            {tender.officialTenderId}
                          </span>
                        </div>
                        {tender.publishedAt ? (
                          <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
                            <span className="text-xs text-gray-500">Published</span>
                            <span className="min-w-0 break-words text-right font-medium text-gray-800">
                              {formatTenderDate(tender.publishedAt)}
                            </span>
                          </div>
                        ) : null}
                        {tender.lastFetchedAt ? (
                          <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
                            <span className="text-xs text-gray-500">Last Synced</span>
                            <span className="min-w-0 break-words text-right font-medium text-gray-800">
                              {formatTenderDate(tender.lastFetchedAt)}
                            </span>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    {!isGem && tender.location ? (
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <span className="text-xs text-gray-500">Location</span>
                        <span className="min-w-0 break-words text-right font-medium text-gray-800">
                          {tender.location}
                        </span>
                      </div>
                    ) : null}
                    {!isGem && tender.estimatedValue != null ? (
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <span className="text-xs text-gray-500">Estimated Value</span>
                        <span className="min-w-0 break-words text-right font-semibold text-green-800">
                          {formatTenderValue(tender.estimatedValue)}
                        </span>
                      </div>
                    ) : null}
                    {tender.submissionDeadline ? (
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <span className="text-xs text-gray-500">Deadline</span>
                        <span className="min-w-0 break-words text-right font-medium text-gray-800">
                          {formatTenderDate(tender.submissionDeadline)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className={`mt-5 border-t border-gray-100 pt-3 ${isCppp ? "lg:flex lg:justify-end" : ""}`}>
                <Link
                  href={`/tenders/${tender.id}`}
                  className={`block w-full rounded-md bg-green-800 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-green-900 ${
                    isCppp ? "lg:w-56" : ""
                  }`}
                >
                  View Details &rarr;
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
