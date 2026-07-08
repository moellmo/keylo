"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type LeaseRenewalRequest = {
  id: string;
  lease_id: string;
  renewal_lease_id: string | null;
  request_type:
    | "tenant_requests_renewal"
    | "tenant_plans_to_move_out"
    | "landlord_asks_plan"
    | "landlord_offers_renewal"
    | "landlord_declines_renewal";
  status: string;
  current_lease_end_date: string | null;
  proposed_lease_start_date: string | null;
  proposed_lease_end_date: string | null;
  proposed_monthly_rent: number | null;
  proposed_security_deposit: number | null;
  tenant_message: string | null;
  landlord_message: string | null;
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

type RequestTypeFilter =
  | "all"
  | "tenant_requests_renewal"
  | "tenant_plans_to_move_out"
  | "landlord_asks_plan"
  | "landlord_offers_renewal"
  | "landlord_declines_renewal";

type StatusFilter =
  | "all"
  | "open"
  | "tenant_responded"
  | "landlord_responded"
  | "renewal_sent"
  | "renewal_signed"
  | "move_out_confirmed"
  | "closed"
  | "cancelled";

const PAGE_SIZE = 25;

function getLease(request: LeaseRenewalRequest) {
  if (Array.isArray(request.leases)) {
    return request.leases[0] || null;
  }

  return request.leases;
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "Not provided";
  return `$${value.toLocaleString()}`;
}

function formatRenewalType(type: string) {
  if (type === "tenant_requests_renewal") return "Tenant Wants to Renew";
  if (type === "tenant_plans_to_move_out") return "Tenant Plans to Move Out";
  if (type === "landlord_asks_plan") return "Landlord Asked for Plan";
  if (type === "landlord_offers_renewal") return "Renewal Offered";
  if (type === "landlord_declines_renewal") return "Renewal Declined";

  return type.replaceAll("_", " ");
}

function formatRenewalStatus(status: string) {
  if (status === "open") return "Open";
  if (status === "tenant_responded") return "Tenant Responded";
  if (status === "landlord_responded") return "Landlord Responded";
  if (status === "renewal_sent") return "Renewal Lease Sent";
  if (status === "renewal_signed") return "Renewal Signed";
  if (status === "move_out_confirmed") return "Move-Out Confirmed";
  if (status === "closed") return "Closed";
  if (status === "cancelled") return "Cancelled";

  return status.replaceAll("_", " ");
}

function renewalStatusClass(status: string, requestType: string) {
  if (status === "renewal_signed") return "bg-green-50 text-green-700";

  if (
    requestType === "tenant_plans_to_move_out" ||
    requestType === "landlord_declines_renewal" ||
    status === "move_out_confirmed"
  ) {
    return "bg-red-50 text-red-700";
  }

  if (status === "renewal_sent" || requestType === "landlord_offers_renewal") {
    return "bg-blue-50 text-blue-700";
  }

  return "bg-yellow-50 text-yellow-700";
}

