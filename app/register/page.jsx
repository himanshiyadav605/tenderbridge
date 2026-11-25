import Link from "next/link";
import { redirect } from "next/navigation";
import RegisterForm from "../../components/RegisterForm";
import { getCurrentUser } from "../../lib/current-user";

export const metadata = {
  title: "Register | TenderBridge",
  description: "Create an MSME account on TenderBridge.",
};

export default async function RegisterPage() {
  const result = await getCurrentUser();
  if (result.user) {
    redirect("/account");
  }

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
            Register your name and email. The account role is stored as msme.
          </p>
        </div>

        <RegisterForm />

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
