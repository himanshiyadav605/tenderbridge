import Link from "next/link";

export default function Home() {
  return (
    <section className="mx-auto flex min-h-[75vh] max-w-6xl flex-col items-center justify-center px-6 text-center">
      <p className="mb-5 text-sm font-semibold uppercase tracking-widest text-green-800">
        Government Tender Discovery for MSMEs
      </p>

      <h2 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
        Find Government Tenders That Fit Your Business
      </h2>

      <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
        Discover relevant government opportunities, compare eligibility
        requirements and find tenders that match your business profile.
      </p>

      <div className="mt-9 flex flex-wrap justify-center gap-4">
        <Link
          href="/tenders"
          className="rounded-md bg-green-800 px-7 py-3 font-medium text-white hover:bg-green-900"
        >
          Explore Tenders
        </Link>

        <Link
          href="/register"
          className="rounded-md border border-green-800 px-7 py-3 font-medium text-green-800 hover:bg-green-50"
        >
          Create Your Profile
        </Link>
      </div>
    </section>
  );
}
