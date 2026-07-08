"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type RentCharge = {
  id: string;
  lease_id: string;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  charge_type:
    | "security_deposit"
    | "first_month_rent"
    | "monthly_rent"
    | "late_fee"
    | "other";
  title: string;
  description: string | null;
  amount_cents: number;
  currency: string;
  due_date: string;
  status: "unpaid" | "paid" | "overdue" | "waived" | "cancelled";
  paid_at: string | null;
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
  | "unpaid"
  | "paid"
  | "overdue"
  | "waived"
  | "cancelled";

type ChargeTypeFilter =
  | "all"
  | "security_deposit"
  | "first_month_rent"
  | "monthly_rent"
  | "late_fee"
  | "other";

const PAGE_SIZE = 25;

function getLease(charge: RentCharge) {
  if (Array.isArray(charge.leases)) {
    return charge.leases[0] || null;
  }

  return charge.leases;
}

function formatMoneyFromCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatChargeType(type: string) {
  if (type === "security_deposit") return "Security Deposit";
  if (type === "first_month_rent") return "First Month Rent";
  if (type === "monthly_rent") return "Monthly Rent";
  if (type === "late_fee") return "Late Fee";
  if (type === "other") return "Other";

  return type.replaceAll("_", " ");
}

function statusClass(status: string) {
  if (status === "paid") return "bg-green-50 text-green-700";
  if (status === "overdue") return "bg-red-50 text-red-700";
  if (status === "unpaid") return "bg-yellow-50 text-yellow-700";
  if (status === "waived") return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

export default function AdminPaymentsPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");

  const [charges, setCharges] = useState<RentCharge[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [chargeTypeFilter, setChargeTypeFilter] =
    useState<ChargeTypeFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
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
      setMessage("You do not have permission to view payments.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("rent_charges")
      .select(
        `
        id,
        lease_id,
        property_id,
        tenant_id,
        landlord_id,
        charge_type,
        title,
        description,
        amount_cents,
        currency,
        due_date,
        status,
        paid_at,
        created_at,
        leases (
          tenant_name,
          landlord_name,
          property_address
        )
      `
      )
      .order("due_date", { ascending: false })
      .limit(500);

    if (error) {
      setMessage(error.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    setCharges((data || []) as unknown as RentCharge[]);
    setAllowed(true);
    setLoading(false);
  }

  const filteredCharges = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return charges.filter((charge) => {
      const lease = getLease(charge);

      const matchesStatus =
        statusFilter === "all" ? true : charge.status === statusFilter;

      const matchesType =
        chargeTypeFilter === "all"
          ? true
          : charge.charge_type === chargeTypeFilter;

      const matchesSearch =
        !cleanSearch ||
        charge.title.toLowerCase().includes(cleanSearch) ||
        (charge.description || "").toLowerCase().includes(cleanSearch) ||
        (lease?.tenant_name || "").toLowerCase().includes(cleanSearch) ||
        (lease?.landlord_name || "").toLowerCase().includes(cleanSearch) ||
        (lease?.property_address || "").toLowerCase().includes(cleanSearch);

      return matchesStatus && matchesType && matchesSearch;
    });
  }, [charges, chargeTypeFilter, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCharges.length / PAGE_SIZE));

  const visibleCharges = filteredCharges.slice(
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

  function updateChargeType(value: ChargeTypeFilter) {
    setChargeTypeFilter(value);
    setPage(1);
  }

  const unpaidCharges = charges.filter(
    (charge) => charge.status === "unpaid" || charge.status === "overdue"
  );

  const paidCharges = charges.filter((charge) => charge.status === "paid");

  const overdueCharges = charges.filter((charge) => charge.status === "overdue");

  const unpaidBalance = unpaidCharges.reduce(
    (sum, charge) => sum + charge.amount_cents,
    0
  );

  const paidTotal = paidCharges.reduce(
    (sum, charge) => sum + charge.amount_cents,
    0
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading payments...</h1>
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
              Payments
            </h1>

            <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
              Review rent, deposit, late fee, paid, unpaid, overdue, and waived
              charges across Keylo.
            </p>
          </div>

          <button
            type="button"
            onClick={loadPayments}
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
          <StatCard title="Total Charges" value={charges.length} />
          <StatCard title="Unpaid" value={formatMoneyFromCents(unpaidBalance)} />
          <StatCard title="Paid" value={formatMoneyFromCents(paidTotal)} />
          <StatCard title="Overdue" value={overdueCharges.length} />
          <StatCard title="Paid Count" value={paidCharges.length} />
        </section>

        <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-5">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">
                Search by charge, tenant, landlord, or property address
              </span>

              <input
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Example: tenant name, rent, deposit, address..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-slate-500"
              />
            </label>

            <div className="grid gap-5 xl:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-black text-slate-700">
                  Payment Status
                </p>

                <div className="flex flex-wrap gap-2">
                  <FilterButton
                    active={statusFilter === "all"}
                    label="All"
                    onClick={() => updateStatus("all")}
                  />
                  <FilterButton
                    active={statusFilter === "unpaid"}
                    label="Unpaid"
                    onClick={() => updateStatus("unpaid")}
                  />
                  <FilterButton
                    active={statusFilter === "paid"}
                    label="Paid"
                    onClick={() => updateStatus("paid")}
                  />
                  <FilterButton
                    active={statusFilter === "overdue"}
                    label="Overdue"
                    onClick={() => updateStatus("overdue")}
                  />
                  <FilterButton
                    active={statusFilter === "waived"}
                    label="Waived"
                    onClick={() => updateStatus("waived")}
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
                  Charge Type
                </p>

                <div className="flex flex-wrap gap-2">
                  <FilterButton
                    active={chargeTypeFilter === "all"}
                    label="All"
                    onClick={() => updateChargeType("all")}
                  />
                  <FilterButton
                    active={chargeTypeFilter === "security_deposit"}
                    label="Deposit"
                    onClick={() => updateChargeType("security_deposit")}
                  />
                  <FilterButton
                    active={chargeTypeFilter === "first_month_rent"}
                    label="First Rent"
                    onClick={() => updateChargeType("first_month_rent")}
                  />
                  <FilterButton
                    active={chargeTypeFilter === "monthly_rent"}
                    label="Monthly Rent"
                    onClick={() => updateChargeType("monthly_rent")}
                  />
                  <FilterButton
                    active={chargeTypeFilter === "late_fee"}
                    label="Late Fee"
                    onClick={() => updateChargeType("late_fee")}
                  />
                  <FilterButton
                    active={chargeTypeFilter === "other"}
                    label="Other"
                    onClick={() => updateChargeType("other")}
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
                <h2 className="text-2xl font-black">Payment Results</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Showing {visibleCharges.length} of {filteredCharges.length} charges.
                </p>
              </div>

              <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
                Page {page} of {totalPages}
              </span>
            </div>
          </div>

          {visibleCharges.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {visibleCharges.map((charge) => (
                <PaymentRow key={charge.id} charge={charge} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No payments found</h3>
              <p className="mt-3 text-slate-600">
                Try a different search, status, or charge type.
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

function PaymentRow({ charge }: { charge: RentCharge }) {
  const lease = getLease(charge);

  return (
    <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-black">
            {formatMoneyFromCents(charge.amount_cents)}
          </h3>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
              charge.status
            )}`}
          >
            {charge.status}
          </span>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
            {formatChargeType(charge.charge_type)}
          </span>
        </div>

        <p className="mt-2 font-bold text-slate-500">{charge.title}</p>

        {charge.description && (
          <p className="mt-1 text-sm font-bold text-slate-500">
            {charge.description}
          </p>
        )}

        <p className="mt-2 text-sm font-bold text-slate-500">
          Tenant: {lease?.tenant_name || "Not provided"}
        </p>

        <p className="mt-1 text-sm font-bold text-slate-500">
          Landlord: {lease?.landlord_name || "Not provided"}
        </p>

        <p className="mt-1 text-sm font-bold text-slate-500">
          Property: {lease?.property_address || "No property address"}
        </p>

        <p className="mt-2 text-xs font-bold text-slate-400">
          Due {charge.due_date}
          {charge.paid_at
            ? ` · Paid ${new Date(charge.paid_at).toLocaleDateString()}`
            : ""}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/dashboard/landlord/leases/${charge.lease_id}/payments`}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black"
        >
          Lease Payments
        </Link>

        <Link
          href={`/dashboard/landlord/leases/${charge.lease_id}`}
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