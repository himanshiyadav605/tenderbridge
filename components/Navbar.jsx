import Link from "next/link";
import { cookies } from "next/headers";
import { readSession, SESSION_COOKIE } from "../lib/session";

export default async function Navbar() {
  const cookieStore = await cookies();
  const session = readSession(cookieStore.get(SESSION_COOKIE)?.value);
  const signedIn = session.state === "ok";

  return (
    <nav className="flex flex-col items-stretch gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5">
      <h1 className="shrink-0 text-xl font-bold text-green-800 sm:text-2xl">
        <Link href="/">TenderBridge</Link>
      </h1>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm sm:gap-6">
        <Link href="/" className="whitespace-nowrap hover:text-green-800">
          Home
        </Link>
        <Link href="/tenders" className="whitespace-nowrap hover:text-green-800">
          Browse Tenders
        </Link>
        <Link href="/about" className="whitespace-nowrap hover:text-green-800">
          About
        </Link>
        {signedIn ? (
          <>
            <Link href="/account" className="whitespace-nowrap hover:text-green-800">
              Account
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="whitespace-nowrap hover:text-green-800">
                Logout
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login" className="whitespace-nowrap hover:text-green-800">
              Login
            </Link>
            <Link
              href="/register"
              className="whitespace-nowrap rounded-md bg-green-800 px-4 py-2 text-white hover:bg-green-900 sm:px-5 sm:py-2.5"
            >
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
