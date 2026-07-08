"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import LogoutButton from "@/components/LogoutButton";
import RemoveSavedListingButton from "./RemoveSavedListingButton";

type RentalProperty = {
  id: string;
  title: string;
  monthly_rent: number;
  city: string;
  state: string;
};

type SavedRentalProperty = {
  id: string;
  title: string;
  monthly_rent: number;
  city: string;
  state: string;
  bedrooms: string | null;
  bathrooms: string | null;
  status: string;
};

type TenantApplication = {
  id: string;
  status: string;
  created_at: string;
  move_in_date: string | null;
  property_id: string;
  properties: RentalProperty | RentalProperty[] | null;
};

type SavedListing = {
  id: string;
  created_at: string;
  property_id: string;
  properties: SavedRentalProperty | SavedRentalProperty[] | null;
};

type TenantLease = {
  id: string;
  lease_status: string;
  tenant_name: string | null;
  landlord_name: string | null;
  property_address: string | null;
  monthly_rent: number | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  created_at: string;
};

function getApplicationProperty(application: TenantApplication) {
  if (Array.isArray(application.properties)) {
    return application.properties[0] || null;
  }

  return application.properties;
}

function getSavedProperty(saved: SavedListing) {
  if (Array.isArray(saved.properties)) {
    return saved.properties[0] || null;
  }

  return saved.properties;
}

function formatLeaseStatus(status: string) {
  if (status === "draft") return "Draft";
  if (status === "sent_to_tenant") return "Ready to Sign";
  if (status === "tenant_signed") return "Tenant Signed";
  if (status === "landlord_signed") return "Landlord Signed";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";

  return status;
}

