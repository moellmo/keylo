"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Application = {
  id: string;
  property_id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  screening_status: string | null;
  created_at: string;
  properties:
    | {
        id: string;
        title: string;
        city: string;
        state: string;
        landlord_id: string | null;
      }
    | {
        id: string;
        title: string;
        city: string;
        state: string;
        landlord_id: string | null;
      }[]
    | null;
};

type StatusFilter =
  | "all"
  | "submitted"
  | "reviewing"
  | "approved"
  | "rejected"
  | "withdrawn";

type ScreeningFilter =
  | "all"
  | "not_requested"
  | "requested"
  | "tenant_approved"
  | "tenant_declined"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "failed";

const PAGE_SIZE = 25;

function getApplicationProperty(application: Application) {
  if (Array.isArray(application.properties)) {
    return application.properties[0] || null;
  }

  return application.properties;
}

function formatScreeningStatus(status: string | null) {
  if (!status || status === "not_requested") return "Not Requested";
  if (status === "requested") return "Requested";
  if (status === "tenant_approved") return "Tenant Approved";
  if (status === "tenant_declined") return "Tenant Declined";
  if (status === "in_progress") return "In Progress";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "failed") return "Failed";

  return status.replaceAll("_", " ");
}

function statusClass(status: string) {
  if (status === "approved") return "bg-green-50 text-green-700";
  if (status === "rejected" || status === "withdrawn") {
    return "bg-red-50 text-red-700";
  }
  if (status === "submitted" || status === "reviewing") {
    return "bg-yellow-50 text-yellow-700";
  }

  return "bg-slate-100 text-slate-600";
}

function screeningStatusClass(status: string | null) {
  if (status === "tenant_approved" || status === "completed") {
    return "bg-green-50 text-green-700";
  }

  if (status === "tenant_declined" || status === "failed") {
    return "bg-red-50 text-red-700";
  }

  if (status === "requested" || status === "in_progress") {
    return "bg-yellow-50 text-yellow-700";
  }

  return "bg-slate-100 text-slate-600";
}

