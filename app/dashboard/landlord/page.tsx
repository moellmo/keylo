"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import LogoutButton from "@/components/LogoutButton";
import ArchiveListingButton from "./ArchiveListingButton";
import ResubmitListingButton from "./ResubmitListingButton";

type PropertyWithApplications = {
  id: string;
  title: string;
  monthly_rent: number;
  city: string;
  state: string;
  status: string;
  rejection_note: string | null;
  created_at: string;
  applications: { id: string }[];
};

type LandlordLease = {
  id: string;
  lease_status: string;
  tenant_name: string | null;
  property_address: string | null;
  monthly_rent: number | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  tenant_signed_at: string | null;
  landlord_signed_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export default function LandlordDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [listings, setListings] = useState<PropertyWithApplications[]>([]);
  const [leases, setLeases] = useState<LandlordLease[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoggedIn(false);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "landlord" && profile?.role !== "admin") {
        setLoggedIn(false);
        setErrorMessage(
          "You must be logged in as a landlord to view this dashboard."
        );
        setLoading(false);
        return;
      }

      setLoggedIn(true);

      const { data, error } = await supabase
        .from("properties")
        .select(
          `
          id,
          title,
          monthly_rent,
          city,
          state,
          status,
          rejection_note,
          created_at,
          applications (
            id
          )
        `
        )
        .eq("landlord_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      const { data: leaseRows, error: leasesError } = await supabase
        .from("leases")
        .select(
          `
          id,
          lease_status,
          tenant_name,
          property_address,
          monthly_rent,
          lease_start_date,
          lease_end_date,
          tenant_signed_at,
          landlord_signed_at,
          completed_at,
          created_at
        `
        )
        .eq("landlord_id", user.id)
        .order("created_at", { ascending: false });

      if (leasesError) {
        setErrorMessage(leasesError.message);
        setLoading(false);
        return;
      }

      setListings((data || []) as PropertyWithApplications[]);
      setLeases((leaseRows || []) as LandlordLease[]);
      setLoading(false);
    }

    loadDashboard();
  }, []);

  function statusLabel(status: string) {
    if (status === "pending") return "Pending Review";
    if (status === "published") return "Published";
    if (status === "draft") return "Draft";
    if (status === "paused") return "Paused";
    if (status === "archived") return "Archived";
    if (status === "rejected") return "Rejected";
    return status;
  }

  function leaseStatusLabel(status: string) {
    if (status === "draft") return "Draft";
    if (status === "sent_to_tenant") return "Sent to Tenant";
    if (status === "tenant_signed") return "Needs Your Signature";
    if (status === "completed") return "Completed";
    if (status === "cancelled") return "Cancelled";
    return status;
  }

  function statusClass(status: string) {
    if (status === "published") {
      return "bg-green-50 text-green-700";
    }

    if (status === "pending") {
      return "bg-yellow-50 text-yellow-700";
    }

    if (status === "rejected") {
      return "bg-red-50 text-red-700";
    }

    return "bg-slate-100 text-slate-600";
  }

  function leaseStatusClass(status: string) {
    if (status === "completed") {
      return "bg-green-50 text-green-700";
    }

    if (status === "tenant_signed") {
      return "bg-yellow-50 text-yellow-700";
    }

    if (status === "sent_to_tenant") {
      return "bg-blue-50 text-blue-700";
    }

    return "bg-slate-100 text-slate-600";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading dashboard...</h1>
        </div>
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <h1 className="text-3xl font-black">Please log in</h1>
            <p className="mt-3 text-slate-600">
              {errorMessage ||
                "You need to log in as a landlord to view this dashboard."}
            </p>
            <Link
              href="/auth/login"
              className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
            >
              Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const totalApplications = listings.reduce(
    (total, listing) => total + listing.applications.length,
    0
  );

  const publishedListings = listings.filter(
    (listing) => listing.status === "published"
  ).length;

  const pendingListings = listings.filter(
    (listing) => listing.status === "pending"
  ).length;

  const rejectedListings = listings.filter(
    (listing) => listing.status === "rejected"
  ).length;

  const leasesNeedingSignature = leases.filter(
    (lease) => lease.lease_status === "tenant_signed"
  );

  const recentLeases = leases.slice(0, 5);

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/" className="text-sm font-bold text-slate-600">
              ← Back to Home
            </Link>

            <h1 className="mt-4 text-5xl font-black tracking-tight">
              Landlord Dashboard
            </h1>

            <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-600">
              Manage rental listings, review tenant applications, and complete
              lease signatures.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/dashboard/landlord/profile"
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black text-slate-950"
            >
              Landlord Profile
            </Link>

            <Link
              href="/dashboard/landlord/verification"
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black text-slate-950"
            >
              Verification
            </Link>

            <LogoutButton />

            <Link
              href="/dashboard/landlord/properties/new"
              className="rounded-full bg-slate-950 px-6 py-3 text-center font-black text-white"
            >
              Post New Listing
            </Link>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-2xl bg-white px-5 py-4 font-bold text-red-700 shadow-sm ring-1 ring-red-200">
            {errorMessage}
          </div>
        )}

        <div className="mt-8 grid gap-5 md:grid-cols-6">
          <a
            href="#listings"
            className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Listings
            </p>
            <p className="mt-3 text-4xl font-black">{listings.length}</p>
          </a>

          <a
            href="#listings"
            className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Applications
            </p>
            <p className="mt-3 text-4xl font-black">{totalApplications}</p>
          </a>

          <a
            href="#listings"
            className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Published
            </p>
            <p className="mt-3 text-4xl font-black">{publishedListings}</p>
          </a>

          <a
            href="#listings"
            className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Pending
            </p>
            <p className="mt-3 text-4xl font-black">{pendingListings}</p>
          </a>

          <a
            href="#leases"
            className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Leases
            </p>
            <p className="mt-3 text-4xl font-black">{leases.length}</p>
          </a>

          <a
            href="#needs-signature"
            className={`rounded-3xl p-6 shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md ${
              leasesNeedingSignature.length > 0
                ? "bg-yellow-50 ring-yellow-200"
                : "bg-white ring-slate-200"
            }`}
          >
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Needs Signature
            </p>
            <p className="mt-3 text-4xl font-black">
              {leasesNeedingSignature.length}
            </p>
          </a>
        </div>

        <section
          id="needs-signature"
          className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200"
        >
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-2xl font-black">
              Leases Needing Your Signature
            </h2>
          </div>

          {leasesNeedingSignature.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {leasesNeedingSignature.map((lease) => (
                <div
                  key={lease.id}
                  className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-black">
                        Lease for {lease.tenant_name || "Tenant"}
                      </h3>

                      <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-black text-yellow-700">
                        Needs Your Signature
                      </span>
                    </div>

                    <p className="mt-2 font-bold text-slate-500">
                      {lease.property_address || "No property address provided"}
                    </p>

                    <p className="mt-2 text-sm font-bold text-slate-500">
                      {lease.monthly_rent
                        ? `$${lease.monthly_rent.toLocaleString()}/mo`
                        : "Rent not provided"}
                      {lease.tenant_signed_at
                        ? ` · Tenant signed ${new Date(
                            lease.tenant_signed_at
                          ).toLocaleString()}`
                        : ""}
                    </p>
                  </div>

                  <Link
                    href={`/dashboard/landlord/leases/${lease.id}`}
                    className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
                  >
                    Open & Sign
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No signatures needed</h3>
              <p className="mt-3 text-slate-600">
                When a tenant signs a lease, it will appear here for your final
                signature.
              </p>
            </div>
          )}
        </section>

        <section
          id="leases"
          className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200"
        >
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-2xl font-black">Recent Leases</h2>
          </div>

          {recentLeases.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {recentLeases.map((lease) => (
                <div
                  key={lease.id}
                  className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-black">
                        Lease for {lease.tenant_name || "Tenant"}
                      </h3>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${leaseStatusClass(
                          lease.lease_status
                        )}`}
                      >
                        {leaseStatusLabel(lease.lease_status)}
                      </span>
                    </div>

                    <p className="mt-2 font-bold text-slate-500">
                      {lease.property_address || "No property address provided"}
                    </p>

                    <p className="mt-2 text-sm font-bold text-slate-500">
                      {lease.monthly_rent
                        ? `$${lease.monthly_rent.toLocaleString()}/mo`
                        : "Rent not provided"}
                      {lease.lease_start_date && lease.lease_end_date
                        ? ` · ${lease.lease_start_date} to ${lease.lease_end_date}`
                        : ""}
                    </p>
                  </div>

                  <Link
                    href={`/dashboard/landlord/leases/${lease.id}`}
                    className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
                  >
                    View Lease
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No leases yet</h3>
              <p className="mt-3 text-slate-600">
                Leases will appear here after you create them from approved
                applications.
              </p>
            </div>
          )}
        </section>

        <div
          id="listings"
          className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200"
        >
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-2xl font-black">Your Listings</h2>
          </div>

          {listings.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-black">{listing.title}</h3>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
                          listing.status
                        )}`}
                      >
                        {statusLabel(listing.status)}
                      </span>
                    </div>

                    <p className="mt-2 font-bold text-slate-500">
                      {listing.city}, {listing.state} · $
                      {listing.monthly_rent.toLocaleString()}/mo
                    </p>

                    <p className="mt-2 text-sm font-bold text-slate-500">
                      {listing.applications.length} application
                      {listing.applications.length === 1 ? "" : "s"}
                    </p>

                    {listing.status === "pending" && (
                      <div className="mt-3 rounded-2xl bg-yellow-50 px-4 py-3 text-sm font-bold text-yellow-700">
                        This listing is waiting for admin approval before it
                        appears publicly.
                      </div>
                    )}

                    {listing.status === "rejected" &&
                      listing.rejection_note && (
                        <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                          Rejection reason: {listing.rejection_note}
                        </div>
                      )}

                    {listing.status === "rejected" &&
                      !listing.rejection_note && (
                        <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                          This listing was rejected. Please edit and resubmit.
                        </div>
                      )}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Link
                      href={`/dashboard/landlord/properties/${listing.id}/preview`}
                      className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
                    >
                      Preview Listing
                    </Link>

                    {listing.status === "published" && (
                      <Link
                        href={`/listings/${listing.id}`}
                        className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
                      >
                        Public View
                      </Link>
                    )}

                    <Link
                      href={`/dashboard/landlord/properties/${listing.id}/edit`}
                      className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
                    >
                      Edit Listing
                    </Link>

                    {listing.status === "rejected" && (
                      <ResubmitListingButton propertyId={listing.id} />
                    )}

                    <ArchiveListingButton propertyId={listing.id} />

                    <Link
                      href={`/dashboard/landlord/properties/${listing.id}/applications`}
                      className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
                    >
                      View Applicants
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No listings yet</h3>
              <p className="mt-3 text-slate-600">
                Post your first rental listing to start receiving applications.
              </p>

              <Link
                href="/dashboard/landlord/properties/new"
                className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
              >
                Post First Listing
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}