export default function TenantDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [applications, setApplications] = useState<TenantApplication[]>([]);
  const [savedListings, setSavedListings] = useState<SavedListing[]>([]);
  const [leases, setLeases] = useState<TenantLease[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadTenantDashboard() {
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

      if (profile?.role !== "tenant" && profile?.role !== "admin") {
        setLoggedIn(false);
        setErrorMessage(
          "You must be logged in as a tenant to view this dashboard."
        );
        setLoading(false);
        return;
      }

      setLoggedIn(true);

      const { data: applicationRows, error: applicationsError } =
        await supabase
          .from("applications")
          .select(
            `
            id,
            status,
            created_at,
            move_in_date,
            property_id,
            properties (
              id,
              title,
              monthly_rent,
              city,
              state
            )
          `
          )
          .eq("tenant_id", user.id)
          .order("created_at", { ascending: false });

      if (applicationsError) {
        setErrorMessage(applicationsError.message);
        setLoading(false);
        return;
      }

      const { data: savedRows, error: savedError } = await supabase
        .from("saved_listings")
        .select(
          `
          id,
          created_at,
          property_id,
          properties (
            id,
            title,
            monthly_rent,
            city,
            state,
            bedrooms,
            bathrooms,
            status
          )
        `
        )
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false });

      if (savedError) {
        setErrorMessage(savedError.message);
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
          landlord_name,
          property_address,
          monthly_rent,
          lease_start_date,
          lease_end_date,
          created_at
        `
        )
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false });

      if (leasesError) {
        setErrorMessage(leasesError.message);
        setLoading(false);
        return;
      }

      setApplications((applicationRows || []) as unknown as TenantApplication[]);
      setSavedListings((savedRows || []) as unknown as SavedListing[]);
      setLeases((leaseRows || []) as TenantLease[]);
      setLoading(false);
    }

    loadTenantDashboard();
  }, []);

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
                "You need to log in as a tenant to view your dashboard."}
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

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="text-sm font-bold text-slate-600">
            ← Back to Home
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/tenant/documents"
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              Documents
            </Link>

            <Link
  href="/dashboard/tenant/payments"
  className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black text-slate-950"
>
  Payments
</Link>

<Link
  href="/dashboard/tenant/maintenance"
  className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black text-slate-950"
>
  Maintenance
</Link>

            <Link
              href="/dashboard/tenant/profile"
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              Edit Profile
            </Link>

            <LogoutButton />
          </div>
        </div>

        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Tenant Dashboard
          </p>

          <h1 className="mt-3 text-5xl font-black tracking-tight">
            Your Rental Activity
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Track saved rentals, submitted applications, leases, and signing
            status.
          </p>

          {errorMessage && (
            <div className="mt-6 rounded-2xl bg-slate-100 px-5 py-4 font-bold text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="mt-8 grid gap-5 md:grid-cols-5">
            <div className="rounded-3xl bg-[#f7f4ef] p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Applications
              </p>
              <p className="mt-3 text-4xl font-black">{applications.length}</p>
            </div>

            <div className="rounded-3xl bg-[#f7f4ef] p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Saved
              </p>
              <p className="mt-3 text-4xl font-black">{savedListings.length}</p>
            </div>

            <div className="rounded-3xl bg-[#f7f4ef] p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Leases
              </p>
              <p className="mt-3 text-4xl font-black">{leases.length}</p>
            </div>

            <div className="rounded-3xl bg-[#f7f4ef] p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Approved
              </p>
              <p className="mt-3 text-4xl font-black">
                {
                  applications.filter(
                    (application) => application.status === "approved"
                  ).length
                }
              </p>
            </div>

            <div className="rounded-3xl bg-[#f7f4ef] p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Reviewing
              </p>
              <p className="mt-3 text-4xl font-black">
                {
                  applications.filter(
                    (application) => application.status === "reviewing"
                  ).length
                }
              </p>
            </div>
          </div>
        </div>

        <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-2xl font-black">Your Leases</h2>
          </div>

          {leases.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {leases.map((lease) => (
                <div
                  key={lease.id}
                  className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-black">
                        {lease.property_address || "Lease Agreement"}
                      </h3>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                        {formatLeaseStatus(lease.lease_status)}
                      </span>
                    </div>

                    <p className="mt-2 font-bold text-slate-500">
                      {lease.monthly_rent
                        ? `$${lease.monthly_rent.toLocaleString()}/mo`
                        : "Rent not provided"}
                      {lease.lease_start_date && lease.lease_end_date
                        ? ` · ${lease.lease_start_date} to ${lease.lease_end_date}`
                        : ""}
                    </p>

                    <p className="mt-2 text-sm font-bold text-slate-500">
                      Landlord: {lease.landlord_name || "Not provided"}
                    </p>
                  </div>

                  <Link
                    href={`/dashboard/tenant/leases/${lease.id}`}
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
                When a landlord sends you a lease, it will appear here.
              </p>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-2xl font-black">Saved Listings</h2>
          </div>

          {savedListings.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {savedListings.map((saved) => {
                const property = getSavedProperty(saved);

                return (
                  <div
                    key={saved.id}
                    className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-black">
                          {property?.title || "Rental Listing"}
                        </h3>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                          {property?.status || "unknown"}
                        </span>
                      </div>

                      <p className="mt-2 font-bold text-slate-500">
                        {property
                          ? `${property.city}, ${
                              property.state
                            } · $${property.monthly_rent.toLocaleString()}/mo`
                          : "Listing details unavailable"}
                      </p>

                      <p className="mt-2 text-sm font-bold text-slate-500">
                        Saved {new Date(saved.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        href={`/listings/${saved.property_id}`}
                        className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
                      >
                        View Listing
                      </Link>

                      <Link
                        href={`/apply/${saved.property_id}`}
                        className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
                      >
                        Apply
                      </Link>

                      <RemoveSavedListingButton savedListingId={saved.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No saved listings yet</h3>

              <p className="mt-3 text-slate-600">
                Save rentals you like so you can come back to them later.
              </p>

              <Link
                href="/listings"
                className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
              >
                Browse Rentals
              </Link>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-2xl font-black">Your Applications</h2>
          </div>

          {applications.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {applications.map((application) => {
                const property = getApplicationProperty(application);

                return (
                  <div
                    key={application.id}
                    className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-black">
                          {property?.title || "Rental Listing"}
                        </h3>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                          {application.status}
                        </span>
                      </div>

                      <p className="mt-2 font-bold text-slate-500">
                        {property
                          ? `${property.city}, ${
                              property.state
                            } · $${property.monthly_rent.toLocaleString()}/mo`
                          : "Listing details unavailable"}
                      </p>

                      <p className="mt-2 text-sm font-bold text-slate-500">
                        Submitted{" "}
                        {new Date(application.created_at).toLocaleDateString()}
                        {application.move_in_date
                          ? ` · Move-in: ${application.move_in_date}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        href={`/dashboard/tenant/applications/${application.id}`}
                        className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
                      >
                        View Application
                      </Link>

                      <Link
                        href={`/listings/${application.property_id}`}
                        className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
                      >
                        View Listing
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No applications yet</h3>

              <p className="mt-3 text-slate-600">
                Apply to a rental listing to track your application here.
              </p>

              <Link
                href="/listings"
                className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
              >
                Browse Rentals
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}