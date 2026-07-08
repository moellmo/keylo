"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ScreeningRequest = {
  id: string;
  application_id: string;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  screening_type: string;
  status:
    | "requested"
    | "tenant_approved"
    | "tenant_declined"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "failed";
  provider: string | null;
  provider_reference_id: string | null;
  landlord_note: string | null;
  tenant_consent_text: string | null;
  tenant_consented_at: string | null;
  tenant_declined_at: string | null;
  requested_at: string;
  completed_at: string | null;
  created_at: string;
  applications:
    | {
        first_name: string;
        last_name: string;
        email: string;
        status: string;
        properties:
          | {
              title: string;
              city: string;
              state: string;
            }
          | {
              title: string;
              city: string;
              state: string;
            }[]
          | null;
      }
    | {
        first_name: string;
        last_name: string;
        email: string;
        status: string;
        properties:
          | {
              title: string;
              city: string;
              state: string;
            }
          | {
              title: string;
              city: string;
              state: string;
            }[]
          | null;
      }[]
    | null;
};

type StatusFilter =
  | "all"
  | "requested"
  | "tenant_approved"
  | "tenant_declined"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "failed";

type TypeFilter =
  | "all"
  | "credit"
  | "background"
  | "credit_background"
  | "income_verification"
  | "custom";

const PAGE_SIZE = 25;

function getApplication(screening: ScreeningRequest) {
  if (Array.isArray(screening.applications)) {
    return screening.applications[0] || null;
  }

  return screening.applications;
}

function getApplicationProperty(application: NonNullable<ReturnType<typeof getApplication>>) {
  if (Array.isArray(application.properties)) {
    return application.properties[0] || null;
  }

  return application.properties;
}

function formatScreeningStatus(status: string) {
  if (status === "requested") return "Requested";
  if (status === "tenant_approved") return "Tenant Approved";
  if (status === "tenant_declined") return "Tenant Declined";
  if (status === "in_progress") return "In Progress";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "failed") return "Failed";

  return status.replaceAll("_", " ");
}

function formatScreeningType(type: string) {
  if (type === "credit") return "Credit";
  if (type === "background") return "Background";
  if (type === "credit_background") return "Credit + Background";
  if (type === "income_verification") return "Income Verification";
  if (type === "custom") return "Custom";

  return type.replaceAll("_", " ");
}

