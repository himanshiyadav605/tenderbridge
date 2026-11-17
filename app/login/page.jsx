import Link from "next/link";

export const metadata = {
  title: "Login | TenderBridge",
  description: "Sign in to access your TenderBridge dashboard and recommendations.",
};

export default function LoginPage() {
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
            Access your MSME profile, saved tenders, and matching results.
          </p>
        </div>

        <div className="mt-8 rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
          <p className="font-medium text-gray-800">Authentication Portal</p>
          <p className="mt-1 text-xs text-gray-500">
            User authentication and credential handling are scheduled for integration in Unit IV, Topic 1.
          </p>
        </div>

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
