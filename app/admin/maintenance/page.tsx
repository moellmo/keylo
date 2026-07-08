"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type MaintenanceRequest = {
  id: string;
  lease_id: string;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  title: string;
  description: string;
  priority: "low" | "normal" | "urgent" | "emergency";
  status: "open" | "in_progress" | "resolved" | "closed" | "cancelled";
  landlord_notes: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  leases:
    | {
        tenant_name: string | null;
        landlord_name: string | null;
        property_address: string | null;
      }
    | {
        tenant_name: string | null;
        landlord_name: string | null;
        property_address: string | null;
      }[]
    | null;
};

type StatusFilter =
  | "all"
  | "open"
  | "in_progress"
  | "resolved"
  | "closed"
  | "cancelled";

type PriorityFilter = "all" | "low" | "normal" | "urgent" | "emergency";

const PAGE_SIZE = 25;

function getLease(request: MaintenanceRequest) {
  if (Array.isArray(request.leases)) {
    return request.leases[0] || null;
  }

  return request.leases;
}

function formatStatus(status: string) {
  if (status === "open") return "Open";
  if (status === "in_progress") return "In Progress";
  if (status === "resolved") return "Resolved";
  if (status === "closed") return "Closed";
  if (status === "cancelled") return "Cancelled";

  return status.replaceAll("_", " ");
}

function statusClass(status: string, priority: string) {
  if (status === "resolved" || status === "closed") {
    return "bg-green-50 text-green-700";
  }

  if (status === "cancelled") {
    return "bg-slate-100 text-slate-600";
  }

  if (priority === "urgent" || priority === "emergency") {
    return "bg-red-50 text-red-700";
  }

  if (status === "in_progress") {
    return "bg-blue-50 text-blue-700";
  }

  return "bg-yellow-50 text-yellow-700";
}

function priorityClass(priority: string) {
  if (priority === "emergency") return "bg-red-100 text-red-800";
  if (priority === "urgent") return "bg-red-50 text-red-700";
  if (priority === "normal") return "bg-blue-50 text-blue-700";

  return "bg-slate-100 text-slate-600";
}

