"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ArchiveListingButton from "../ArchiveListingButton";
import ResubmitListingButton from "../ResubmitListingButton";

type PropertyWithApplications = {
  id: string;
  title: string;
  monthly_rent: number;
  city: string;
  state: string;
  status: string;
  rejection_note: string | null;
  created_at: string;
  applications: {
    id: string;
    status?: string | null;
    screening_status?: string | null;
  }[];
};

type CompanyRole =
  | "owner"
  | "admin"
  | "manager"
  | "maintenance"
  | "accounting"
  | "viewer"
  | "";

type CompanyMembership = {
  company_id: string;
  role: CompanyRole;
  landlord_companies:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};

function getCompanyFromMembership(membership: CompanyMembership | null) {
  if (!membership) return null;

  if (Array.isArray(membership.landlord_companies)) {
    return membership.landlord_companies[0] || null;
  }

  return membership.landlord_companies;
}

function canManageListings(role: CompanyRole) {
  return role === "owner" || role === "admin" || role === "manager";
}

function canViewListings(role: CompanyRole) {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "manager" ||
    role === "viewer"
  );
}

function statusLabel(status: string) {
  if (status === "pending") return "Pending Review";
  if (status === "published") return "Published";
  if (status === "draft") return "Draft";
  if (status === "paused") return "Paused";
  if (status === "archived") return "Archived";
  if (status === "rejected") return "Rejected";
  return status;
}

