"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type LeaseForCharge = {
  id: string;
  property_address: string | null;
  tenant_name: string | null;
  landlord_name: string | null;
  lease_status: string;
};

type RentCharge = {
  id: string;
  lease_id: string;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  landlord_company_id: string | null;
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
  leases: LeaseForCharge | LeaseForCharge[] | null;
};

type CompanyMembership = {
  company_id: string;
  role: "owner" | "admin" | "manager" | "maintenance" | "accounting" | "viewer";
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

function getLease(charge: RentCharge) {
  if (Array.isArray(charge.leases)) {
    return charge.leases[0] || null;
  }

  return charge.leases;
}

function getCompanyFromMembership(membership: CompanyMembership | null) {
  if (!membership) return null;

  if (Array.isArray(membership.landlord_companies)) {
    return membership.landlord_companies[0] || null;
  }

  return membership.landlord_companies;
}

function canViewPayments(role: string) {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "manager" ||
    role === "accounting"
  );
}

function formatMoneyFromCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatStatus(status: string) {
  if (status === "unpaid") return "Unpaid";
  if (status === "paid") return "Paid";
  if (status === "overdue") return "Overdue";
  if (status === "waived") return "Waived";
  if (status === "cancelled") return "Cancelled";
  return status;
}

function chargeTypeLabel(type: string) {
  if (type === "security_deposit") return "Security Deposit";
  if (type === "first_month_rent") return "First Month Rent";
  if (type === "monthly_rent") return "Monthly Rent";
  if (type === "late_fee") return "Late Fee";
  if (type === "other") return "Other";
  return type;
}

