import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../lib/current-user";
import connectDB from "../../lib/db";
import MsmeProfile from "../../models/MsmeProfile";
import { getCatalogueTenders } from "../../lib/tender-data";
import { adaptProfileForMatching } from "../../lib/profile-to-matching";
import { evaluateTenderMatch } from "../../lib/tender-matching";
import { calculateProfileCompletion } from "../../lib/profile-completion";
import ProfileVerificationBadge from "../../components/ProfileVerificationBadge";

export const metadata = {
  title: "Account & Company Profile | TenderBridge",
  description:
    "View and manage your TenderBridge account, persistent MSME company profile, and personalized tender matches.",
};

export const dynamic = "force-dynamic";

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

function formatCreatedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }
  return `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

function formatTenderValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `₹${value.toLocaleString("en-IN")}`;
  }
  return value;
}

function formatBidCapacity(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `₹${value.toLocaleString("en-IN")}`;
  }
  return "Not declared";
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

function summarizeCriteria(matchResult) {
  const mandatoryResults = Array.isArray(matchResult?.criteriaResults)
    ? matchResult.criteriaResults.filter((c) => c && c.isMandatory)
    : [];

  let passCount = 0;
  let failCount = 0;
  let nvCount = 0;

  for (const item of mandatoryResults) {
    if (item.status === "pass") passCount++;
    else if (item.status === "fail") failCount++;
    else if (item.status === "needs_verification") nvCount++;
  }

  const parts = [];
  if (passCount > 0) parts.push(`${passCount} passed`);
  if (failCount > 0) parts.push(`${failCount} failed`);
  if (nvCount > 0) parts.push(`${nvCount} need verification`);

  if (parts.length === 0) {
    return "No mandatory criteria evaluated";
  }
  return `${mandatoryResults.length} mandatory checks: ${parts.join(" · ")}`;
}

function TenderCardMeta({ tender, isCompact = false }) {
  const hasEstimatedValue =
    tender.estimatedValue !== null &&
    tender.estimatedValue !== undefined &&
    tender.estimatedValue !== "";
  const hasDeadline =
    typeof tender.submissionDeadline === "string" && tender.submissionDeadline.trim().length > 0;

  if (!hasEstimatedValue && !hasDeadline) {
    return null;
  }

  return (
    <dl
      className={
        isCompact
          ? "space-y-3 rounded-md bg-gray-50/70 p-4 text-sm"
          : "mt-3 space-y-1.5 border-t border-gray-100 pt-3 text-sm"
      }
    >
      {hasEstimatedValue ? (
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <dt className="text-xs text-gray-500">Estimated Value</dt>
          <dd className="min-w-0 break-words text-right font-semibold text-green-800">
            {formatTenderValue(tender.estimatedValue)}
          </dd>
        </div>
      ) : null}
      {hasDeadline ? (
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <dt className="text-xs text-gray-500">Submission Deadline</dt>
          <dd className="min-w-0 break-words text-right font-medium text-gray-800">
            {formatTenderDate(tender.submissionDeadline)}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

function EvaluatedTenderCard({ tender, matchResult, isProminent }) {
  const isCppp = tender.source === "CPPP";
  const criteriaText = summarizeCriteria(matchResult);
  const status = matchResult.overallStatus;
  const detailHref = `/tenders/${tender.id}#personalized-match`;

  let cardToneClass = "border-gray-200";
  let summaryBoxClass = "border-gray-200 bg-gray-50/70 text-gray-700";

  if (status === "Eligible") {
    cardToneClass = "border-emerald-200";
    summaryBoxClass = "border-emerald-200/70 bg-emerald-50/50 text-emerald-950";
  } else if (status === "Needs Verification") {
    cardToneClass = "border-amber-200";
    summaryBoxClass = "border-amber-200/80 bg-amber-50/60 text-amber-950";
  } else if (status === "Not Eligible") {
    cardToneClass = "border-red-200";
    summaryBoxClass = "border-red-200/70 bg-red-50/50 text-red-950";
  }

  return (
    <article
      className={`flex min-w-0 flex-col justify-between rounded-lg border bg-white p-4 shadow-xs transition-shadow hover:shadow-md sm:p-5 ${cardToneClass} ${
        isProminent ? "md:col-span-2 lg:col-span-3" : ""
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-medium uppercase text-gray-500">
              {tender.id}
            </span>
            {isCppp ? (
              <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-900">
                CPPP
              </span>
            ) : null}
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClassName(
              status
            )}`}
          >
            {status}
          </span>
        </div>

        <div
          className={
            isProminent
              ? "mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.65fr)]"
              : "mt-3"
          }
        >
          <div className="min-w-0">
            <h4 className="min-w-0 break-words text-base font-bold leading-snug text-gray-900">
              <Link
                href={detailHref}
                title={tender.title}
                className="break-words hover:text-green-800 hover:underline"
              >
                {tender.title}
              </Link>
            </h4>

            <p className="mt-1.5 break-words text-sm text-gray-600" title={tender.department}>
              {tender.department}
            </p>

            <div className={`mt-3 min-w-0 rounded-md border px-3 py-2 text-xs ${summaryBoxClass}`}>
              <p className="break-words font-medium">{criteriaText}</p>
            </div>
          </div>

          <div className={isProminent ? "min-w-0" : ""}>
            <TenderCardMeta tender={tender} isCompact={isProminent} />
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-3">
        <Link
          href={detailHref}
          className="inline-flex items-center text-sm font-semibold text-green-800 hover:text-green-950 hover:underline"
        >
          View match details &rarr;
        </Link>
      </div>
    </article>
  );
}