export default function AdminMaintenancePage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadMaintenance();
  }, []);

  async function loadMaintenance() {
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
      setMessage("You do not have permission to view maintenance.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("maintenance_requests")
      .select(
        `
        id,
        lease_id,
        property_id,
        tenant_id,
        landlord_id,
        title,
        description,
        priority,
        status,
        landlord_notes,
        resolved_at,
        closed_at,
        created_at,
        leases (
          tenant_name,
          landlord_name,
          property_address
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

    setRequests((data || []) as unknown as MaintenanceRequest[]);
    setAllowed(true);
    setLoading(false);
  }

  const filteredRequests = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return requests.filter((request) => {
      const lease = getLease(request);

      const matchesStatus =
        statusFilter === "all" ? true : request.status === statusFilter;

      const matchesPriority =
        priorityFilter === "all" ? true : request.priority === priorityFilter;

      const matchesSearch =
        !cleanSearch ||
        request.title.toLowerCase().includes(cleanSearch) ||
        request.description.toLowerCase().includes(cleanSearch) ||
        (request.landlord_notes || "").toLowerCase().includes(cleanSearch) ||
        (lease?.tenant_name || "").toLowerCase().includes(cleanSearch) ||
        (lease?.landlord_name || "").toLowerCase().includes(cleanSearch) ||
        (lease?.property_address || "").toLowerCase().includes(cleanSearch);

      return matchesStatus && matchesPriority && matchesSearch;
    });
  }, [priorityFilter, requests, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));

  const visibleRequests = filteredRequests.slice(
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

  function updatePriority(value: PriorityFilter) {
    setPriorityFilter(value);
    setPage(1);
  }

  const activeCount = requests.filter(
    (request) => request.status === "open" || request.status === "in_progress"
  ).length;

  const urgentCount = requests.filter(
    (request) =>
      (request.priority === "urgent" || request.priority === "emergency") &&
      (request.status === "open" || request.status === "in_progress")
  ).length;

  const resolvedCount = requests.filter(
    (request) => request.status === "resolved" || request.status === "closed"
  ).length;

  const cancelledCount = requests.filter(
    (request) => request.status === "cancelled"
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading maintenance...</h1>
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
              Maintenance
            </h1>

            <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
              Review tenant repair requests, urgent issues, open work, and
              resolved maintenance across Keylo.
            </p>
          </div>

          <button
            type="button"
            onClick={loadMaintenance}
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
          <StatCard title="Total" value={requests.length} />
          <StatCard title="Active" value={activeCount} />
          <StatCard title="Urgent" value={urgentCount} />
          <StatCard title="Resolved" value={resolvedCount} />
          <StatCard title="Cancelled" value={cancelledCount} />
        </section>

        <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-5">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">
                Search by issue, tenant, landlord, notes, or property address
              </span>

              <input
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Example: leak, urgent, tenant name, address..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-slate-500"
              />
            </label>

            <div className="grid gap-5 xl:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-black text-slate-700">
                  Status
                </p>

                <div className="flex flex-wrap gap-2">
                  <FilterButton
                    active={statusFilter === "all"}
                    label="All"
                    onClick={() => updateStatus("all")}
                  />
                  <FilterButton
                    active={statusFilter === "open"}
                    label="Open"
                    onClick={() => updateStatus("open")}
                  />
                  <FilterButton
                    active={statusFilter === "in_progress"}
                    label="In Progress"
                    onClick={() => updateStatus("in_progress")}
                  />
                  <FilterButton
                    active={statusFilter === "resolved"}
                    label="Resolved"
                    onClick={() => updateStatus("resolved")}
                  />
                  <FilterButton
                    active={statusFilter === "closed"}
                    label="Closed"
                    onClick={() => updateStatus("closed")}
                  />
                  <FilterButton
                    active={statusFilter === "cancelled"}
                    label="Cancelled"
                    onClick={() => updateStatus("cancelled")}
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-black text-slate-700">
                  Priority
                </p>

                <div className="flex flex-wrap gap-2">
                  <FilterButton
                    active={priorityFilter === "all"}
                    label="All"
                    onClick={() => updatePriority("all")}
                  />
                  <FilterButton
                    active={priorityFilter === "low"}
                    label="Low"
                    onClick={() => updatePriority("low")}
                  />
                  <FilterButton
                    active={priorityFilter === "normal"}
                    label="Normal"
                    onClick={() => updatePriority("normal")}
                  />
                  <FilterButton
                    active={priorityFilter === "urgent"}
                    label="Urgent"
                    onClick={() => updatePriority("urgent")}
                  />
                  <FilterButton
                    active={priorityFilter === "emergency"}
                    label="Emergency"
                    onClick={() => updatePriority("emergency")}
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
                <h2 className="text-2xl font-black">Maintenance Results</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Showing {visibleRequests.length} of {filteredRequests.length} requests.
                </p>
              </div>

              <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
                Page {page} of {totalPages}
              </span>
            </div>
          </div>

          {visibleRequests.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {visibleRequests.map((request) => (
                <MaintenanceRow key={request.id} request={request} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No maintenance found</h3>
              <p className="mt-3 text-slate-600">
                Try a different search, status, or priority filter.
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

function MaintenanceRow({ request }: { request: MaintenanceRequest }) {
  const lease = getLease(request);

  return (
    <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-black">{request.title}</h3>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
              request.status,
              request.priority
            )}`}
          >
            {formatStatus(request.status)}
          </span>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${priorityClass(
              request.priority
            )}`}
          >
            {request.priority}
          </span>
        </div>

        <p className="mt-2 max-w-4xl leading-7 text-slate-700">
          {request.description}
        </p>

        {request.landlord_notes && (
          <div className="mt-3 rounded-2xl bg-[#f7f4ef] p-4 text-slate-700">
            <p className="text-sm font-black">Landlord Notes</p>
            <p className="mt-2 whitespace-pre-wrap leading-7">
              {request.landlord_notes}
            </p>
          </div>
        )}

        <p className="mt-3 text-sm font-bold text-slate-500">
          Tenant: {lease?.tenant_name || "Not provided"}
        </p>

        <p className="mt-1 text-sm font-bold text-slate-500">
          Landlord: {lease?.landlord_name || "Not provided"}
        </p>

        <p className="mt-1 text-sm font-bold text-slate-500">
          Property: {lease?.property_address || "No property address"}
        </p>

        <p className="mt-2 text-xs font-bold text-slate-400">
          Submitted {new Date(request.created_at).toLocaleString()}
          {request.resolved_at
            ? ` · Resolved ${new Date(request.resolved_at).toLocaleDateString()}`
            : ""}
          {request.closed_at
            ? ` · Closed ${new Date(request.closed_at).toLocaleDateString()}`
            : ""}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/dashboard/landlord/maintenance/${request.id}`}
          className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-black text-white"
        >
          Open Request
        </Link>

        <Link
          href={`/dashboard/landlord/leases/${request.lease_id}`}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black"
        >
          Open Lease
        </Link>
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