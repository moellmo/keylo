"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Lease = {
  id: string;
  application_id: string;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  lease_status: string;
  renewal_status: string | null;
  renewal_parent_lease_id: string | null;
  tenant_name: string | null;
  landlord_name: string | null;
  property_address: string | null;
  monthly_rent: number | null;
  security_deposit: number | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  sent_to_tenant_at: string | null;
  tenant_signed_at: string | null;
  landlord_signed_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type LeaseStatusFilter =
  | "all"
  | "draft"
  | "sent_to_tenant"
  | "tenant_signed"
  | "completed"
  | "cancelled";

type RenewalStatusFilter =
  | "all"
  | "not_started"
  | "plan_requested"
  | "tenant_wants_to_renew"
  | "tenant_moving_out"
  | "landlord_offered_renewal"
  | "renewal_lease_sent"
  | "renewal_completed"
  | "not_renewing";

const PAGE_SIZE = 25;

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "Not provided";
  return `$${value.toLocaleString()}`;
}

function formatLeaseStatus(status: string) {
  if (status === "draft") return "Draft";
  if (status === "sent_to_tenant") return "Sent to Tenant";
  if (status === "tenant_signed") return "Tenant Signed";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";

  return status.replaceAll("_", " ");
}

function formatRenewalStatus(status: string | null) {
  if (!status || status === "not_started") return "Not Started";
  if (status === "plan_requested") return "Plan Requested";
  if (status === "tenant_wants_to_renew") return "Tenant Wants to Renew";
  if (status === "tenant_moving_out") return "Tenant Moving Out";
  if (status === "landlord_offered_renewal") return "Renewal Offered";
  if (status === "renewal_lease_sent") return "Renewal Lease Sent";
  if (status === "renewal_completed") return "Renewal Completed";
  if (status === "not_renewing") return "Not Renewing";

  return status.replaceAll("_", " ");
}

function leaseStatusClass(status: string) {
  if (status === "completed") return "bg-green-50 text-green-700";
  if (status === "cancelled") return "bg-red-50 text-red-700";
  if (status === "tenant_signed") return "bg-blue-50 text-blue-700";
  if (status === "sent_to_tenant") return "bg-yellow-50 text-yellow-700";

  return "bg-slate-100 text-slate-600";
}