function UnavailableTenderCard({ tender }) {
  const detailHref = `/tenders/${tender.id}`;
  const isGem = tender.source === "GEM";

  return (
    <article className="flex min-w-0 flex-col justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-md sm:p-5">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-medium uppercase text-gray-500">
              {tender.id}
            </span>
            {isGem ? (
              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-900">
                Live GeM
              </span>
            ) : null}
          </div>
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            Criteria unavailable
          </span>
        </div>
        {isGem && tender.officialTenderId ? (
          <p className="mt-2 font-mono text-xs text-gray-500">
            GeM Bid ID: {tender.officialTenderId}
          </p>
        ) : null}

        <h4 className="mt-3 min-w-0 break-words text-base font-bold leading-snug text-gray-900">
          <Link
            href={detailHref}
            title={tender.title}
            className="break-words hover:text-green-800 hover:underline"
          >
            {tender.title}
          </Link>
        </h4>

        <p className="mt-1.5 break-words text-sm text-gray-600" title={tender.department}>
          {tender.department}
        </p>

        <div className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
          Not automatically evaluated. Refer to the tender notice for manual criteria.
        </div>

        <TenderCardMeta tender={tender} />
      </div>

      <div className="mt-4 border-t border-gray-100 pt-3">
        <Link
          href={detailHref}
          className="inline-flex items-center text-sm font-medium text-green-800 hover:text-green-950 hover:underline"
        >
          View tender details &rarr;
        </Link>
      </div>
    </article>
  );
}

