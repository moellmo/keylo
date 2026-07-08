"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Lease = {
  id: string;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  lease_status: string;
  tenant_name: string | null;
  landlord_name: string | null;
  property_address: string | null;
  monthly_rent: number | null;
  security_deposit: number | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  rent_due_day: number | null;
};

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
};

function formatMoneyFromCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "";
  return String(value);
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

export default function LandlordLeasePaymentsPage() {
  const params = useParams();
  const leaseId = String(params.id);

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("error");

  const [lease, setLease] = useState<Lease | null>(null);
  const [charges, setCharges] = useState<RentCharge[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    charge_type: "monthly_rent",
    title: "Monthly Rent",
    description: "",
    amount: "",
    due_date: "",
  });

  useEffect(() => {
    loadPage();
  }, [leaseId]);

  function showError(errorMessage: string) {
    setMessageType("error");
    setMessage(errorMessage);
  }

  function showSuccess(successMessage: string) {
    setMessageType("success");
    setMessage(successMessage);
  }

  async function loadPage() {
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

    const { data: leaseRow, error: leaseError } = await supabase
      .from("leases")
      .select(
        `
        id,
        property_id,
        tenant_id,
        landlord_id,
        lease_status,
        tenant_name,
        landlord_name,
        property_address,
        monthly_rent,
        security_deposit,
        lease_start_date,
        lease_end_date,
        rent_due_day
      `
      )
      .eq("id", leaseId)
      .single();

    if (leaseError || !leaseRow) {
      showError("Lease not found.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const currentLease = leaseRow as Lease;
    const isAdmin = profile?.role === "admin";
    const isLandlord = currentLease.landlord_id === user.id;

    if (!isAdmin && !isLandlord) {
      showError("You do not have permission to manage payments for this lease.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    setLease(currentLease);

    setForm((current) => ({
      ...current,
      amount: current.amount || formatMoney(currentLease.monthly_rent),
      due_date: current.due_date || currentLease.lease_start_date || "",
    }));

    const { data: chargeRows, error: chargeError } = await supabase
      .from("rent_charges")
      .select("*")
      .eq("lease_id", leaseId)
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (chargeError) {
      showError(chargeError.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    setCharges((chargeRows || []) as RentCharge[]);
    setAllowed(true);
    setLoading(false);
  }

  function updateChargeType(type: typeof form.charge_type) {
    let title = "Monthly Rent";
    let amount = lease?.monthly_rent ? String(lease.monthly_rent) : "";

    if (type === "security_deposit") {
      title = "Security Deposit";
      amount = lease?.security_deposit ? String(lease.security_deposit) : "";
    }

    if (type === "first_month_rent") {
      title = "First Month Rent";
      amount = lease?.monthly_rent ? String(lease.monthly_rent) : "";
    }

    if (type === "late_fee") {
      title = "Late Fee";
      amount = "";
    }

    if (type === "other") {
      title = "Other Charge";
      amount = "";
    }

    setForm((current) => ({
      ...current,
      charge_type: type,
      title,
      amount,
    }));
  }

  async function createCharge() {
    if (!lease) return;

    if (!form.title.trim()) {
      showError("Charge title is required.");
      return;
    }

    if (!form.amount || Number(form.amount) < 0) {
      showError("Enter a valid amount.");
      return;
    }

    if (!form.due_date) {
      showError("Choose a due date.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("rent_charges").insert({
      lease_id: lease.id,
      property_id: lease.property_id,
      tenant_id: lease.tenant_id,
      landlord_id: lease.landlord_id,
      charge_type: form.charge_type,
      title: form.title.trim(),
      description: form.description.trim() || null,
      amount_cents: Math.round(Number(form.amount) * 100),
      currency: "usd",
      due_date: form.due_date,
      status: "unpaid",
      updated_at: new Date().toISOString(),
    });

    if (error) {
      showError(error.message);
      setSaving(false);
      return;
    }

    setForm((current) => ({
      ...current,
      description: "",
    }));

    setSaving(false);
    await loadPage();
    showSuccess("Charge created.");
  }

  async function markPaid(chargeId: string) {
    const confirmed = window.confirm("Mark this charge as paid?");
    if (!confirmed) return;

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
      return;
    }

    await loadPage();
    showSuccess("Charge marked paid.");
  }

  async function waiveCharge(chargeId: string) {
    const confirmed = window.confirm("Waive this charge?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("rent_charges")
      .update({
        status: "waived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", chargeId);

    if (error) {
      showError(error.message);
      return;
    }

    await loadPage();
    showSuccess("Charge waived.");
  }

  async function deleteCharge(chargeId: string) {
    const confirmed = window.confirm("Delete this unpaid charge?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("rent_charges")
      .delete()
      .eq("id", chargeId);

    if (error) {
      showError(error.message);
      return;
    }

    await loadPage();
    showSuccess("Charge deleted.");
  }

  async function createStandardMoveInCharges() {
    if (!lease) return;

    const confirmed = window.confirm(
      "Create security deposit and first month rent charges?"
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");

    const dueDate = lease.lease_start_date || new Date().toISOString().slice(0, 10);

    const rows = [];

    if (lease.security_deposit && lease.security_deposit > 0) {
      rows.push({
        lease_id: lease.id,
        property_id: lease.property_id,
        tenant_id: lease.tenant_id,
        landlord_id: lease.landlord_id,
        charge_type: "security_deposit",
        title: "Security Deposit",
        description: "Move-in security deposit.",
        amount_cents: Math.round(lease.security_deposit * 100),
        currency: "usd",
        due_date: dueDate,
        status: "unpaid",
      });
    }

    if (lease.monthly_rent && lease.monthly_rent > 0) {
      rows.push({
        lease_id: lease.id,
        property_id: lease.property_id,
        tenant_id: lease.tenant_id,
        landlord_id: lease.landlord_id,
        charge_type: "first_month_rent",
        title: "First Month Rent",
        description: "First month rent due before move-in.",
        amount_cents: Math.round(lease.monthly_rent * 100),
        currency: "usd",
        due_date: dueDate,
        status: "unpaid",
      });
    }

    if (rows.length === 0) {
      showError("This lease has no rent or deposit amount to create.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("rent_charges").insert(rows);

    if (error) {
      showError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    await loadPage();
    showSuccess("Move-in charges created.");
  }

  const totalDue = charges
    .filter((charge) => charge.status === "unpaid" || charge.status === "overdue")
    .reduce((sum, charge) => sum + charge.amount_cents, 0);

  const totalPaid = charges
    .filter((charge) => charge.status === "paid")
    .reduce((sum, charge) => sum + charge.amount_cents, 0);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading payments...</h1>
        </div>
      </main>
    );
  }

  if (!allowed || !lease) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
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
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link
          href={`/dashboard/landlord/leases/${lease.id}`}
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Lease
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Rent & Deposit Tracking
              </p>

              <h1 className="mt-3 text-5xl font-black tracking-tight">
                Lease Payments
              </h1>

              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
                {lease.tenant_name || "Tenant"} ·{" "}
                {lease.property_address || "No property address provided"}
              </p>
            </div>

            <button
              type="button"
              onClick={createStandardMoveInCharges}
              disabled={saving}
              className="rounded-full bg-slate-950 px-5 py-3 font-black text-white disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create Move-In Charges"}
            </button>
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
            <SummaryCard label="Unpaid Balance" value={formatMoneyFromCents(totalDue)} />
            <SummaryCard label="Paid Total" value={formatMoneyFromCents(totalPaid)} />
            <SummaryCard label="Total Charges" value={String(charges.length)} />
          </section>

          <section className="mt-8 rounded-3xl bg-[#f7f4ef] p-6">
            <h2 className="text-2xl font-black">Create Charge</h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">
                  Charge Type
                </span>

                <select
                  value={form.charge_type}
                  onChange={(event) =>
                    updateChargeType(event.target.value as typeof form.charge_type)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-black outline-none focus:border-slate-950"
                >
                  <option value="security_deposit">Security Deposit</option>
                  <option value="first_month_rent">First Month Rent</option>
                  <option value="monthly_rent">Monthly Rent</option>
                  <option value="late_fee">Late Fee</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <Field
                label="Title"
                value={form.title}
                onChange={(value) =>
                  setForm((current) => ({ ...current, title: value }))
                }
              />

              <Field
                label="Amount"
                type="number"
                value={form.amount}
                onChange={(value) =>
                  setForm((current) => ({ ...current, amount: value }))
                }
              />

              <Field
                label="Due Date"
                type="date"
                value={form.due_date}
                onChange={(value) =>
                  setForm((current) => ({ ...current, due_date: value }))
                }
              />

              <TextArea
                label="Description optional"
                value={form.description}
                onChange={(value) =>
                  setForm((current) => ({ ...current, description: value }))
                }
              />
            </div>

            <button
              type="button"
              onClick={createCharge}
              disabled={saving}
              className="mt-5 rounded-full bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Create Charge"}
            </button>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black">Charges</h2>

            {charges.length > 0 ? (
              <div className="mt-5 divide-y divide-slate-200 rounded-3xl bg-[#f7f4ef]">
                {charges.map((charge) => (
                  <div key={charge.id} className="p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
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

                        <p className="mt-2 text-3xl font-black">
                          {formatMoneyFromCents(charge.amount_cents)}
                        </p>

                        <p className="mt-2 font-bold text-slate-600">
                          Due: {charge.due_date}
                        </p>

                        {charge.description && (
                          <p className="mt-3 leading-7 text-slate-600">
                            {charge.description}
                          </p>
                        )}

                        {charge.paid_at && (
                          <p className="mt-2 text-sm font-bold text-green-700">
                            Paid on {new Date(charge.paid_at).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {(charge.status === "unpaid" ||
                          charge.status === "overdue") && (
                          <>
                            <button
                              type="button"
                              onClick={() => markPaid(charge.id)}
                              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white"
                            >
                              Mark Paid
                            </button>

                            <button
                              type="button"
                              onClick={() => waiveCharge(charge.id)}
                              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black"
                            >
                              Waive
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteCharge(charge.id)}
                              className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-700"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-3xl bg-[#f7f4ef] p-8 text-center">
                <h3 className="text-2xl font-black">No charges yet</h3>
                <p className="mt-2 text-slate-600">
                  Create move-in charges or add rent manually.
                </p>
              </div>
            )}
          </section>
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

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-500"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block md:col-span-2">
      <span className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </span>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-500"
      />
    </label>
  );
}