export default function AdminApplicationsPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");

  const [applications, setApplications] = useState<Application[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [screeningFilter, setScreeningFilter] =
    useState<ScreeningFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadApplications();
  }, []);

  async function loadApplications() {
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
      setMessage("You do not have permission to view applications.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("applications")
      .select(
        `
        id,
        property_id,
        tenant_id,
        first_name,
        last_name,
        email,
        phone,
        status,
        screening_status,
        created_at,
        properties (
          id,
          title,
          city,
          state,
          landlord_id
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      setMessage(error.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    setApplications((data || []) as unknown as Application[]);
    setAllowed(true);
    setLoading(false);
  }

  const filteredApplications = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return applications.filter((application) => {
      const property = getApplicationProperty(application);

      const fullName = `${application.first_name} ${application.last_name}`.toLowerCase();
      const email = application.email.toLowerCase();
      const listingTitle = (property?.title || "").toLowerCase();
      const listingCity = (property?.city || "").toLowerCase();
      const listingState = (property?.state || "").toLowerCase();

      const cleanScreeningStatus =
        application.screening_status || "not_requested";

      const matchesStatus =
        statusFilter === "all" ? true : application.status === statusFilter;

      const matchesScreening =
        screeningFilter === "all"
          ? true
          : cleanScreeningStatus === screeningFilter;

      const matchesSearch =
        !cleanSearch ||
        fullName.includes(cleanSearch) ||
        email.includes(cleanSearch) ||
        listingTitle.includes(cleanSearch) ||
        listingCity.includes(cleanSearch) ||
        listingState.includes(cleanSearch);

      return matchesStatus && matchesScreening && matchesSearch;
    });
  }, [applications, screeningFilter, search, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredApplications.length / PAGE_SIZE)
  );

  const visibleApplications = filteredApplications.slice(
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

  function updateScreening(value: ScreeningFilter) {
    setScreeningFilter(value);
    setPage(1);
  }

  const submittedCount = applications.filter(
    (application) => application.status === "submitted"
  ).length;

  const reviewingCount = applications.filter(
    (application) => application.status === "reviewing"
  ).length;

  const approvedCount = applications.filter(
    (application) => application.status === "approved"
  ).length;

  const screeningRequestedCount = applications.filter(
    (application) =>
      application.screening_status === "requested" ||
      application.screening_status === "in_progress"
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading applications...</h1>
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
              Applications
            </h1>

            <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
              Search applications, filter by status, and review screening
              progress.
            </p>
          </div>

          <button
            type="button"
            onClick={loadApplications}
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

        <section className="mt-8 grid gap-5 md:grid-cols-4">
          <StatCard title="Total" value={applications.length} />
          <StatCard title="Submitted" value={submittedCount} />
          <StatCard title="Reviewing" value={reviewingCount} />
          <StatCard title="Approved" value={approvedCount} />
          <StatCard title="Screening Open" value={screeningRequestedCount} />
        </section>

        <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-5">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">
                Search by applicant, email, listing, city, or state
              </span>

              <input
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Example: tenant@email.com, Passaic, listing name..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-slate-500"
              />
            </label>

            <div className="grid gap-5 xl:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-black text-slate-700">
                  Application Status
                </p>

                <div className="flex flex-wrap gap-2">
                  <FilterButton
                    active={statusFilter === "all"}
                    label="All"
                    onClick={() => updateStatus("all")}
                  />
                  <FilterButton
                    active={statusFilter === "submitted"}
                    label="Submitted"
                    onClick={() => updateStatus("submitted")}
                  />
                  <FilterButton
                    active={statusFilter === "reviewing"}
                    label="Reviewing"
                    onClick={() => updateStatus("reviewing")}
                  />
                  <FilterButton
                    active={statusFilter === "approved"}
                    label="Approved"
                    onClick={() => updateStatus("approved")}
                  />
                  <FilterButton
                    active={statusFilter === "rejected"}
                    label="Rejected"
                    onClick={() => updateStatus("rejected")}
                  />
                  <FilterButton
                    active={statusFilter === "withdrawn"}
                    label="Withdrawn"
                    onClick={() => updateStatus("withdrawn")}
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-black text-slate-700">
                  Screening Status
                </p>

                <div className="flex flex-wrap gap-2">
                  <FilterButton
                    active={screeningFilter === "all"}
                    label="All"
                    onClick={() => updateScreening("all")}
                  />
                  <FilterButton
                    active={screeningFilter === "not_requested"}
                    label="Not Requested"
                    onClick={() => updateScreening("not_requested")}
                  />
                  <FilterButton
                    active={screeningFilter === "requested"}
                    label="Requested"
                    onClick={() => updateScreening("requested")}
                  />
                  <FilterButton
                    active={screeningFilter === "tenant_approved"}
                    label="Tenant Approved"
                    onClick={() => updateScreening("tenant_approved")}
                  />
                  <FilterButton
                    active={screeningFilter === "tenant_declined"}
                    label="Tenant Declined"
                    onClick={() => updateScreening("tenant_declined")}
                  />
                  <FilterButton
                    active={screeningFilter === "completed"}
                    label="Completed"
                    onClick={() => updateScreening("completed")}
                  />
                  <FilterButton
                    active={screeningFilter === "failed"}
                    label="Failed"
                    onClick={() => updateScreening("failed")}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black">Application Results</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Showing {visibleApplications.length} of{" "}
                  {filteredApplications.length} applications.
                </p>
              </div>

              <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
                Page {page} of {totalPages}
              </span>
            </div>
          </div>

          {visibleApplications.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {visibleApplications.map((application) => (
                <ApplicationRow key={application.id} application={application} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No applications found</h3>
              <p className="mt-3 text-slate-600">
                Try a different search, application status, or screening filter.
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

function ApplicationRow({ application }: { application: Application }) {
  const property = getApplicationProperty(application);

  return (
    <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-black">
            {application.first_name} {application.last_name}
          </h3>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
              application.status
            )}`}
          >
            {application.status}
          </span>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${screeningStatusClass(
              application.screening_status
            )}`}
          >
            Screening: {formatScreeningStatus(application.screening_status)}
          </span>
        </div>

        <p className="mt-2 font-bold text-slate-500">{application.email}</p>

        {application.phone && (
          <p className="mt-1 text-sm font-bold text-slate-500">
            {application.phone}
          </p>
        )}

        <p className="mt-2 text-sm font-bold text-slate-500">
          Listing:{" "}
          {property
            ? `${property.title} · ${property.city}, ${property.state}`
            : "Unknown listing"}
        </p>

        <p className="mt-2 text-xs font-bold text-slate-400">
          Submitted {new Date(application.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/dashboard/landlord/applications/${application.id}`}
          className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-black text-white"
        >
          Open Application
        </Link>

        {property?.id && (
          <Link
            href={`/admin/listings/${property.id}/preview`}
            className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black"
          >
            View Listing
          </Link>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string | number }) {
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