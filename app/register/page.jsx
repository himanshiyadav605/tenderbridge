import Link from "next/link";

export const metadata = {
  title: "Register | TenderBridge",
  description: "Create an account to start matching your MSME with government tenders.",
};

export default function RegisterPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-green-800">
            Get Started
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
            Create an MSME Account
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Register your enterprise to receive personalized tender recommendations.
          </p>
        </div>

        <div className="mt-8 rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
          <p className="font-medium text-gray-800">Registration Portal</p>
          <p className="mt-1 text-xs text-gray-500">
            Enterprise onboarding and profile setup forms are scheduled for integration in upcoming stages.
          </p>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-green-800 hover:underline">
            Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
}
