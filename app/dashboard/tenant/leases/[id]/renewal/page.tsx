"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createNotification } from "@/lib/createNotification";

type Lease = {
  id: string;
  property_id: string | null;
  tenant_id: string;
  landlord_id: string;
  lease_status: string;
  renewal_status: string | null;
  tenant_name: string | null;
  landlord_name: string | null;
  property_address: string | null;
  monthly_rent: number | null;
  security_deposit: number | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
};

type RenewalRequest = {
  id: string;
  lease_id: string;
  request_type:
    | "tenant_requests_renewal"
    | "tenant_plans_to_move_out"
    | "landlord_asks_plan"
    | "landlord_offers_renewal"
    | "landlord_declines_renewal";
  status: string;
  tenant_message: string | null;
  landlord_message: string | null;
  proposed_monthly_rent: number | null;
  proposed_lease_start_date: string | null;
  proposed_lease_end_date: string | null;
  created_at: string;
};

function formatRenewalType(type: string) {
  if (type === "tenant_requests_renewal") return "Tenant Wants to Renew";
  if (type === "tenant_plans_to_move_out") return "Tenant Plans to Move Out";
  if (type === "landlord_asks_plan") return "Landlord Asked for Plan";
  if (type === "landlord_offers_renewal") return "Renewal Offered";
  if (type === "landlord_declines_renewal") return "Renewal Declined";

  return type;
}

function formatMoney(value: number | null) {
  if (!value) return "Not provided";
  return `$${value.toLocaleString()}`;
}

