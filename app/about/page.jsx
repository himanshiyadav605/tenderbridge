import Link from "next/link";

export const metadata = {
  title: "About | TenderBridge",
  description: "Learn more about TenderBridge and its mission to assist MSMEs in tender discovery.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 border-b border-gray-100 pb-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-green-800">
          About The Platform
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          About TenderBridge
        </h1>
        <p className="mt-2 text-base text-gray-600">
          Bridging the gap between Micro, Small and Medium Enterprises and government procurement opportunities.
        </p>
      </div>

      <div className="space-y-6 text-gray-700 leading-relaxed">
        <p>
          <strong>TenderBridge</strong> is an academic web application developed as part of <strong>INT257: Modern Web Application Development</strong>. The platform is designed to address the challenge MSMEs face when navigating fragmented government procurement portals.
        </p>

        <h2 className="text-xl font-bold text-gray-900">Key Objectives</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Provide a centralized, easy-to-use tender discovery interface.</li>
          <li>Allow MSMEs to maintain qualification profiles (turnover, industry, location, certificates).</li>
          <li>Offer preliminary evaluation of eligibility: <em>Eligible</em>, <em>Not Eligible</em>, or <em>Needs Verification</em>.</li>
          <li>Assist small businesses in tracking and bookmarking relevant opportunities.</li>
        </ul>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <strong>Academic Project Disclaimer:</strong> TenderBridge is not an official government procurement portal and does not guarantee contract awards or actual legal tender eligibility. All matching assessments are advisory and preliminary.
        </div>

        <div className="pt-4">
          <Link
            href="/"
            className="rounded-md bg-green-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-900"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
