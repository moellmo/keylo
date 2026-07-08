"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
        id: string;
        property_address: string | null;
        tenant_name: string | null;
        landlord_name: string | null;
        lease_status: string;
      }
    | {
        id: string;
        property_address: string | null;
        tenant_name: string | null;
        landlord_name: string | null;
        lease_status: string;
      }[]
    | null;
};

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

export default function TenantPaymentsPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("error");
  const [charges, setCharges] = useState<RentCharge[]>([]);
  const [payingId, setPayingId] = useState("");

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
      showError("Please log in as a tenant.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
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
      .eq("tenant_id", user.id)
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: true });

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

  async function markPaidForTesting(chargeId: string) {
    const confirmed = window.confirm(
      "For testing, mark this charge as paid?"
    );

    if (!confirmed) return;

    setPayingId(chargeId);
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
      setPayingId("");
      return;
    }

    setPayingId("");
    await loadPayments();
    showSuccess("Payment marked paid for testing.");
  }

  const unpaidCharges = charges.filter(
    (charge) => charge.status === "unpaid" || charge.status === "overdue"
  );

  const paidCharges = charges.filter((charge) => charge.status === "paid");

  const otherCharges = charges.filter(
    (charge) =>
      charge.status === "waived" || charge.status === "cancelled"
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
          <h1 className="text-3xl font-black">Payments unavailable</h1>

          <p className="mt-3 text-slate-600">{message}</p>

          <Link
            href="/dashboard/tenant"
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
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link
          href="/dashboard/tenant"
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Tenant Dashboard
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Rent & Deposit Payments
              </p>

              <h1 className="mt-3 text-5xl font-black tracking-tight">
                Payments
              </h1>

              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
                View rent, deposit, late fee, and other lease charges.
              </p>
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
              label="Amount Due"
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
            <h2 className="text-2xl font-black">Due Now</h2>

            {unpaidCharges.length > 0 ? (
              <div className="mt-5 grid gap-5">
                {unpaidCharges.map((charge) => (
                  <ChargeCard
                    key={charge.id}
                    charge={charge}
                    payingId={payingId}
                    onPayTesting={markPaidForTesting}
                    showPayButton
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nothing due right now"
                text="You do not have any unpaid rent or deposit charges."
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
                    payingId={payingId}
                    onPayTesting={markPaidForTesting}
                    showPayButton={false}
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
              <h2 className="text-2xl font-black">Other Status</h2>

              <div className="mt-5 grid gap-5">
                {otherCharges.map((charge) => (
                  <ChargeCard
                    key={charge.id}
                    charge={charge}
                    payingId={payingId}
                    onPayTesting={markPaidForTesting}
                    showPayButton={false}
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
  payingId,
  onPayTesting,
  showPayButton,
}: {
  charge: RentCharge;
  payingId: string;
  onPayTesting: (chargeId: string) => void;
  showPayButton: boolean;
}) {
  const lease = getLease(charge);

  return (
    <div className="rounded-3xl bg-[#f7f4ef] p-6">
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
        </div>

        {showPayButton && (
          <button
            type="button"
            onClick={() => onPayTesting(charge.id)}
            disabled={payingId === charge.id}
            className="rounded-full bg-slate-950 px-5 py-3 font-black text-white disabled:opacity-60"
          >
            {payingId === charge.id ? "Updating..." : "Mark Paid for Testing"}
          </button>
        )}
      </div>
    </div>
  );
}