import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="flex items-center justify-between border-b border-gray-100 px-8 py-5">
      <h1 className="text-2xl font-bold text-green-800">
        <Link href="/">TenderBridge</Link>
      </h1>

      <div className="flex items-center gap-6 text-sm">
        <Link href="/" className="hover:text-green-800">
          Home
        </Link>
        <Link href="/tenders" className="hover:text-green-800">
          Browse Tenders
        </Link>
        <Link href="/about" className="hover:text-green-800">
          About
        </Link>
        <Link href="/login" className="hover:text-green-800">
          Login
        </Link>
        <Link
          href="/register"
          className="rounded-md bg-green-800 px-5 py-2.5 text-white hover:bg-green-900"
        >
          Register
        </Link>
      </div>
    </nav>
  );
}
