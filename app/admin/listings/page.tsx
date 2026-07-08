"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminListingStatusButton from "../AdminListingStatusButton";
import RejectListingButton from "../RejectListingButton";

type Property = {
  id: string;
  landlord_id: string | null;
  title: string;
  monthly_rent: number;
  city: string;
  state: string;
  status: string;
  created_at: string;
  rejection_note: string | null;
};

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
};

type StatusFilter =
  | "all"
  | "pending"
  | "published"
  | "paused"
  | "draft"
  | "rejected"
  | "archived";

const PAGE_SIZE = 25;

export default function AdminListingsPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");

  const [properties, setProperties] = useState<Property[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

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
      setMessage("Please log in as an admin.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: currentProfile, error: currentProfileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (currentProfileError || currentProfile?.role !== "admin") {
      setMessage("You do not have permission to view listings.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: propertyRows, error: propertyError } = await supabase
      .from("properties")
      .select(
        "id, landlord_id, title, monthly_rent, city, state, status, rejection_note, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (propertyError) {
      setMessage(propertyError.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .limit(500);

    if (profileError) {
      setMessage(profileError.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    setProperties((propertyRows || []) as Property[]);
    setProfiles((profileRows || []) as Profile[]);
    setAllowed(true);
    setLoading(false);
  }

  function getLandlordName(landlordId: string | null) {
    if (!landlordId) return "Unknown";

    const landlord = profiles.find((profile) => profile.id === landlordId);

    return landlord?.full_name || landlord?.email || "Unknown";
  }

  const filteredListings = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return properties.filter((property) => {
      const landlordName = getLandlordName(property.landlord_id).toLowerCase();

      const matchesStatus =
        statusFilter === "all" ? true : property.status === statusFilter;

      const matchesSearch =
        !cleanSearch ||
        property.title.toLowerCase().includes(cleanSearch) ||
        property.city.toLowerCase().includes(cleanSearch) ||
        property.state.toLowerCase().includes(cleanSearch) ||
        landlordName.includes(cleanSearch);

      return matchesStatus && matchesSearch;
    });
  }, [properties, profiles, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredListings.length / PAGE_SIZE));

  const visibleListings = filteredListings.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function updateStatus(value: StatusFilter) {
    setStatusFilter(value);
    setPage(1);
  }

  const pendingCount = properties.filter(
    (property) => property.status === "pending"
  ).length;
  const publishedCount = properties.filter(
    (property) => property.status === "published"
  ).length;
  const rejectedCount = properties.filter(
    (property) => property.status === "rejected"
  ).length;
  const pausedCount = properties.filter(
    (property) => property.status === "paused"
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading listings...</h1>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Admin access required</h1>
          <p className="mt-3 text-slate-600">{message}</p>

          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/admin" className="text-sm font-bold text-slate-600">
              ← Back to Admin
            </Link>

            <h1 className="mt-4 text-5xl font-black tracking-tight">
              Listings
            </h1>

            <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
              Search listings, filter by status, and manage approvals.
            </p>
          </div>

          <button
            type="button"
            onClick={loadListings}
            className="rounded-full bg-slate-950 px-6 py-3 font-black text-white"
          >
            Refresh
          </button>
        </div>

        {message && (
          <div className="mt-6 rounded-2xl bg-white px-5 py-4 font-bold text-red-700 shadow-sm ring-1 ring-red-200">
            {message}
          </div>
        )}

        <section className="mt-8 grid gap-5 md:grid-cols-5">
          <StatCard title="Total" value={properties.length} />
          <StatCard title="Pending" value={pendingCount} />
          <StatCard title="Published" value={publishedCount} />
          <StatCard title="Paused" value={pausedCount} />
          <StatCard title="Rejected" value={rejectedCount} />
        </section>

        <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">
                Search by title, city, state, or landlord
              </span>

              <input
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Example: Passaic, NJ, landlord name..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-slate-500"
              />
            </label>

            <div>
              <p className="mb-2 text-sm font-black text-slate-700">Status</p>

              <div className="flex flex-wrap gap-2">
                <FilterButton
                  active={statusFilter === "all"}
                  label="All"
                  onClick={() => updateStatus("all")}
                />
                <FilterButton
                  active={statusFilter === "pending"}
                  label="Pending"
                  onClick={() => updateStatus("pending")}
                />
                <FilterButton
                  active={statusFilter === "published"}
                  label="Published"
                  onClick={() => updateStatus("published")}
                />
                <FilterButton
                  active={statusFilter === "paused"}
                  label="Paused"
                  onClick={() => updateStatus("paused")}
                />
                <FilterButton
                  active={statusFilter === "draft"}
                  label="Draft"
                  onClick={() => updateStatus("draft")}
                />
                <FilterButton
                  active={statusFilter === "rejected"}
                  label="Rejected"
                  onClick={() => updateStatus("rejected")}
                />
                <FilterButton
                  active={statusFilter === "archived"}
                  label="Archived"
                  onClick={() => updateStatus("archived")}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black">Listing Results</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Showing {visibleListings.length} of {filteredListings.length} listings.
                </p>
              </div>

              <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
                Page {page} of {totalPages}
              </span>
            </div>
          </div>

          {visibleListings.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {visibleListings.map((property) => (
                <ListingRow
                  key={property.id}
                  property={property}
                  landlordName={getLandlordName(property.landlord_id)}
                  pending={property.status === "pending"}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No listings found</h3>
              <p className="mt-3 text-slate-600">
                Try a different search or status filter.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-200 p-6 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black disabled:opacity-50"
            >
              Previous
            </button>

            <p className="text-center text-sm font-bold text-slate-500">
              Page {page} of {totalPages}
            </p>

            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page === totalPages}
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ title, value }: { title: string | number; value: string | number }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <p className="mt-3 text-4xl font-black">{value}</p>
    </div>
  );
}

function FilterButton({
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
      className={`rounded-full px-5 py-3 text-sm font-black ${
        active
          ? "bg-slate-950 text-white"
          : "border border-slate-300 bg-white text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function listingStatusClass(status: string) {
  if (status === "published") return "bg-green-50 text-green-700";
  if (status === "pending") return "bg-yellow-50 text-yellow-700";
  if (status === "rejected") return "bg-red-50 text-red-700";
  if (status === "paused") return "bg-blue-50 text-blue-700";
  if (status === "archived") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-600";
}

function ListingRow({
  property,
  landlordName,
  pending = false,
}: {
  property: Property;
  landlordName: string;
  pending?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-black">{property.title}</h3>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${listingStatusClass(
              property.status
            )}`}
          >
            {pending ? "Pending Review" : property.status}
          </span>
        </div>

        <p className="mt-2 font-bold text-slate-500">
          {property.city}, {property.state} · $
          {property.monthly_rent.toLocaleString()}/mo
        </p>

        <p className="mt-2 text-sm font-bold text-slate-500">
          Landlord: {landlordName}
        </p>

        <p className="mt-2 text-xs font-bold text-slate-400">
          Created {new Date(property.created_at).toLocaleDateString()}
        </p>

        {property.status === "rejected" && property.rejection_note && (
          <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            Rejection reason: {property.rejection_note}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href={`/admin/listings/${property.id}/preview`}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-center text-sm font-black"
        >
          View
        </Link>

        <Link
          href={`/dashboard/landlord/properties/${property.id}/edit`}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-center text-sm font-black"
        >
          Edit
        </Link>

        <AdminListingStatusButton
          propertyId={property.id}
          status="published"
          label={pending ? "Approve / Publish" : "Publish"}
          variant="dark"
        />

        <AdminListingStatusButton
          propertyId={property.id}
          status="paused"
          label="Pause"
        />

        <AdminListingStatusButton
          propertyId={property.id}
          status="draft"
          label="Draft"
        />

        <AdminListingStatusButton
          propertyId={property.id}
          status="pending"
          label="Pending"
        />

        <AdminListingStatusButton
          propertyId={property.id}
          status="archived"
          label="Archive"
        />

        {pending && <RejectListingButton propertyId={property.id} />}
      </div>
    </div>
  );
}