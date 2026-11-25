"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProfileVerificationBadge from "./ProfileVerificationBadge";
import { calculateProfileCompletion } from "../lib/profile-completion";

function formatCurrency(val) {
  if (typeof val === "number" && Number.isFinite(val)) {
    return `₹${val.toLocaleString("en-IN")}`;
  }
  return "Not declared";
}

export default function AccountProfileSection() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch("/api/profile");
        if (!res.ok) {
          throw new Error("Failed to load profile data.");
        }
        const data = await res.json();
        if (isMounted) {
          setProfile(data.profile || null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "An unexpected error occurred.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-green-800 border-t-transparent" />
          <p className="text-sm text-gray-600">Loading MSME company profile status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-900">
        <p className="font-semibold">Unable to load company profile</p>
        <p className="mt-1 text-red-800">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50"
        >
          Retry
        </button>
      </div>
    );
  }

  // Case 1: No company profile exists
  if (!profile) {
    return (
      <div className="mt-8 rounded-lg border border-dashed border-gray-300 bg-gray-50/70 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-800">
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
            />
          </svg>
        </div>
        <h2 className="mt-3 text-lg font-semibold text-gray-900">No Company Profile Found</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
          You have not created an MSME company profile yet. Add your business identity, departmental
          enlistments, and track tender eligibility credentials.
        </p>
        <div className="mt-6">
          <Link
            href="/account/profile"
            className="inline-flex items-center rounded-md bg-green-800 px-5 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-green-900"
          >
            Create Company Profile &rarr;
          </Link>
        </div>
      </div>
    );
  }

  // Case 2: Profile exists
  const completion = calculateProfileCompletion(profile);
  const enlistmentsCount = Array.isArray(profile.departmentalEnlistments)
    ? profile.departmentalEnlistments.length
    : 0;
  const financialsCount = Array.isArray(profile.financialRecords)
    ? profile.financialRecords.length
    : 0;
  const completedWorksCount = Array.isArray(profile.completedWorks)
    ? profile.completedWorks.length
    : 0;
  const ongoingWorksCount = Array.isArray(profile.ongoingWorks) ? profile.ongoingWorks.length : 0;

  return (
    <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-gray-100 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900">{profile.legalName}</h2>
            <ProfileVerificationBadge status={profile.profileVerificationStatus} />
            <span className="rounded-md bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              {profile.msmeCategory} Enterprise
            </span>
          </div>
          {profile.tradeName ? (
            <p className="mt-1 text-sm text-gray-500">Trading as: {profile.tradeName}</p>
          ) : null}
        </div>

        <Link
          href="/account/profile"
          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Edit Company Profile
        </Link>
      </div>

      {/* Profile Completion Indicator */}
      <div className="mt-5 rounded-md border border-gray-100 bg-gray-50/70 p-4">
        <div className="flex items-center justify-between text-xs font-medium text-gray-700">
          <span>Profile Completion</span>
          <span className="font-semibold text-green-900">{completion.percentage}% Completed</span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-green-800 transition-all duration-300"
            style={{ width: `${completion.percentage}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          {completion.completedCount} of {completion.totalCount} mandatory information criteria satisfied.
          Optional fields are not penalized.
        </p>
      </div>

      {/* Snapshot Information Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-gray-100 bg-gray-50/50 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500">Enlistments</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{enlistmentsCount}</p>
          <p className="text-xs text-gray-500">Departmental registrations</p>
        </div>

        <div className="rounded-md border border-gray-100 bg-gray-50/50 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500">Financial Records</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{financialsCount}</p>
          <p className="text-xs text-gray-500">Annual turnover years</p>
        </div>

        <div className="rounded-md border border-gray-100 bg-gray-50/50 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500">Completed Works</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{completedWorksCount}</p>
          <p className="text-xs text-gray-500">Executed contracts</p>
        </div>

        <div className="rounded-md border border-gray-100 bg-gray-50/50 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500">Ongoing Works</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{ongoingWorksCount}</p>
          <p className="text-xs text-gray-500">Bidding commitments</p>
        </div>
      </div>

      {/* Contact & Registration Snapshot */}
      <dl className="mt-6 divide-y divide-gray-100 rounded-md border border-gray-200 text-sm">
        <div className="grid grid-cols-1 px-4 py-3 sm:grid-cols-3">
          <dt className="text-xs uppercase tracking-wider text-gray-500">Location</dt>
          <dd className="font-medium text-gray-900 sm:col-span-2">
            {profile.city}, {profile.state} — PIN {profile.pincode}
          </dd>
        </div>
        <div className="grid grid-cols-1 px-4 py-3 sm:grid-cols-3">
          <dt className="text-xs uppercase tracking-wider text-gray-500">Contact Person</dt>
          <dd className="font-medium text-gray-900 sm:col-span-2">
            {profile.contactPerson} ({profile.contactPhone}) &bull; {profile.contactEmail}
          </dd>
        </div>
        {profile.udyamRegistrationNumber ? (
          <div className="grid grid-cols-1 px-4 py-3 sm:grid-cols-3">
            <dt className="text-xs uppercase tracking-wider text-gray-500">Udyam Registration</dt>
            <dd className="font-medium text-gray-900 sm:col-span-2">
              {profile.udyamRegistrationNumber}
            </dd>
          </div>
        ) : null}
        {profile.availableBidCapacity !== null && profile.availableBidCapacity !== undefined ? (
          <div className="grid grid-cols-1 px-4 py-3 sm:grid-cols-3">
            <dt className="text-xs uppercase tracking-wider text-gray-500">Declared Bid Capacity</dt>
            <dd className="font-medium text-gray-900 sm:col-span-2">
              {formatCurrency(profile.availableBidCapacity)}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