export default function TenantLeaseRenewalPage() {
  const params = useParams();
  const leaseId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [lease, setLease] = useState<Lease | null>(null);
  const [renewalRequests, setRenewalRequests] = useState<RenewalRequest[]>([]);
  const [tenantMessage, setTenantMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaseId]);

  async function loadPage() {
    setLoading(true);
    setMessage("");
    setSuccessMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please log in as a tenant.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: leaseRow, error: leaseError } = await supabase
      .from("leases")
      .select(
        `
        id,
        property_id,
        tenant_id,
        landlord_id,
        lease_status,
        renewal_status,
        tenant_name,
        landlord_name,
        property_address,
        monthly_rent,
        security_deposit,
        lease_start_date,
        lease_end_date
      `
      )
      .eq("id", leaseId)
      .single();

    if (leaseError || !leaseRow) {
      setMessage("Lease not found.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const currentLease = leaseRow as Lease;

    if (currentLease.tenant_id !== user.id) {
      setMessage("You do not have permission to view this lease renewal page.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: requestRows, error: requestError } = await supabase
      .from("lease_renewal_requests")
      .select(
        `
        id,
        lease_id,
        request_type,
        status,
        tenant_message,
        landlord_message,
        proposed_monthly_rent,
        proposed_lease_start_date,
        proposed_lease_end_date,
        created_at
      `
      )
      .eq("lease_id", leaseId)
      .order("created_at", { ascending: false });

    if (requestError) {
      setMessage(requestError.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    setLease(currentLease);
    setRenewalRequests((requestRows || []) as RenewalRequest[]);
    setAllowed(true);
    setLoading(false);
  }

  async function submitPlan(
    requestType: "tenant_requests_renewal" | "tenant_plans_to_move_out"
  ) {
    if (!lease) return;

    const confirmed = window.confirm(
      requestType === "tenant_requests_renewal"
        ? "Tell the landlord you would like to renew this lease?"
        : "Tell the landlord you plan to move out when this lease ends?"
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setSuccessMessage("");

    const nextRenewalStatus =
      requestType === "tenant_requests_renewal"
        ? "tenant_wants_to_renew"
        : "tenant_moving_out";

    const nextRequestStatus =
      requestType === "tenant_requests_renewal"
        ? "tenant_responded"
        : "move_out_confirmed";

    const { data: createdRequest, error } = await supabase
      .from("lease_renewal_requests")
      .insert({
        lease_id: lease.id,
        property_id: lease.property_id,
        tenant_id: lease.tenant_id,
        landlord_id: lease.landlord_id,
        request_type: requestType,
        status: nextRequestStatus,
        current_lease_end_date: lease.lease_end_date,
        tenant_message:
          tenantMessage.trim() ||
          (requestType === "tenant_requests_renewal"
            ? "Tenant would like to renew this lease."
            : "Tenant plans to move out when this lease ends."),
        tenant_responded_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    const { error: leaseError } = await supabase
      .from("leases")
      .update({
        renewal_status: nextRenewalStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lease.id);

    if (leaseError) {
      setMessage(leaseError.message);
      setSaving(false);
      return;
    }

    await createNotification({
      userId: lease.landlord_id,
      title:
        requestType === "tenant_requests_renewal"
          ? "Tenant wants to renew"
          : "Tenant plans to move out",
      message:
        requestType === "tenant_requests_renewal"
          ? `${lease.tenant_name || "A tenant"} wants to renew ${
              lease.property_address || "their lease"
            }.`
          : `${lease.tenant_name || "A tenant"} plans to move out from ${
              lease.property_address || "their lease"
            }.`,
      type: "lease_renewal",
      targetUrl: `/dashboard/landlord/leases/${lease.id}/renewal`,
      dedupe: false,
    });

    setTenantMessage("");
    setSuccessMessage(
      requestType === "tenant_requests_renewal"
        ? "Renewal request sent to landlord."
        : "Move-out plan sent to landlord."
    );

    await loadPage();
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading renewal page...</h1>
        </div>
      </main>
    );
  }

  if (!allowed || !lease) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Renewal unavailable</h1>
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
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href={`/dashboard/tenant/leases/${lease.id}`}
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Lease
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 pb-6">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Lease Renewal
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
              What’s your plan?
            </h1>

            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
              Let your landlord know whether you would like to renew or plan to
              move out when the lease ends.
            </p>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl bg-red-50 px-5 py-4 font-bold text-red-700 ring-1 ring-red-200">
              {message}
            </div>
          )}

          {successMessage && (
            <div className="mt-6 rounded-2xl bg-green-50 px-5 py-4 font-bold text-green-700 ring-1 ring-green-200">
              {successMessage}
            </div>
          )}

          <section className="mt-8 grid gap-5 md:grid-cols-2">
            <InfoCard
              label="Property"
              value={lease.property_address || "Not provided"}
            />

            <InfoCard
              label="Lease Ends"
              value={lease.lease_end_date || "Not provided"}
            />

            <InfoCard
              label="Current Rent"
              value={formatMoney(lease.monthly_rent)}
            />

            <InfoCard
              label="Renewal Status"
              value={lease.renewal_status || "not_started"}
            />
          </section>

          <section className="mt-8 rounded-3xl bg-[#f7f4ef] p-6">
            <h2 className="text-2xl font-black">Send Your Plan</h2>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-black text-slate-700">
                Optional message to landlord
              </span>

              <textarea
                value={tenantMessage}
                onChange={(event) => setTenantMessage(event.target.value)}
                rows={5}
                placeholder="Example: We would like to renew if possible. Please send renewal terms."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 leading-7 outline-none focus:border-slate-500"
              />
            </label>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => submitPlan("tenant_requests_renewal")}
                disabled={saving}
                className="rounded-full bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-60"
              >
                {saving ? "Sending..." : "I Want to Renew"}
              </button>

              <button
                type="button"
                onClick={() => submitPlan("tenant_plans_to_move_out")}
                disabled={saving}
                className="rounded-full border border-red-200 bg-red-50 px-6 py-3 font-black text-red-700 disabled:opacity-60"
              >
                I Plan to Move Out
              </button>
            </div>
          </section>

          <section className="mt-8 rounded-3xl bg-[#f7f4ef] p-6">
            <h2 className="text-2xl font-black">Renewal History</h2>

            {renewalRequests.length > 0 ? (
              <div className="mt-5 divide-y divide-slate-200 rounded-3xl bg-white">
                {renewalRequests.map((request) => (
                  <div key={request.id} className="p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-black">
                        {formatRenewalType(request.request_type)}
                      </h3>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                        {request.status}
                      </span>
                    </div>

                    {request.tenant_message && (
                      <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">
                        {request.tenant_message}
                      </p>
                    )}

                    {request.landlord_message && (
                      <div className="mt-3 rounded-2xl bg-blue-50 p-4 text-blue-900 ring-1 ring-blue-100">
                        <p className="text-sm font-black">Landlord Message</p>
                        <p className="mt-2 whitespace-pre-wrap leading-7">
                          {request.landlord_message}
                        </p>
                      </div>
                    )}

                    {request.proposed_monthly_rent && (
                      <p className="mt-3 text-sm font-bold text-slate-500">
                        Proposed rent: {formatMoney(request.proposed_monthly_rent)}
                      </p>
                    )}

                    <p className="mt-3 text-xs font-bold text-slate-500">
                      {new Date(request.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 font-bold text-slate-600">
                No renewal activity yet.
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