function statusClass(status: string) {
  if (status === "published") return "bg-green-50 text-green-700";
  if (status === "pending") return "bg-yellow-50 text-yellow-700";
  if (status === "rejected") return "bg-red-50 text-red-700";
  if (status === "archived") return "bg-slate-200 text-slate-600";
  if (status === "paused") return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

function getApplications(listing: PropertyWithApplications) {
  return listing.applications || [];
}

export default function LandlordPropertiesPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [companyRole, setCompanyRole] = useState<CompanyRole>("");
  const [hasCompany, setHasCompany] = useState(false);

  const [listings, setListings] = useState<PropertyWithApplications[]>([]);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    loadListings();
  }, []);

  async function loadListings() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please log in as a landlord.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      setMessage("Could not load your account.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    if (profile.role !== "landlord" && profile.role !== "admin") {
      setMessage("Only landlord accounts can view listings.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    let companyId: string | null = null;
    let role: CompanyRole = "";

    const { data: membershipRows, error: membershipError } = await supabase
      .from("landlord_company_members")
      .select(
        `
        company_id,
        role,
        landlord_companies (
          id,
          name
        )
      `
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1);

    if (membershipError) {
      setMessage(membershipError.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    const firstMembership =
      ((membershipRows || [])[0] as unknown as
        | CompanyMembership
        | undefined) || null;

    const company = getCompanyFromMembership(firstMembership);

    if (firstMembership && company) {
      companyId = company.id;
      role = firstMembership.role;
      setCompanyName(company.name);
      setCompanyRole(role);
      setHasCompany(true);
    } else {
      setCompanyName("");
      setCompanyRole("");
      setHasCompany(false);
    }

    const isPersonalLandlord = !companyId;
    const isAdmin = profile.role === "admin";

    if (!isAdmin && companyId && !canViewListings(role)) {
      setMessage("Your company role does not have permission to view listings.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    let query = supabase
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
          id,
          status,
          screening_status
        )
      `
      )
      .order("created_at", { ascending: false });

    if (isAdmin) {
      // Admin can see all from admin side, but on landlord dashboard keep own/company behavior.
      if (companyId) {
        query = query.or(
          `landlord_company_id.eq.${companyId},landlord_id.eq.${user.id}`
        );
      } else {
        query = query.eq("landlord_id", user.id);
      }
    } else if (companyId) {
      query = query.or(
        `landlord_company_id.eq.${companyId},landlord_id.eq.${user.id}`
      );
    } else if (isPersonalLandlord) {
      query = query.eq("landlord_id", user.id);
    }

    const { data, error } = await query;

    if (error) {
      setMessage(error.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    setListings((data || []) as unknown as PropertyWithApplications[]);
    setAllowed(true);
    setLoading(false);
  }

  const filteredListings = useMemo(() => {
    if (activeTab === "all") return listings;
    return listings.filter((listing) => listing.status === activeTab);
  }, [activeTab, listings]);

  const counts = {
    all: listings.length,
    published: listings.filter((item) => item.status === "published").length,
    pending: listings.filter((item) => item.status === "pending").length,
    rejected: listings.filter((item) => item.status === "rejected").length,
    draft: listings.filter((item) => item.status === "draft").length,
    archived: listings.filter((item) => item.status === "archived").length,
  };

  const userCanManageListings =
    !hasCompany || canManageListings(companyRole) || companyRole === "";

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-black sm:text-3xl">
            Loading listings...
          </h1>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <div className="rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <h1 className="text-3xl font-black">Listings unavailable</h1>
            <p className="mt-3 text-slate-600">{message}</p>

            <Link
              href="/dashboard/landlord"
              className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/dashboard/landlord"
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Landlord Dashboard
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Listings
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
                {hasCompany ? "Company Listings" : "Your Listings"}
              </h1>

              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                View all rental listings, review status, applicants, and public
                listing links in one place.
              </p>

              {hasCompany && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">
                    Company: {companyName}
                  </span>

                  <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black capitalize text-slate-700">
                    Role: {companyRole}
                  </span>
                </div>
              )}
            </div>

            {userCanManageListings && (
              <Link
                href="/dashboard/landlord/properties/new"
                className="rounded-full bg-slate-950 px-6 py-4 text-center font-black text-white"
              >
                Post New Listing
              </Link>
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <TabButton
              active={activeTab === "all"}
              label={`All (${counts.all})`}
              onClick={() => setActiveTab("all")}
            />
            <TabButton
              active={activeTab === "published"}
              label={`Published (${counts.published})`}
              onClick={() => setActiveTab("published")}
            />
            <TabButton
              active={activeTab === "pending"}
              label={`Pending (${counts.pending})`}
              onClick={() => setActiveTab("pending")}
            />
            <TabButton
              active={activeTab === "rejected"}
              label={`Rejected (${counts.rejected})`}
              onClick={() => setActiveTab("rejected")}
            />
            <TabButton
              active={activeTab === "draft"}
              label={`Draft (${counts.draft})`}
              onClick={() => setActiveTab("draft")}
            />
            <TabButton
              active={activeTab === "archived"}
              label={`Archived (${counts.archived})`}
              onClick={() => setActiveTab("archived")}
            />
          </div>
        </div>

        {message && (
          <div className="mt-6 rounded-2xl bg-white px-5 py-4 font-bold text-red-700 shadow-sm ring-1 ring-red-200">
            {message}
          </div>
        )}

        <section className="mt-6 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <h2 className="text-2xl font-black">
              {activeTab === "all"
                ? "All Listings"
                : `${statusLabel(activeTab)} Listings`}
            </h2>

            <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
              {filteredListings.length} listing
              {filteredListings.length === 1 ? "" : "s"}
            </span>
          </div>

          {filteredListings.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {filteredListings.map((listing) => (
                <ListingRow
                  key={listing.id}
                  listing={listing}
                  canManageListings={userCanManageListings}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No listings found</h3>
              <p className="mt-3 text-slate-600">
                There are no listings in this section yet.
              </p>

              {userCanManageListings && (
                <Link
                  href="/dashboard/landlord/properties/new"
                  className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
                >
                  Post New Listing
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-3 text-sm font-black ring-1 ${
        active
          ? "bg-slate-950 text-white ring-slate-950"
          : "bg-white text-slate-700 ring-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

function ListingRow({
  listing,
  canManageListings,
}: {
  listing: PropertyWithApplications;
  canManageListings: boolean;
}) {
  const applications = getApplications(listing);

  return (
    <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-black sm:text-xl">{listing.title}</h3>

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
          {applications.length} application
          {applications.length === 1 ? "" : "s"} · Created{" "}
          {new Date(listing.created_at).toLocaleDateString()}
        </p>

        {listing.status === "pending" && (
          <div className="mt-3 rounded-2xl bg-yellow-50 px-4 py-3 text-sm font-bold text-yellow-700">
            This listing is waiting for admin approval before it appears
            publicly.
          </div>
        )}

        {listing.status === "rejected" && listing.rejection_note && (
          <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            Rejection reason: {listing.rejection_note}
          </div>
        )}

        {listing.status === "rejected" && !listing.rejection_note && (
          <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            This listing was rejected. Please edit and resubmit.
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:flex sm:flex-row sm:flex-wrap">
        <Link
          href={`/dashboard/landlord/properties/${listing.id}/preview`}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
        >
          Preview
        </Link>

        {listing.status === "published" && (
          <Link
            href={`/listings/${listing.id}`}
            className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
          >
            Public
          </Link>
        )}

        {canManageListings && (
          <Link
            href={`/dashboard/landlord/properties/${listing.id}/edit`}
            className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
          >
            Edit
          </Link>
        )}

        {canManageListings && listing.status === "rejected" && (
          <ResubmitListingButton propertyId={listing.id} />
        )}

        {canManageListings && <ArchiveListingButton propertyId={listing.id} />}

        <Link
          href={`/dashboard/landlord/properties/${listing.id}/applications`}
          className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
        >
          Applicants
        </Link>
      </div>
    </div>
  );
}