function statusClass(status: string) {
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

export default function AdminScreeningsPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");

  const [screenings, setScreenings] = useState<ScreeningRequest[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadScreenings();
  }, []);

  async function loadScreenings() {
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
      setMessage("You do not have permission to view screenings.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("screening_requests")
      .select(
        `
        id,
        application_id,
        property_id,
        tenant_id,
        landlord_id,
        screening_type,
        status,
        provider,
        provider_reference_id,
        landlord_note,
        tenant_consent_text,
        tenant_consented_at,
        tenant_declined_at,
        requested_at,
        completed_at,
        created_at,
        applications (
          first_name,
          last_name,
          email,
          status,
          properties (
            title,
            city,
            state
          )
        )
      `
      )
      .order("requested_at", { ascending: false })
      .limit(500);

    if (error) {
      setMessage(error.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    setScreenings((data || []) as unknown as ScreeningRequest[]);
    setAllowed(true);
    setLoading(false);
  }

  const filteredScreenings = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return screenings.filter((screening) => {
      const application = getApplication(screening);
      const property = application ? getApplicationProperty(application) : null;

      const applicantName = application
        ? `${application.first_name} ${application.last_name}`.toLowerCase()
        : "";

      const matchesStatus =
        statusFilter === "all" ? true : screening.status === statusFilter;

      const matchesType =
        typeFilter === "all" ? true : screening.screening_type === typeFilter;

      const matchesSearch =
        !cleanSearch ||
        applicantName.includes(cleanSearch) ||
        (application?.email || "").toLowerCase().includes(cleanSearch) ||
        (property?.title || "").toLowerCase().includes(cleanSearch) ||
        (property?.city || "").toLowerCase().includes(cleanSearch) ||
        (property?.state || "").toLowerCase().includes(cleanSearch) ||
        (screening.provider || "").toLowerCase().includes(cleanSearch) ||
        (screening.landlord_note || "").toLowerCase().includes(cleanSearch);

      return matchesStatus && matchesType && matchesSearch;
    });
  }, [screenings, search, statusFilter, typeFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredScreenings.length / PAGE_SIZE)
  );

  const visibleScreenings = filteredScreenings.slice(
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

  function updateType(value: TypeFilter) {
    setTypeFilter(value);
    setPage(1);
  }

  const requestedCount = screenings.filter(
    (screening) => screening.status === "requested"
  ).length;

  const approvedCount = screenings.filter(
    (screening) => screening.status === "tenant_approved"
  ).length;

  const declinedCount = screenings.filter(
    (screening) => screening.status === "tenant_declined"
  ).length;

  const completedCount = screenings.filter(
    (screening) => screening.status === "completed"
  ).length;

  const failedCount = screenings.filter(
    (screening) => screening.status === "failed"
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading screenings...</h1>
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
              Screenings
            </h1>

            <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
              Review screening requests, tenant consent, future provider
              progress, and completed checks.
            </p>
          </div>

          <button
            type="button"
            onClick={loadScreenings}
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
          <StatCard title="Total" value={screenings.length} />
          <StatCard title="Requested" value={requestedCount} />
          <StatCard title="Approved" value={approvedCount} />
          <StatCard title="Declined" value={declinedCount} />
          <StatCard title="Completed" value={completedCount} />
          <StatCard title="Failed" value={failedCount} />
        </section>

        <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-5">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">
                Search by applicant, email, listing, city, provider, or note
              </span>

              <input
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Example: applicant name, email, listing, TransUnion..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-slate-500"
              />
            </label>

            <div className="grid gap-5 xl:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-black text-slate-700">
                  Screening Status
                </p>

                <div className="flex flex-wrap gap-2">
                  <FilterButton
                    active={statusFilter === "all"}
                    label="All"
                    onClick={() => updateStatus("all")}
                  />
                  <FilterButton
                    active={statusFilter === "requested"}
                    label="Requested"
                    onClick={() => updateStatus("requested")}
                  />
                  <FilterButton
                    active={statusFilter === "tenant_approved"}
                    label="Tenant Approved"
                    onClick={() => updateStatus("tenant_approved")}
                  />
                  <FilterButton
                    active={statusFilter === "tenant_declined"}
                    label="Tenant Declined"
                    onClick={() => updateStatus("tenant_declined")}
                  />
                  <FilterButton
                    active={statusFilter === "in_progress"}
                    label="In Progress"
                    onClick={() => updateStatus("in_progress")}
                  />
                  <FilterButton
                    active={statusFilter === "completed"}
                    label="Completed"
                    onClick={() => updateStatus("completed")}
                  />
                  <FilterButton
                    active={statusFilter === "failed"}
                    label="Failed"
                    onClick={() => updateStatus("failed")}
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-black text-slate-700">
                  Screening Type
                </p>

                <div className="flex flex-wrap gap-2">
                  <FilterButton
                    active={typeFilter === "all"}
                    label="All"
                    onClick={() => updateType("all")}
                  />
                  <FilterButton
                    active={typeFilter === "credit"}
                    label="Credit"
                    onClick={() => updateType("credit")}
                  />
                  <FilterButton
                    active={typeFilter === "background"}
                    label="Background"
                    onClick={() => updateType("background")}
                  />
                  <FilterButton
                    active={typeFilter === "credit_background"}
                    label="Credit + Background"
                    onClick={() => updateType("credit_background")}
                  />
                  <FilterButton
                    active={typeFilter === "income_verification"}
                    label="Income"
                    onClick={() => updateType("income_verification")}
                  />
                  <FilterButton
                    active={typeFilter === "custom"}
                    label="Custom"
                    onClick={() => updateType("custom")}
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
                <h2 className="text-2xl font-black">Screening Results</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Showing {visibleScreenings.length} of{" "}
                  {filteredScreenings.length} screening requests.
                </p>
              </div>

              <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
                Page {page} of {totalPages}
              </span>
            </div>
          </div>

          {visibleScreenings.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {visibleScreenings.map((screening) => (
                <ScreeningRow key={screening.id} screening={screening} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No screenings found</h3>
              <p className="mt-3 text-slate-600">
                Try a different search, status, or type filter.
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

function ScreeningRow({ screening }: { screening: ScreeningRequest }) {
  const application = getApplication(screening);
  const property = application ? getApplicationProperty(application) : null;

  return (
    <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-black">
            {application
              ? `${application.first_name} ${application.last_name}`
              : "Applicant"}
          </h3>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
              screening.status
            )}`}
          >
            {formatScreeningStatus(screening.status)}
          </span>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
            {formatScreeningType(screening.screening_type)}
          </span>
        </div>

        <p className="mt-2 font-bold text-slate-500">
          {application?.email || "No email"}
        </p>

        <p className="mt-2 text-sm font-bold text-slate-500">
          Listing:{" "}
          {property
            ? `${property.title} · ${property.city}, ${property.state}`
            : "Unknown listing"}
        </p>

        <p className="mt-1 text-sm font-bold text-slate-500">
          Provider: {screening.provider || "Manual placeholder"}
          {screening.provider_reference_id
            ? ` · Ref: ${screening.provider_reference_id}`
            : ""}
        </p>

        {screening.landlord_note && (
          <div className="mt-3 rounded-2xl bg-[#f7f4ef] p-4 text-slate-700">
            <p className="text-sm font-black">Landlord Note</p>
            <p className="mt-2 whitespace-pre-wrap leading-7">
              {screening.landlord_note}
            </p>
          </div>
        )}

        <p className="mt-3 text-xs font-bold text-slate-400">
          Requested {new Date(screening.requested_at).toLocaleString()}
          {screening.tenant_consented_at
            ? ` · Consent ${new Date(
                screening.tenant_consented_at
              ).toLocaleDateString()}`
            : ""}
          {screening.tenant_declined_at
            ? ` · Declined ${new Date(
                screening.tenant_declined_at
              ).toLocaleDateString()}`
            : ""}
          {screening.completed_at
            ? ` · Completed ${new Date(
                screening.completed_at
              ).toLocaleDateString()}`
            : ""}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/dashboard/landlord/applications/${screening.application_id}`}
          className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-black text-white"
        >
          Open Application
        </Link>

        {property && (
          <Link
            href={`/admin/listings/${screening.property_id}/preview`}
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