function renewalStatusClass(status: string | null) {
  if (!status || status === "not_started") return "bg-slate-100 text-slate-600";
  if (status === "renewal_completed") return "bg-green-50 text-green-700";
  if (status === "tenant_moving_out" || status === "not_renewing") {
    return "bg-red-50 text-red-700";
  }
  if (
    status === "tenant_wants_to_renew" ||
    status === "landlord_offered_renewal" ||
    status === "renewal_lease_sent"
  ) {
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

export default function AdminLeasesPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");

  const [leases, setLeases] = useState<Lease[]>([]);
  const [search, setSearch] = useState("");
  const [leaseStatusFilter, setLeaseStatusFilter] =
    useState<LeaseStatusFilter>("all");
  const [renewalStatusFilter, setRenewalStatusFilter] =
    useState<RenewalStatusFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadLeases();
  }, []);

  async function loadLeases() {
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
      setMessage("You do not have permission to view leases.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("leases")
      .select(
        `
        id,
        application_id,
        property_id,
        tenant_id,
        landlord_id,
        lease_status,
        renewal_status,
        renewal_parent_lease_id,
        tenant_name,
        landlord_name,
        property_address,
        monthly_rent,
        security_deposit,
        lease_start_date,
        lease_end_date,
        sent_to_tenant_at,
        tenant_signed_at,
        landlord_signed_at,
        completed_at,
        created_at
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

    setLeases((data || []) as Lease[]);
    setAllowed(true);
    setLoading(false);
  }

  const filteredLeases = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return leases.filter((lease) => {
      const cleanRenewalStatus = lease.renewal_status || "not_started";

      const matchesLeaseStatus =
        leaseStatusFilter === "all"
          ? true
          : lease.lease_status === leaseStatusFilter;

      const matchesRenewalStatus =
        renewalStatusFilter === "all"
          ? true
          : cleanRenewalStatus === renewalStatusFilter;

      const matchesSearch =
        !cleanSearch ||
        (lease.tenant_name || "").toLowerCase().includes(cleanSearch) ||
        (lease.landlord_name || "").toLowerCase().includes(cleanSearch) ||
        (lease.property_address || "").toLowerCase().includes(cleanSearch);

      return matchesLeaseStatus && matchesRenewalStatus && matchesSearch;
    });
  }, [leases, leaseStatusFilter, renewalStatusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredLeases.length / PAGE_SIZE));

  const visibleLeases = filteredLeases.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function updateLeaseStatus(value: LeaseStatusFilter) {
    setLeaseStatusFilter(value);
    setPage(1);
  }

  function updateRenewalStatus(value: RenewalStatusFilter) {
    setRenewalStatusFilter(value);
    setPage(1);
  }

  const activeCount = leases.filter(
    (lease) =>
      lease.lease_status !== "completed" && lease.lease_status !== "cancelled"
  ).length;

  const completedCount = leases.filter(
    (lease) => lease.lease_status === "completed"
  ).length;

  const waitingTenantCount = leases.filter(
    (lease) => lease.lease_status === "sent_to_tenant"
  ).length;

  const readyForLandlordCount = leases.filter(
    (lease) => lease.lease_status === "tenant_signed"
  ).length;

  const endingSoonCount = leases.filter((lease) => {
    if (!lease.lease_end_date) return false;
    if (lease.lease_status === "cancelled") return false;

    const daysUntilEnd = getDaysUntilLeaseEnds(lease.lease_end_date);

    return daysUntilEnd !== null && daysUntilEnd >= 0 && daysUntilEnd <= 90;
  }).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading leases...</h1>
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
              Leases
            </h1>

            <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
              Search leases, review signing progress, and track renewal status.
            </p>
          </div>

          <button
            type="button"
            onClick={loadLeases}
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
          <StatCard title="Total" value={leases.length} />
          <StatCard title="Active" value={activeCount} />
          <StatCard title="Waiting Tenant" value={waitingTenantCount} />
          <StatCard title="Ready Landlord" value={readyForLandlordCount} />
          <StatCard title="Ending Soon" value={endingSoonCount} />
          <StatCard title="Completed" value={completedCount} />
        </section>

        <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-5">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">
                Search by tenant, landlord, or property address
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
                  Lease Status
                </p>

                <div className="flex flex-wrap gap-2">
                  <FilterButton
                    active={leaseStatusFilter === "all"}
                    label="All"
                    onClick={() => updateLeaseStatus("all")}
                  />
                  <FilterButton
                    active={leaseStatusFilter === "draft"}
                    label="Draft"
                    onClick={() => updateLeaseStatus("draft")}
                  />
                  <FilterButton
                    active={leaseStatusFilter === "sent_to_tenant"}
                    label="Sent"
                    onClick={() => updateLeaseStatus("sent_to_tenant")}
                  />
                  <FilterButton
                    active={leaseStatusFilter === "tenant_signed"}
                    label="Tenant Signed"
                    onClick={() => updateLeaseStatus("tenant_signed")}
                  />
                  <FilterButton
                    active={leaseStatusFilter === "completed"}
                    label="Completed"
                    onClick={() => updateLeaseStatus("completed")}
                  />
                  <FilterButton
                    active={leaseStatusFilter === "cancelled"}
                    label="Cancelled"
                    onClick={() => updateLeaseStatus("cancelled")}
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-black text-slate-700">
                  Renewal Status
                </p>

                <div className="flex flex-wrap gap-2">
                  <FilterButton
                    active={renewalStatusFilter === "all"}
                    label="All"
                    onClick={() => updateRenewalStatus("all")}
                  />
                  <FilterButton
                    active={renewalStatusFilter === "not_started"}
                    label="Not Started"
                    onClick={() => updateRenewalStatus("not_started")}
                  />
                  <FilterButton
                    active={renewalStatusFilter === "tenant_wants_to_renew"}
                    label="Wants to Renew"
                    onClick={() =>
                      updateRenewalStatus("tenant_wants_to_renew")
                    }
                  />
                  <FilterButton
                    active={renewalStatusFilter === "tenant_moving_out"}
                    label="Moving Out"
                    onClick={() => updateRenewalStatus("tenant_moving_out")}
                  />
                  <FilterButton
                    active={renewalStatusFilter === "landlord_offered_renewal"}
                    label="Offer Sent"
                    onClick={() =>
                      updateRenewalStatus("landlord_offered_renewal")
                    }
                  />
                  <FilterButton
                    active={renewalStatusFilter === "renewal_lease_sent"}
                    label="Renewal Sent"
                    onClick={() => updateRenewalStatus("renewal_lease_sent")}
                  />
                  <FilterButton
                    active={renewalStatusFilter === "renewal_completed"}
                    label="Completed"
                    onClick={() => updateRenewalStatus("renewal_completed")}
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
                <h2 className="text-2xl font-black">Lease Results</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Showing {visibleLeases.length} of {filteredLeases.length} leases.
                </p>
              </div>

              <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
                Page {page} of {totalPages}
              </span>
            </div>
          </div>

          {visibleLeases.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {visibleLeases.map((lease) => (
                <LeaseRow key={lease.id} lease={lease} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No leases found</h3>
              <p className="mt-3 text-slate-600">
                Try a different search, lease status, or renewal filter.
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

function LeaseRow({ lease }: { lease: Lease }) {
  const daysUntilEnd = getDaysUntilLeaseEnds(lease.lease_end_date);
  const endingSoon =
    daysUntilEnd !== null &&
    daysUntilEnd >= 0 &&
    daysUntilEnd <= 90 &&
    lease.lease_status !== "cancelled";

  return (
    <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
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
            {formatLeaseStatus(lease.lease_status)}
          </span>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${renewalStatusClass(
              lease.renewal_status
            )}`}
          >
            {formatRenewalStatus(lease.renewal_status)}
          </span>

          {lease.renewal_parent_lease_id && (
            <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-black text-purple-700">
              Renewal Lease
            </span>
          )}

          {endingSoon && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
              {daysUntilEnd === 0
                ? "Ends Today"
                : `${daysUntilEnd} day${daysUntilEnd === 1 ? "" : "s"} left`}
            </span>
          )}
        </div>

        <p className="mt-2 font-bold text-slate-500">
          {lease.property_address || "No property address"}
        </p>

        <p className="mt-2 text-sm font-bold text-slate-500">
          Tenant: {lease.tenant_name || "Not provided"}
        </p>

        <p className="mt-1 text-sm font-bold text-slate-500">
          Landlord: {lease.landlord_name || "Not provided"}
        </p>

        <p className="mt-2 text-sm font-bold text-slate-500">
          Rent: {formatMoney(lease.monthly_rent)} · Deposit:{" "}
          {formatMoney(lease.security_deposit)}
        </p>

        <p className="mt-2 text-xs font-bold text-slate-400">
          Lease dates: {lease.lease_start_date || "No start"} to{" "}
          {lease.lease_end_date || "No end"}
        </p>

        <p className="mt-1 text-xs font-bold text-slate-400">
          Created {new Date(lease.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/dashboard/landlord/leases/${lease.id}/renewal`}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black"
        >
          Renewal
        </Link>

        <Link
          href={`/dashboard/landlord/leases/${lease.id}`}
          className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-black text-white"
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