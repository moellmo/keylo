"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createNotification } from "@/lib/createNotification";
import RatingForm from "@/components/RatingForm";
import LeaseFeeBox from "@/components/LeaseFeeBox";

type CustomLeaseSection = {
  section_title: string;
  section_body: string;
  sort_order: number;
  is_required: boolean;
};

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
  custom_sections: CustomLeaseSection[] | null;
  sent_to_tenant_at: string | null;
  tenant_signed_at: string | null;
  landlord_signed_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type RatingRow = {
  id: string;
};

function formatStatus(status: string) {
  if (status === "draft") return "Draft";
  if (status === "sent_to_tenant") return "Sent to Tenant";
  if (status === "tenant_signed") return "Ready for Landlord Signature";
  if (status === "landlord_signed") return "Landlord Signed";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";

  return status;
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "Not provided";

  return `$${value.toLocaleString()}`;
}

function getCustomSections(lease: Lease) {
  return [...(lease.custom_sections || [])].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
  );
}

export default function LandlordLeaseDetailPage() {
  const params = useParams();
  const leaseId = String(params.id);

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("error");
  const [lease, setLease] = useState<Lease | null>(null);
  const [existingRating, setExistingRating] = useState<RatingRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [esignFeePaid, setEsignFeePaid] = useState(false);

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

    const isAdmin = profile?.role === "admin";
    const isLandlord = leaseRow.landlord_id === user.id;

    if (!isAdmin && !isLandlord) {
      showError("You do not have permission to view this lease.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: ratingRow } = await supabase
      .from("ratings")
      .select("id")
      .eq("lease_id", leaseRow.id)
      .eq("reviewer_id", user.id)
      .eq("reviewee_id", leaseRow.tenant_id)
      .maybeSingle();

    setLease(leaseRow);
    setExistingRating((ratingRow as RatingRow | null) || null);
    setSignatureName(leaseRow.landlord_name || "");
    setAllowed(true);
    setLoading(false);
  }

  async function sendToTenant() {
    if (!lease) return;

    const confirmed = window.confirm("Send this lease to the tenant?");
    if (!confirmed) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("leases")
      .update({
        lease_status: "sent_to_tenant",
        sent_to_tenant_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lease.id);

    if (error) {
      showError(error.message);
      setSaving(false);
      return;
    }

    await createNotification({
      userId: lease.tenant_id,
      title: "Lease ready to sign",
      message: `Your lease for ${
        lease.property_address || "the rental"
      } is ready to review and sign.`,
      type: "lease_sent",
      targetUrl: `/dashboard/tenant/leases/${lease.id}`,
      dedupe: true,
    });

    setSaving(false);
    await loadLease();
    showSuccess("Lease sent to tenant successfully.");
  }

  async function signLeaseAsLandlord() {
    if (!lease) return;

    if (!esignFeePaid) {
      showError("Please pay the $75 e-sign fee before completing the lease.");
      return;
    }

    if (lease.lease_status !== "tenant_signed") {
      showError("The tenant must sign before the landlord can complete this lease.");
      return;
    }

    if (!signatureName.trim()) {
      showError("Please type your legal or company name to sign.");
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
        signer_role: "landlord",
        signer_name: signatureName.trim(),
        agreement_text:
          "Landlord electronically agreed to and signed this lease in Keylo.",
      });

    if (signatureError) {
      showError(signatureError.message);
      setSigning(false);
      return;
    }

    const now = new Date().toISOString();

    const { error: leaseError } = await supabase
      .from("leases")
      .update({
        lease_status: "completed",
        landlord_signed_at: now,
        completed_at: now,
        updated_at: now,
      })
      .eq("id", lease.id);

    if (leaseError) {
      showError(leaseError.message);
      setSigning(false);
      return;
    }

    await createNotification({
      userId: lease.tenant_id,
      title: "Lease completed",
      message: `Your lease for ${
        lease.property_address || "the rental"
      } has been completed. You can download your signed copy.`,
      type: "lease_completed",
      targetUrl: `/dashboard/tenant/leases/${lease.id}`,
      dedupe: true,
    });

    setSigning(false);
    await loadLease();
    showSuccess("Lease completed successfully. Both parties have signed.");
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
            href="/dashboard/landlord"
            className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const canLandlordSign = lease.lease_status === "tenant_signed";
  const canRateTenant = lease.lease_status === "completed";
  const customSections = getCustomSections(lease);

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href={`/dashboard/landlord/applications/${lease.application_id}`}
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Application
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Lease
              </p>

              <h1 className="mt-3 text-5xl font-black tracking-tight">
                Lease for {lease.tenant_name || "Tenant"}
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
                  lease.rent_due_day ? String(lease.rent_due_day) : "Not provided"
                }
              />
              <InfoCard
                label="Sent to Tenant"
                value={
                  lease.sent_to_tenant_at
                    ? new Date(lease.sent_to_tenant_at).toLocaleString()
                    : "Not sent yet"
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

          {customSections.length > 0 && (
            <section className="mt-8">
              <h2 className="text-2xl font-black">Custom Lease Sections</h2>

              <div className="mt-5 grid gap-5">
                {customSections.map((section, index) => (
                  <div
                    key={`${section.section_title}-${index}`}
                    className="rounded-3xl bg-[#f7f4ef] p-5"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                        {section.sort_order}. {section.section_title}
                      </p>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          section.is_required
                            ? "bg-slate-950 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {section.is_required ? "Required" : "Optional"}
                      </span>
                    </div>

                    <p className="mt-3 whitespace-pre-wrap leading-8 text-slate-700">
                      {section.section_body || "Not provided"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-8 rounded-3xl bg-[#f7f4ef] p-6">
            <h2 className="text-2xl font-black">Signing Status</h2>

            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <InfoCard
                label="Tenant Signed"
                value={
                  lease.tenant_signed_at
                    ? new Date(lease.tenant_signed_at).toLocaleString()
                    : "Not signed"
                }
              />

              <InfoCard
                label="Landlord Signed"
                value={
                  lease.landlord_signed_at
                    ? new Date(lease.landlord_signed_at).toLocaleString()
                    : "Not signed"
                }
              />

              <InfoCard
                label="Completed"
                value={
                  lease.completed_at
                    ? new Date(lease.completed_at).toLocaleString()
                    : "Not completed"
                }
              />
            </div>
          </section>

          <section className="mt-8">
            <LeaseFeeBox
              leaseId={lease.id}
              userId={lease.landlord_id}
              payerRole="landlord"
              onStatusChange={setEsignFeePaid}
            />
          </section>

          <section className="mt-8 rounded-3xl bg-[#f7f4ef] p-6">
            <h2 className="text-2xl font-black">Landlord Signature</h2>

            {lease.landlord_signed_at ? (
              <div className="mt-4 rounded-2xl bg-white p-5">
                <p className="font-black text-slate-950">
                  Landlord signature complete
                </p>
                <p className="mt-2 font-bold text-slate-600">
                  Signed on{" "}
                  {new Date(lease.landlord_signed_at).toLocaleString()}.
                </p>
                {lease.completed_at && (
                  <p className="mt-2 text-sm font-bold text-slate-500">
                    Lease completed on{" "}
                    {new Date(lease.completed_at).toLocaleString()}.
                  </p>
                )}
              </div>
            ) : canLandlordSign ? (
              <div className="mt-5 grid gap-5">
                {!esignFeePaid && (
                  <div className="rounded-2xl bg-amber-50 p-4 font-bold text-amber-800 ring-1 ring-amber-200">
                    Pay the $75 e-sign fee above before completing the lease.
                  </div>
                )}

                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">
                    Type Legal or Company Name
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
                    I agree that typing my name and clicking Complete Lease is
                    my electronic signature for this lease agreement.
                  </span>
                </label>

                <button
                  type="button"
                  onClick={signLeaseAsLandlord}
                  disabled={signing || !esignFeePaid}
                  className="rounded-full bg-slate-950 px-6 py-4 font-black text-white disabled:opacity-60"
                >
                  {signing ? "Completing..." : "Complete Lease"}
                </button>
              </div>
            ) : lease.lease_status === "sent_to_tenant" ? (
              <p className="mt-4 font-bold text-slate-600">
                Waiting for tenant signature before landlord can sign.
              </p>
            ) : lease.lease_status === "draft" ? (
              <p className="mt-4 font-bold text-slate-600">
                Send this lease to the tenant before signatures can begin.
              </p>
            ) : (
              <p className="mt-4 font-bold text-slate-600">
                This lease is not ready for landlord signature.
              </p>
            )}
          </section>

          {canRateTenant && (
            <section className="mt-8">
              {existingRating ? (
                <div className="rounded-3xl bg-green-50 p-6 text-green-800 ring-1 ring-green-200">
                  <h2 className="text-2xl font-black">Tenant Rated</h2>
                  <p className="mt-2 font-bold">
                    You already submitted a rating for this tenant.
                  </p>
                </div>
              ) : (
                <RatingForm
                  leaseId={lease.id}
                  reviewerId={lease.landlord_id}
                  revieweeId={lease.tenant_id}
                  reviewerRole="landlord"
                  revieweeRole="tenant"
                  onSaved={loadLease}
                />
              )}
            </section>
          )}

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
            
            <Link
  href={`/dashboard/landlord/leases/${lease.id}/payments`}
  className="rounded-full bg-slate-950 px-6 py-3 text-center font-black text-white"
>
  Payments
</Link>
            <Link
              href={`/dashboard/landlord/leases/${lease.id}/print`}
              className="rounded-full border border-slate-300 bg-white px-6 py-3 text-center font-black"
            >
              Download / Print PDF
            </Link>

            <Link
              href="/dashboard/landlord"
              className="rounded-full border border-slate-300 bg-white px-6 py-3 text-center font-black"
            >
              Back to Dashboard
            </Link>

            {lease.lease_status === "draft" && (
              <button
                type="button"
                onClick={sendToTenant}
                disabled={saving}
                className="rounded-full bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-60"
              >
                {saving ? "Sending..." : "Send to Tenant"}
              </button>
            )}
          </div>
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