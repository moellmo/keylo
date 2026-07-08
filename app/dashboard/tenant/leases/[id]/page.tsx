"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createNotification } from "@/lib/createNotification";

type Lease = {
  id: string;
  application_id: string;
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
  utilities_terms: string | null;
  pet_terms: string | null;
  maintenance_terms: string | null;
  additional_terms: string | null;
  sent_to_tenant_at: string | null;
  tenant_signed_at: string | null;
  landlord_signed_at: string | null;
  completed_at: string | null;
  created_at: string;
};

function formatStatus(status: string) {
  if (status === "draft") return "Draft";
  if (status === "sent_to_tenant") return "Ready to Sign";
  if (status === "tenant_signed") return "Tenant Signed";
  if (status === "landlord_signed") return "Landlord Signed";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";

  return status;
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "Not provided";
  return `$${value.toLocaleString()}`;
}

export default function TenantLeasePage() {
  const params = useParams();
  const leaseId = String(params.id);

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "error"
  );
  const [lease, setLease] = useState<Lease | null>(null);
  const [signing, setSigning] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    loadLease();
  }, [leaseId]);

  function showError(errorMessage: string) {
    setMessageType("error");
    setMessage(errorMessage);
  }

  function showSuccess(successMessage: string) {
    setMessageType("success");
    setMessage(successMessage);
  }

  async function loadLease() {
    setLoading(true);

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
      .from("leases")
      .select("*")
      .eq("id", leaseId)
      .single();

    if (error || !data) {
      showError("Lease not found.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const leaseRow = data as Lease;

    if (leaseRow.tenant_id !== user.id) {
      showError("You do not have permission to view this lease.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    setLease(leaseRow);
    setSignatureName(leaseRow.tenant_name || "");
    setAllowed(true);
    setLoading(false);
  }

  async function signLease() {
    if (!lease) return;

    if (lease.lease_status !== "sent_to_tenant") {
      showError("This lease is not currently ready for tenant signature.");
      return;
    }

    if (!signatureName.trim()) {
      showError("Please type your legal name to sign.");
      return;
    }

    if (!agreed) {
      showError("Please check the agreement box before signing.");
      return;
    }

    setSigning(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      showError("Please log in again.");
      setSigning(false);
      return;
    }

    const { error: signatureError } = await supabase
      .from("lease_signatures")
      .insert({
        lease_id: lease.id,
        signer_id: user.id,
        signer_role: "tenant",
        signer_name: signatureName.trim(),
        agreement_text:
          "Tenant electronically agreed to and signed this lease in Keylo.",
      });

    if (signatureError) {
      showError(signatureError.message);
      setSigning(false);
      return;
    }

    const { error: leaseError } = await supabase
      .from("leases")
      .update({
        lease_status: "tenant_signed",
        tenant_signed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lease.id);

    if (leaseError) {
      showError(leaseError.message);
      setSigning(false);
      return;
    }

   await createNotification({
  userId: lease.landlord_id,
  title: "Tenant signed lease",
  message: `${
    lease.tenant_name || "The tenant"
  } signed the lease. It is ready for your final signature.`,
  type: "lease_tenant_signed",
  targetUrl: `/dashboard/landlord/leases/${lease.id}`,
  dedupe: true,
});

    setSigning(false);
    await loadLease();
    showSuccess("Lease signed successfully. Waiting for landlord signature.");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading lease...</h1>
        </div>
      </main>
    );
  }

  if (!allowed || !lease) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Lease unavailable</h1>
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

  const canSign = lease.lease_status === "sent_to_tenant";

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-10">
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
                Lease Review
              </p>

              <h1 className="mt-3 text-5xl font-black tracking-tight">
                Lease Agreement
              </h1>

              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
                {lease.property_address || "No property address provided"}
              </p>
            </div>

            <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
              {formatStatus(lease.lease_status)}
            </span>
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

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
  <Link
    href={`/dashboard/tenant/leases/${lease.id}/print`}
    className="rounded-full border border-slate-300 bg-white px-6 py-3 text-center font-black"
  >
    Download / Print PDF
  </Link>
</div>

          <section className="mt-8">
            <h2 className="text-2xl font-black">Lease Summary</h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <InfoCard
                label="Tenant"
                value={lease.tenant_name || "Not provided"}
              />
              <InfoCard
                label="Landlord"
                value={lease.landlord_name || "Not provided"}
              />
              <InfoCard
                label="Monthly Rent"
                value={formatMoney(lease.monthly_rent)}
              />
              <InfoCard
                label="Security Deposit"
                value={formatMoney(lease.security_deposit)}
              />
              <InfoCard
                label="Start Date"
                value={lease.lease_start_date || "Not provided"}
              />
              <InfoCard
                label="End Date"
                value={lease.lease_end_date || "Not provided"}
              />
              <InfoCard
                label="Rent Due Day"
                value={
                  lease.rent_due_day
                    ? String(lease.rent_due_day)
                    : "Not provided"
                }
              />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black">Lease Terms</h2>

            <div className="mt-5 grid gap-5">
              <TextBlock
                label="Utilities Terms"
                value={lease.utilities_terms}
              />
              <TextBlock label="Pet Terms" value={lease.pet_terms} />
              <TextBlock
                label="Maintenance Terms"
                value={lease.maintenance_terms}
              />
              <TextBlock
                label="Additional Terms"
                value={lease.additional_terms}
              />
            </div>
          </section>

          <section className="mt-8 rounded-3xl bg-[#f7f4ef] p-6">
            <h2 className="text-2xl font-black">Tenant Signature</h2>

            {lease.tenant_signed_at ? (
              <div className="mt-4 rounded-2xl bg-white p-5">
                <p className="font-black text-slate-950">
                  Tenant signature complete
                </p>
                <p className="mt-2 font-bold text-slate-600">
                  Signed on{" "}
                  {new Date(lease.tenant_signed_at).toLocaleString()}.
                </p>
                {!lease.landlord_signed_at && (
                  <p className="mt-2 text-sm font-bold text-slate-500">
                    Waiting for landlord signature.
                  </p>
                )}
              </div>
            ) : canSign ? (
              <div className="mt-5 grid gap-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">
                    Type Legal Name
                  </span>

                  <input
                    value={signatureName}
                    onChange={(event) => setSignatureName(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                  />
                </label>

                <label className="flex items-start gap-3 rounded-2xl bg-white p-4 font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(event) => setAgreed(event.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    I agree that typing my name and clicking Sign Lease is my
                    electronic signature for this lease agreement.
                  </span>
                </label>

                <button
                  type="button"
                  onClick={signLease}
                  disabled={signing}
                  className="rounded-full bg-slate-950 px-6 py-4 font-black text-white disabled:opacity-60"
                >
                  {signing ? "Signing..." : "Sign Lease"}
                </button>
              </div>
            ) : (
              <p className="mt-4 font-bold text-slate-600">
                This lease is not ready for tenant signature yet.
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-[#f7f4ef] p-5">
      <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 break-words text-xl font-black">{value}</p>
    </div>
  );
}

function TextBlock({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-3xl bg-[#f7f4ef] p-5">
      <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 leading-8 text-slate-700">
        {value || "Not provided"}
      </p>
    </div>
  );
}