function getDaysUntilLeaseEnds(leaseEndDate: string | null) {
  if (!leaseEndDate) return null;

  const today = new Date();
  const endDate = new Date(`${leaseEndDate}T00:00:00`);

  return Math.ceil(
    (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export default function AdminRenewalsPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");

  const [renewals, setRenewals] = useState<LeaseRenewalRequest[]>([]);
  const [search, setSearch] = useState("");
  const [requestTypeFilter, setRequestTypeFilter] =
    useState<RequestTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadRenewals();
  }, []);

  async function loadRenewals() {
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
      setMessage("You do not have permission to view renewals.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("lease_renewal_requests")
      .select(
        `
        id,
        lease_id,
        renewal_lease_id,
        request_type,
        status,
        current_lease_end_date,
        proposed_lease_start_date,
        proposed_lease_end_date,
        proposed_monthly_rent,
        proposed_security_deposit,
        tenant_message,
        landlord_message,
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

    setRenewals((data || []) as unknown as LeaseRenewalRequest[]);
    setAllowed(true);
    setLoading(false);
  }

  const filteredRenewals = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return renewals.filter((request) => {
      const lease = getLease(request);

      const matchesType =
        requestTypeFilter === "all"
          ? true
          : request.request_type === requestTypeFilter;

      const matchesStatus =
        statusFilter === "all" ? true : request.status === statusFilter;

      const matchesSearch =
        !cleanSearch ||
        (lease?.tenant_name || "").toLowerCase().includes(cleanSearch) ||
        (lease?.landlord_name || "").toLowerCase().includes(cleanSearch) ||
        (lease?.property_address || "").toLowerCase().includes(cleanSearch) ||
        formatRenewalType(request.request_type)
          .toLowerCase()
          .includes(cleanSearch);

      return matchesType && matchesStatus && matchesSearch;
    });
  }, [renewals, requestTypeFilter, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRenewals.length / PAGE_SIZE));

  const visibleRenewals = filteredRenewals.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function updateRequestType(value: RequestTypeFilter) {
    setRequestTypeFilter(value);
    setPage(1);
  }

  function updateStatus(value: StatusFilter) {
    setStatusFilter(value);
    setPage(1);
  }

  const wantsToRenewCount = renewals.filter(
    (request) => request.request_type === "tenant_requests_renewal"
  ).length;

  const movingOutCount = renewals.filter(
    (request) => request.request_type === "tenant_plans_to_move_out"
  ).length;

  const offersSentCount = renewals.filter(
    (request) => request.request_type === "landlord_offers_renewal"
  ).length;

  const renewalLeaseSentCount = renewals.filter(
    (request) => request.status === "renewal_sent"
  ).length;

  const completedCount = renewals.filter(
    (request) => request.status === "renewal_signed"
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading renewals...</h1>
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
              Renewals & Move-Outs
            </h1>

            <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
              Search and filter tenant renewal requests, move-out plans,
              landlord offers, and completed renewal leases.
            </p>
          </div>

          <button
            type="button"
            onClick={loadRenewals}
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
          <StatCard title="Total" value={renewals.length} />
          <StatCard title="Want Renew" value={wantsToRenewCount} />
          <StatCard title="Moving Out" value={movingOutCount} />
          <StatCard title="Offers Sent" value={offersSentCount} />
          <StatCard title="Renewal Sent" value={renewalLeaseSentCount} />
          <StatCard title="Completed" value={completedCount} />
        </section>

        <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-5">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">
                Search by tenant, landlord, property address, or renewal type
              </span>

              <input
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Example: tenant name, landlord name, address..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-slate-500"
              />
            </label>

            <div className="grid gap-5 xl:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-black text-slate-700">
                  Request Type
                </p>

                <div className="flex flex-wrap gap-2">
                  <FilterButton
                    active={requestTypeFilter === "all"}
                    label="All"
                    onClick={() => updateRequestType("all")}
                  />
                  <FilterButton
                    active={requestTypeFilter === "tenant_requests_renewal"}
                    label="Wants to Renew"
                    onClick={() =>
                      updateRequestType("tenant_requests_renewal")
                    }
                  />
                  <FilterButton
                    active={requestTypeFilter === "tenant_plans_to_move_out"}
                    label="Moving Out"
                    onClick={() =>
                      updateRequestType("tenant_plans_to_move_out")
                    }
                  />
                  <FilterButton
                    active={requestTypeFilter === "landlord_asks_plan"}
                    label="Asked Plan"
                    onClick={() => updateRequestType("landlord_asks_plan")}
                  />
                  <FilterButton
                    active={requestTypeFilter === "landlord_offers_renewal"}
                    label="Offer Sent"
                    onClick={() =>
                      updateRequestType("landlord_offers_renewal")
                    }
                  />
                  <FilterButton
                    active={requestTypeFilter === "landlord_declines_renewal"}
                    label="Declined"
                    onClick={() =>
                      updateRequestType("landlord_declines_renewal")
                    }
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-black text-slate-700">
                  Renewal Status
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
                    active={statusFilter === "tenant_responded"}
                    label="Tenant Responded"
                    onClick={() => updateStatus("tenant_responded")}
                  />
                  <FilterButton
                    active={statusFilter === "landlord_responded"}
                    label="Landlord Responded"
                    onClick={() => updateStatus("landlord_responded")}
                  />
                  <FilterButton
                    active={statusFilter === "renewal_sent"}
                    label="Renewal Sent"
                    onClick={() => updateStatus("renewal_sent")}
                  />
                  <FilterButton
                    active={statusFilter === "renewal_signed"}
                    label="Signed"
                    onClick={() => updateStatus("renewal_signed")}
                  />
                  <FilterButton
                    active={statusFilter === "move_out_confirmed"}
                    label="Move-Out"
                    onClick={() => updateStatus("move_out_confirmed")}
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
                <h2 className="text-2xl font-black">Renewal Results</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Showing {visibleRenewals.length} of {filteredRenewals.length} renewal updates.
                </p>
              </div>

              <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
                Page {page} of {totalPages}
              </span>
            </div>
          </div>

          {visibleRenewals.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {visibleRenewals.map((request) => (
                <RenewalRow key={request.id} request={request} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No renewals found</h3>
              <p className="mt-3 text-slate-600">
                Try a different search, request type, or status filter.
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

function RenewalRow({ request }: { request: LeaseRenewalRequest }) {
  const lease = getLease(request);
  const daysUntilEnd = getDaysUntilLeaseEnds(request.current_lease_end_date);

  return (
    <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-black">
            {formatRenewalType(request.request_type)}
          </h3>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${renewalStatusClass(
              request.status,
              request.request_type
            )}`}
          >
            {formatRenewalStatus(request.status)}
          </span>

          {daysUntilEnd !== null && daysUntilEnd >= 0 && daysUntilEnd <= 90 && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
              {daysUntilEnd === 0
                ? "Ends Today"
                : `${daysUntilEnd} day${daysUntilEnd === 1 ? "" : "s"} left`}
            </span>
          )}
        </div>

        <p className="mt-2 font-bold text-slate-500">
          {lease?.property_address || "No property address"}
        </p>

        <p className="mt-2 text-sm font-bold text-slate-500">
          Tenant: {lease?.tenant_name || "Not provided"}
        </p>

        <p className="mt-1 text-sm font-bold text-slate-500">
          Landlord: {lease?.landlord_name || "Not provided"}
        </p>

        <p className="mt-2 text-sm font-bold text-slate-500">
          Current lease ends: {request.current_lease_end_date || "Not provided"}
        </p>

        {request.proposed_monthly_rent && (
          <p className="mt-2 text-sm font-bold text-slate-500">
            Proposed rent: {formatMoney(request.proposed_monthly_rent)}
            {request.proposed_security_deposit
              ? ` · Deposit: ${formatMoney(request.proposed_security_deposit)}`
              : ""}
          </p>
        )}

        {request.proposed_lease_start_date && request.proposed_lease_end_date && (
          <p className="mt-2 text-xs font-bold text-slate-400">
            Proposed dates: {request.proposed_lease_start_date} to{" "}
            {request.proposed_lease_end_date}
          </p>
        )}

        {request.tenant_message && (
          <div className="mt-3 rounded-2xl bg-blue-50 p-4 text-blue-900 ring-1 ring-blue-100">
            <p className="text-sm font-black">Tenant Message</p>
            <p className="mt-2 whitespace-pre-wrap leading-7">
              {request.tenant_message}
            </p>
          </div>
        )}

        {request.landlord_message && (
          <div className="mt-3 rounded-2xl bg-[#f7f4ef] p-4 text-slate-700">
            <p className="text-sm font-black">Landlord Message</p>
            <p className="mt-2 whitespace-pre-wrap leading-7">
              {request.landlord_message}
            </p>
          </div>
        )}

        <p className="mt-3 text-xs font-bold text-slate-400">
          Created {new Date(request.created_at).toLocaleString()}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/dashboard/landlord/leases/${request.lease_id}/renewal`}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black"
        >
          Renewal Plan
        </Link>

        {request.renewal_lease_id ? (
          <Link
            href={`/dashboard/landlord/leases/${request.renewal_lease_id}`}
            className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-black text-white"
          >
            Open Renewal Lease
          </Link>
        ) : (
          <Link
            href={`/dashboard/landlord/leases/${request.lease_id}`}
            className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-black text-white"
          >
            Open Lease
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