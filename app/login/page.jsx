import Link from "next/link";
import { redirect } from "next/navigation";
import LoginForm from "../../components/LoginForm";
import { getCurrentUser } from "../../lib/current-user";

export const metadata = {
  title: "Login | TenderBridge",
  description: "Sign in to your TenderBridge account.",
};

function noticeFor(error) {
  if (error === "expired") {
    return "Your session has expired. Please sign in again.";
  }
  if (error === "invalid") {
    return "Your session is no longer valid. Please sign in again.";
  }
  return "";
}

export default async function LoginPage({ searchParams }) {
  const result = await getCurrentUser();
  if (result.user) {
    redirect("/account");
  }

  const params = await searchParams;
  const notice = noticeFor(typeof params.error === "string" ? params.error : "");

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-green-800">
            Account Access
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
            Sign In to TenderBridge
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in with the email and password stored for your account.
          </p>
        </div>

        <LoginForm notice={notice} />

        <div className="mt-6 text-center text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-green-800 hover:underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}