export default async function AccountPage() {
  const result = await getCurrentUser();

  if (result.sessionState === "expired") {
    redirect("/login?error=expired");
  }

  if (result.sessionState === "error") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-green-800">Account</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Your account</h1>
        <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Account information is temporarily unavailable. Please try again.
        </p>
      </div>
    );
  }

  if (!result.user) {
    redirect("/login?error=invalid");
  }

  const user = result.user;

  // Load profile and evaluate tender matches for the dashboard
  let userProfile = null;
  let adaptedProfile = null;
  let profileLoadError = false;
  const tenders = await getCatalogueTenders();
  const groups = {
    eligible: [],
    needsVerification: [],
    notEligible: [],
    criteriaUnavailable: [],
  };

  // Fetch the MSME profile from DB (ownership-scoped to signed-in user)
  if (user) {
    try {
      await connectDB();
      userProfile = await MsmeProfile.findOne({ userId: user.id }).lean();
      adaptedProfile = userProfile ? adaptProfileForMatching(userProfile) : null;
    } catch (e) {
      profileLoadError = true;
      console.error("Failed to load MSME profile for dashboard", e);
    }
  }

  // Evaluate each tender only when a profile exists
  if (adaptedProfile) {
    for (const tender of tenders) {
      const requirements = Array.isArray(tender.eligibilityRequirements)
        ? tender.eligibilityRequirements
        : [];
      const hasRecognized = requirements.some(
        (r) => r && RECOGNIZED_CRITERIA_KEYS.has(r.criteriaKey)
      );
      if (hasRecognized) {
        const matchResult = evaluateTenderMatch(tender, adaptedProfile);
        const status = matchResult.overallStatus;
        if (status === "Eligible") groups.eligible.push({ tender, matchResult });
        else if (status === "Needs Verification")
          groups.needsVerification.push({ tender, matchResult });
        else groups.notEligible.push({ tender, matchResult });
      } else {
        groups.criteriaUnavailable.push({ tender });
      }
    }
  }

  // Precompute profile display metrics when a profile exists
  const completion = userProfile ? calculateProfileCompletion(userProfile) : null;
  const profileMetrics = userProfile
    ? [
        {
          label: "Enlistments",
          value: Array.isArray(userProfile.departmentalEnlistments)
            ? userProfile.departmentalEnlistments.length
            : 0,
          caption: "Departmental registrations",
        },
        {
          label: "Financial Records",
          value: Array.isArray(userProfile.financialRecords)
            ? userProfile.financialRecords.length
            : 0,
          caption: "Annual turnover years",
        },
        {
          label: "Completed Works",
          value: Array.isArray(userProfile.completedWorks)
            ? userProfile.completedWorks.length
            : 0,
          caption: "Executed contracts",
        },
        {
          label: "Ongoing Works",
          value: Array.isArray(userProfile.ongoingWorks) ? userProfile.ongoingWorks.length : 0,
          caption: "Bidding commitments",
        },
      ]
    : [];

  const summaryCards = [
    {
      label: "Eligible",
      count: groups.eligible.length,
      description: "Passes all mandatory checks",
      cardClass: "border-emerald-200 bg-emerald-50/60",
      labelClass: "text-emerald-800",
      countClass: "text-emerald-950",
    },
    {
      label: "Needs Verification",
      count: groups.needsVerification.length,
      description: "Requires document or notice verification",
      cardClass: "border-amber-200 bg-amber-50/60",
      labelClass: "text-amber-900",
      countClass: "text-amber-950",
    },
    {
      label: "Not Eligible",
      count: groups.notEligible.length,
      description: "Does not meet mandatory criteria",
      cardClass: "border-red-200 bg-red-50/60",
      labelClass: "text-red-800",
      countClass: "text-red-950",
    },
    {
      label: "Criteria Unavailable",
      count: groups.criteriaUnavailable.length,
      description: "Not evaluated automatically",
      cardClass: "border-gray-200 bg-gray-50",
      labelClass: "text-gray-700",
      countClass: "text-gray-900",
    },
  ];

  const evaluatedSections = [
    {
      id: "eligible",
      title: "Eligible Tenders",
      subtitle: "Tenders passing all recognized mandatory criteria based on verified data.",
      items: groups.eligible,
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
      emptyMessage:
        "No tenders currently qualify automatically. Review items under Needs Verification or keep your company profile up to date.",
      highlightSingle: false,
    },
    {
      id: "needs-verification",
      title: "Needs Verification",
      subtitle:
        "Tenders requiring independent verification or procuring-authority clarification before eligibility can be confirmed.",
      items: groups.needsVerification,
      badgeClass: "border-amber-200 bg-amber-50 text-amber-900",
      emptyMessage: "No tenders are currently awaiting verification.",
      highlightSingle: groups.needsVerification.length === 1,
    },
    {
      id: "not-eligible",
      title: "Not Eligible",
      subtitle:
        "Tenders where one or more mandatory criteria are not met by your current profile.",
      items: groups.notEligible,
      badgeClass: "border-red-200 bg-red-50 text-red-800",
      emptyMessage: "None of the automatically evaluated tenders currently fail mandatory criteria.",
      highlightSingle: false,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-5 border-b border-gray-100 pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-green-800">
            Account Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Your MSME Account
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600 sm:text-base">
            Manage your sign-in credentials, persistent company profile, and personalized tender
            eligibility matches.
          </p>
        </div>

        <Link
          href="/tenders"
          className="inline-flex w-full shrink-0 items-center justify-center rounded-md border border-green-800 bg-white px-4 py-2 text-sm font-medium text-green-800 transition-colors hover:bg-green-50 sm:w-auto"
        >
          Browse Tenders &rarr;
        </Link>
      </div>

      {/* Section 1: Account Information */}
      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-xs">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-base font-semibold text-gray-900">Account Information</h2>
          <p className="mt-1 text-xs text-gray-500">
            Sign-in details associated with your TenderBridge session.
          </p>
        </div>

        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div className="rounded-md bg-gray-50/80 px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Account Name
            </dt>
            <dd className="mt-0.5 break-words text-sm font-semibold text-gray-900">{user.name}</dd>
          </div>
          <div className="min-w-0 rounded-md bg-gray-50/80 px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Sign-in Email
            </dt>
            <dd className="mt-0.5 break-words text-sm font-semibold text-gray-900">{user.email}</dd>
          </div>
          <div className="rounded-md bg-gray-50/80 px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Role</dt>
            <dd className="mt-0.5 break-words text-sm font-semibold capitalize text-gray-900">{user.role}</dd>
          </div>
          <div className="rounded-md bg-gray-50/80 px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Account Created
            </dt>
            <dd className="mt-0.5 text-sm font-semibold text-gray-900">
              {formatCreatedAt(user.createdAt)}
            </dd>
          </div>
        </dl>
      </section>

      {/* Section 2: MSME Company Profile */}
      <section className="mt-8">
        {profileLoadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-900 shadow-xs">
            <h2 className="text-base font-semibold">Unable to load MSME company profile</h2>
            <p className="mt-1 text-red-800">
              Company profile information and tender matching results are temporarily unavailable.
              Please refresh the page to try again.
            </p>
          </div>
        ) : !userProfile ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/70 p-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-green-800">
              MSME Company Profile
            </p>
            <h2 className="mt-2 text-xl font-bold text-gray-900">No Company Profile Found</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-gray-600">
              You have not created an MSME company profile yet. Add your business identity,
              departmental enlistments, and financial history to activate personalized tender
              matching.
            </p>
            <div className="mt-6">
              <Link
                href="/account/profile"
                className="inline-flex items-center rounded-md bg-green-800 px-5 py-2.5 text-sm font-medium text-white shadow-xs transition-colors hover:bg-green-900"
              >
                Create Company Profile &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs">
            {/* Profile Card Header */}
            <div className="flex flex-col justify-between gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-green-800">
                  MSME Company Profile
                </p>
                <h2 className="mt-1 break-words text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
                  {userProfile.legalName}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ProfileVerificationBadge status={userProfile.profileVerificationStatus} />
                  {userProfile.msmeCategory ? (
                    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                      {`${userProfile.msmeCategory} Enterprise`}
                    </span>
                  ) : null}
                  {userProfile.tradeName ? (
                    <span className="break-words text-xs text-gray-500">
                      Trading as:{" "}
                      <span className="font-medium text-gray-700">{userProfile.tradeName}</span>
                    </span>
                  ) : null}
                </div>
              </div>

              <Link
                href="/account/profile"
                className="inline-flex w-full shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto"
              >
                Edit Company Profile
              </Link>
            </div>

            {/* Profile Completion Presentation */}
            <div className="mt-4 grid gap-4 rounded-lg bg-gray-50/80 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Profile Completion
                </span>
                <span className="mt-1 block text-2xl font-bold tracking-tight text-green-900">
                  {`${completion.percentage}% Completed`}
                </span>
              </div>
              <div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-green-800"
                    style={{ width: `${completion.percentage}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-col gap-1 text-xs text-gray-600">
                  <span>
                    {`${completion.completedCount} of ${completion.totalCount} mandatory information criteria entered. Optional fields are not penalized.`}
                  </span>
                  <span className="text-gray-500">
                    Completeness reflects entered data only, not independent verification.
                  </span>
                </div>
              </div>
            </div>

            {/* Four Profile Summary Metrics */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {profileMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="flex min-h-24 flex-col rounded-md border border-gray-200 bg-white p-3"
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    {metric.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold leading-none text-gray-900">{metric.value}</p>
                  <p className="mt-auto pt-2 text-xs text-gray-500">{metric.caption}</p>
                </div>
              ))}
            </div>

            {/* Contact, Location & Registration Snapshot */}
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 rounded-md bg-gray-50/80 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  Location
                </dt>
                <dd className="mt-1 break-words font-medium text-gray-900">
                  {`${userProfile.city}, ${userProfile.state} — PIN ${userProfile.pincode}`}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  Contact Person
                </dt>
                <dd className="mt-1 break-words font-medium text-gray-900">
                  {`${userProfile.contactPerson} (${userProfile.contactPhone}) • ${userProfile.contactEmail}`}
                </dd>
              </div>
              {userProfile.udyamRegistrationNumber ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    Udyam Registration
                  </dt>
                  <dd className="mt-1 font-medium text-gray-900">
                    {userProfile.udyamRegistrationNumber}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  Declared Bid Capacity
                </dt>
                <dd className="mt-1 font-medium text-gray-900">
                  {formatBidCapacity(userProfile.availableBidCapacity)}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </section>

      {/* Section 3: Personalized Tender Matching Dashboard */}
      {!profileLoadError ? (
        <section className="mt-8 border-t border-gray-200 pt-8">
          {userProfile ? (
            <>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-green-800">
                    Preliminary Eligibility Overview
                  </p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
                    Your Tender Matches
                  </h2>
                  <p className="mt-1.5 max-w-3xl text-sm text-gray-600">
                    Preliminary matching results for{" "}
                    <span className="font-semibold text-gray-800">{userProfile.legalName}</span>{" "}
                    across {tenders.length} catalogued tender notices.
                  </p>
                </div>
                <Link
                  href="/tenders"
                  className="text-sm font-medium text-green-800 hover:underline"
                >
                  Open full tender catalogue &rarr;
                </Link>
              </div>

              {/* Four Summary Cards */}
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {summaryCards.map((card) => (
                  <div
                    key={card.label}
                    className={`rounded-lg border p-4 shadow-xs ${card.cardClass} ${
                      card.label === "Needs Verification" && card.count > 0
                        ? "border-l-4 border-amber-400 bg-amber-100/80 ring-1 ring-amber-200"
                        : ""
                    }`}
                  >
                    <p
                      className={`text-xs font-semibold uppercase tracking-wider ${card.labelClass}`}
                    >
                      {card.label}
                    </p>
                    <p className={`mt-2 text-3xl font-bold ${card.countClass}`}>{card.count}</p>
                    <p className="mt-1 text-xs text-gray-600">{card.description}</p>
                  </div>
                ))}
              </div>

              {/* Evaluated Tender Groups */}
              <div className="mt-8 space-y-8">
                {evaluatedSections.map((section) => (
                  <section key={section.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2.5">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{section.title}</h3>
                        <p className="mt-0.5 text-xs text-gray-600">{section.subtitle}</p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${section.badgeClass}`}
                      >
                        {`${section.items.length} ${section.items.length === 1 ? "tender" : "tenders"}`}
                      </span>
                    </div>

                    {section.items.length === 0 ? (
                      <div className="mt-3 rounded-md border border-dashed border-gray-200 bg-gray-50/70 px-4 py-3 text-sm text-gray-600">
                        {section.emptyMessage}
                      </div>
                    ) : (
                      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {section.items.map(({ tender, matchResult }) => (
                          <EvaluatedTenderCard
                            key={tender.id}
                            tender={tender}
                            matchResult={matchResult}
                            isProminent={section.highlightSingle}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                ))}

                {/* Criteria Unavailable Group */}
                <section>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2.5">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Criteria Unavailable</h3>
                      <p className="mt-0.5 text-xs text-gray-600">
                        These records do not contain structured machine-readable eligibility
                        criteria, so they are not automatically evaluated as eligible or ineligible.
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                      {`${groups.criteriaUnavailable.length} ${groups.criteriaUnavailable.length === 1 ? "tender" : "tenders"}`}
                    </span>
                  </div>

                  {groups.criteriaUnavailable.length === 0 ? (
                    <div className="mt-3 rounded-md border border-dashed border-gray-200 bg-gray-50/70 px-4 py-3 text-sm text-gray-600">
                      All catalogued tender records currently include machine-readable eligibility
                      criteria.
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {groups.criteriaUnavailable.map(({ tender }) => (
                        <UnavailableTenderCard key={tender.id} tender={tender} />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-base font-semibold text-amber-950">Your Tender Matches</h2>
                  <p className="mt-1 text-sm text-amber-900">
                    Create your MSME company profile to see personalized tender matches across all{" "}
                    {tenders.length} catalogued tenders.
                  </p>
                </div>
                <Link
                  href="/account/profile"
                  className="inline-flex w-full shrink-0 items-center justify-center rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors hover:bg-green-900 sm:w-auto"
                >
                  Create Company Profile &rarr;
                </Link>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {/* Section 4: Session Logout */}
      <div className="mt-8 flex flex-col items-start justify-between gap-6 border-t border-gray-200 pt-6 sm:flex-row sm:items-center">
        <p className="text-xs text-gray-500">
          Signed in as <span className="font-medium text-gray-700">{user.email}</span>
        </p>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