export default function LandlordPaymentsPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("error");
  const [charges, setCharges] = useState<RentCharge[]>([]);
  const [savingId, setSavingId] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [companyRole, setCompanyRole] = useState("");

  useEffect(() => {
    loadPayments();
  }, []);

  function showError(errorMessage: string) {
    setMessageType("error");
    setMessage(errorMessage);
  }

  function showSuccess(successMessage: string) {
    setMessageType("success");
    setMessage(successMessage);
  }

  async function loadPayments() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      showError("Please log in as a landlord.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "landlord" && profile?.role !== "admin") {
      showError("Only landlords can view this payments page.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    let companyId: string | null = null;
    let membershipRole = "";

    if (profile?.role === "landlord") {
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
        showError(membershipError.message);
        setAllowed(false);
        setLoading(false);
        return;
      }

      const membership =
        ((membershipRows || [])[0] as unknown as
          | CompanyMembership
          | undefined) || null;

      const company = getCompanyFromMembership(membership);

      if (membership && company) {
        companyId = company.id;
        membershipRole = membership.role;
        setCompanyName(company.name);
        setCompanyRole(membership.role);
      } else {
        setCompanyName("");
        setCompanyRole("");
      }

      if (membership && !canViewPayments(membership.role)) {
        showError("Your company role does not have access to payments.");
        setAllowed(false);
        setLoading(false);
        return;
      }
    }

    let query = supabase
      .from("rent_charges")
      .select(
        `
        *,
        leases (
          id,
          property_address,
          tenant_name,
          landlord_name,
          lease_status
        )
      `
      )
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (profile?.role === "admin") {
      const { data, error } = await query;

      if (error) {
        showError(error.message);
        setAllowed(false);
        setLoading(false);
        return;
      }

      setCharges((data || []) as unknown as RentCharge[]);
      setAllowed(true);
      setLoading(false);
      return;
    }

    if (companyId && canViewPayments(membershipRole)) {
      query = query.or(
        `landlord_company_id.eq.${companyId},landlord_id.eq.${user.id}`
      );
    } else {
      query = query.eq("landlord_id", user.id);
    }

    const { data, error } = await query;

    if (error) {
      showError(error.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    setCharges((data || []) as unknown as RentCharge[]);
    setAllowed(true);
    setLoading(false);
  }

  async function markPaid(chargeId: string) {
    const confirmed = window.confirm("Mark this charge as paid?");
    if (!confirmed) return;

    setSavingId(chargeId);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("rent_charges")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        marked_paid_by: user?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chargeId);

    if (error) {
      showError(error.message);
      setSavingId("");
      return;
    }

    setSavingId("");
    await loadPayments();
    showSuccess("Charge marked paid.");
  }

  async function waiveCharge(chargeId: string) {
    const confirmed = window.confirm("Waive this charge?");
    if (!confirmed) return;

    setSavingId(chargeId);
    setMessage("");

    const { error } = await supabase
      .from("rent_charges")
      .update({
        status: "waived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", chargeId);

    if (error) {
      showError(error.message);
      setSavingId("");
      return;
    }

    setSavingId("");
    await loadPayments();
    showSuccess("Charge waived.");
  }

  const unpaidCharges = charges.filter(
    (charge) => charge.status === "unpaid" || charge.status === "overdue"
  );

  const paidCharges = charges.filter((charge) => charge.status === "paid");

  const otherCharges = charges.filter(
    (charge) => charge.status === "waived" || charge.status === "cancelled"
  );

  const totalDue = unpaidCharges.reduce(
    (sum, charge) => sum + charge.amount_cents,
    0
  );

  const totalPaid = paidCharges.reduce(
    (sum, charge) => sum + charge.amount_cents,
    0
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-black sm:text-3xl">
            Loading payments...
          </h1>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Payments unavailable</h1>

          <p className="mt-3 text-slate-600">{message}</p>

          <Link
            href="/dashboard/landlord"
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
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/dashboard/landlord"
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Landlord Dashboard
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Rent & Deposit Tracking
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                Payments
              </h1>

              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                View rent, deposit, late fee, and other lease charges across
                active leases.
              </p>

              {companyName && (
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
          </div>

          {message && (
            <div
              className={`mt-6 rounded-2xl px-5 py-4 font-bold ring-1 ${
                messageType === "success"
                  ? "bg-green-50 text-green-700 ring-green-200"
                  : "bg-red-50 text-red-700 ring-red-200"
              }`}
            >
              {message}
            </div>
          )}

          <section className="mt-8 grid gap-5 md:grid-cols-3">
            <SummaryCard
              label="Unpaid Balance"
              value={formatMoneyFromCents(totalDue)}
            />
            <SummaryCard
              label="Paid Total"
              value={formatMoneyFromCents(totalPaid)}
            />
            <SummaryCard
              label="Total Charges"
              value={String(charges.length)}
            />
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black">Unpaid / Overdue</h2>

            {unpaidCharges.length > 0 ? (
              <div className="mt-5 grid gap-5">
                {unpaidCharges.map((charge) => (
                  <ChargeCard
                    key={charge.id}
                    charge={charge}
                    savingId={savingId}
                    showActions
                    onMarkPaid={markPaid}
                    onWaive={waiveCharge}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No unpaid charges"
                text="Unpaid rent and deposit charges will appear here."
              />
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black">Paid</h2>

            {paidCharges.length > 0 ? (
              <div className="mt-5 grid gap-5">
                {paidCharges.map((charge) => (
                  <ChargeCard
                    key={charge.id}
                    charge={charge}
                    savingId={savingId}
                    showActions={false}
                    onMarkPaid={markPaid}
                    onWaive={waiveCharge}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No paid charges yet"
                text="Paid rent and deposit charges will appear here."
              />
            )}
          </section>

          {otherCharges.length > 0 && (
            <section className="mt-8">
              <h2 className="text-2xl font-black">Waived / Cancelled</h2>

              <div className="mt-5 grid gap-5">
                {otherCharges.map((charge) => (
                  <ChargeCard
                    key={charge.id}
                    charge={charge}
                    savingId={savingId}
                    showActions={false}
                    onMarkPaid={markPaid}
                    onWaive={waiveCharge}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-[#f7f4ef] p-5">
      <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-5 rounded-3xl bg-[#f7f4ef] p-8 text-center">
      <h3 className="text-2xl font-black">{title}</h3>
      <p className="mt-2 text-slate-600">{text}</p>
    </div>
  );
}

function ChargeCard({
  charge,
  savingId,
  showActions,
  onMarkPaid,
  onWaive,
}: {
  charge: RentCharge;
  savingId: string;
  showActions: boolean;
  onMarkPaid: (chargeId: string) => void;
  onWaive: (chargeId: string) => void;
}) {
  const lease = getLease(charge);

  return (
    <div className="rounded-3xl bg-[#f7f4ef] p-5 sm:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-black">{charge.title}</h3>

            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
              {chargeTypeLabel(charge.charge_type)}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-xs font-black ${
                charge.status === "paid"
                  ? "bg-green-50 text-green-700"
                  : charge.status === "waived"
                    ? "bg-slate-100 text-slate-600"
                    : "bg-amber-50 text-amber-700"
              }`}
            >
              {formatStatus(charge.status)}
            </span>
          </div>

          <p className="mt-3 text-4xl font-black">
            {formatMoneyFromCents(charge.amount_cents)}
          </p>

          <p className="mt-3 font-bold text-slate-600">
            Due: {charge.due_date}
          </p>

          {lease?.tenant_name && (
            <p className="mt-2 font-bold text-slate-500">
              Tenant: {lease.tenant_name}
            </p>
          )}

          {lease?.property_address && (
            <p className="mt-2 font-bold text-slate-500">
              {lease.property_address}
            </p>
          )}

          {charge.description && (
            <p className="mt-3 leading-7 text-slate-600">
              {charge.description}
            </p>
          )}

          {charge.paid_at && (
            <p className="mt-3 text-sm font-bold text-green-700">
              Paid on {new Date(charge.paid_at).toLocaleString()}
            </p>
          )}

          <Link
            href={`/dashboard/landlord/leases/${charge.lease_id}/payments`}
            className="mt-4 inline-flex text-sm font-black underline"
          >
            Manage lease payments
          </Link>
        </div>

        {showActions && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onMarkPaid(charge.id)}
              disabled={savingId === charge.id}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
            >
              {savingId === charge.id ? "Saving..." : "Mark Paid"}
            </button>

            <button
              type="button"
              onClick={() => onWaive(charge.id)}
              disabled={savingId === charge.id}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black disabled:opacity-60"
            >
              Waive
            </button>
          </div>
        )}
      </div>
    </div>
  );
}