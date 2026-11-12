import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <nav className="flex items-center justify-between border-b border-gray-100 px-8 py-5">
        <h1 className="text-2xl font-bold text-green-800">
          TenderBridge
        </h1>

        <div className="flex items-center gap-6 text-sm">
          <Link href="/" className="text-green-800">Home</Link>
          <a href="/tenders" className="hover:text-green-800">
            Browse Tenders
          </a>
          <a href="/about" className="hover:text-green-800">
            About
          </a>
          <a href="/login" className="hover:text-green-800">
            Login
          </a>
          <a
            href="/register"
            className="rounded-md bg-green-800 px-5 py-2.5 text-white hover:bg-green-900"
          >
            Register
          </a>
        </div>
      </nav>

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
          <a
            href="/tenders"
            className="rounded-md bg-green-800 px-7 py-3 font-medium text-white hover:bg-green-900"
          >
            Explore Tenders
          </a>

          <a
            href="/register"
            className="rounded-md border border-green-800 px-7 py-3 font-medium text-green-800 hover:bg-green-50"
          >
            Create Your Profile
          </a>
        </div>
      </section>

      <footer className="border-t border-gray-100 px-8 py-6 text-center text-sm text-gray-500">
        TenderBridge — An academic project for MSME tender discovery.
      </footer>
    </main>
  );
}
