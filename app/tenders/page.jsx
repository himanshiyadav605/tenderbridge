import Link from "next/link";
import { getAllTenders } from "../../data/tenders";

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

export const metadata = {
  title: "Browse Tenders | TenderBridge",
  description: "Explore government tender opportunities and view detailed requirements for MSMEs.",
};

export default function TendersPage() {
  const tenders = getAllTenders();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 border-b border-gray-100 pb-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-green-800">
          Opportunities Catalogue
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Browse Government Tenders
        </h1>
        <p className="mt-2 max-w-3xl text-base text-gray-600">
          Explore active tender opportunities matching various business sectors. Click any tender to inspect detailed eligibility requirements. Each card identifies a fictional sample or a CPPP-structured record.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tenders.map((tender) => {
          const isCppp = tender.source === "CPPP";

          return (
            <article
              key={tender.id}
              className="flex flex-col justify-between rounded-lg border border-gray-200 bg-white p-6 shadow-xs transition-shadow hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-block rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-800">
                    {tender.category}
                  </span>
                  <span className="font-mono text-xs uppercase text-gray-400">
                    {tender.id}
                  </span>
                </div>

                <h2 className="mt-4 text-lg font-bold leading-snug text-gray-900">
                  <Link
                    href={`/tenders/${tender.id}`}
                    className="hover:text-green-800 hover:underline"
                  >
                    {tender.title}
                  </Link>
                </h2>

                <p className="mt-2 text-sm font-medium text-gray-600">
                  {tender.department}
                </p>

                {isCppp ? (
                  <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
                    <span className="mr-2 rounded bg-sky-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                      CPPP
                    </span>
                    Structured from a CPPP tender notice.
                  </div>
                ) : (
                  <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <span className="mr-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                      Demo Data
                    </span>
                    Fictional sample record for academic demonstration in INT257. Not an official government procurement notice.
                  </div>
                )}

                <div className="mt-4 space-y-2 border-t border-gray-100 pt-3 text-sm text-gray-600">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-500">Location</span>
                    <span className="text-right font-medium text-gray-800">{tender.location}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-500">Estimated Value</span>
                    <span className="text-right font-semibold text-green-800">
                      {formatTenderValue(tender.estimatedValue)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-500">Deadline</span>
                    <span className="text-right font-medium text-gray-800">
                      {formatTenderDate(tender.submissionDeadline)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-gray-100 pt-4">
                <Link
                  href={`/tenders/${tender.id}`}
                  className="block w-full rounded-md bg-green-800 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-green-900"
                >
                  View Details
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
