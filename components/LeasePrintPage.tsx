"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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

type LeaseSignature = {
  id: string;
  signer_role: string;
  signer_name: string;
  signed_at: string;
  agreement_text: string | null;
};

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "Not provided";
  return `$${value.toLocaleString()}`;
}

function formatDate(value: string | null) {
  if (!value) return "Not provided";
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value: string | null) {
  if (!value) return "Not provided";
  return new Date(value).toLocaleString();
}

export default function LeasePrintPage({
  viewer,
}: {
  viewer: "tenant" | "landlord";
}) {
  const params = useParams();
  const leaseId = String(params.id);

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [lease, setLease] = useState<Lease | null>(null);
  const [signatures, setSignatures] = useState<LeaseSignature[]>([]);

  useEffect(() => {
    async function loadLease() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Please log in to view this lease.");
        setAllowed(false);
        setLoading(false);
        return;
      }

      const { data: leaseRow, error: leaseError } = await supabase
        .from("leases")
        .select("*")
        .eq("id", leaseId)
        .single();

      if (leaseError || !leaseRow) {
        setMessage("Lease not found.");
        setAllowed(false);
        setLoading(false);
        return;
      }

      const currentLease = leaseRow as Lease;

      const tenantCanView =
        viewer === "tenant" && currentLease.tenant_id === user.id;

      const landlordCanView =
        viewer === "landlord" && currentLease.landlord_id === user.id;

      if (!tenantCanView && !landlordCanView) {
        setMessage("You do not have permission to view this lease.");
        setAllowed(false);
        setLoading(false);
        return;
      }

      const { data: signatureRows } = await supabase
        .from("lease_signatures")
        .select("id, signer_role, signer_name, signed_at, agreement_text")
        .eq("lease_id", leaseId)
        .order("signed_at", { ascending: true });

      setLease(currentLease);
      setSignatures((signatureRows || []) as LeaseSignature[]);
      setAllowed(true);
      setLoading(false);
    }

    loadLease();
  }, [leaseId, viewer]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-black">Loading lease...</h1>
        </div>
      </main>
    );
  }

  if (!allowed || !lease) {
    return (
      <main className="min-h-screen bg-white px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-black">Lease unavailable</h1>
          <p className="mt-3 text-slate-600">{message}</p>

          <Link
            href={
              viewer === "tenant"
                ? "/dashboard/tenant"
                : "/dashboard/landlord"
            }
            className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white print:hidden"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const tenantSignature = signatures.find(
    (signature) => signature.signer_role === "tenant"
  );

  const landlordSignature = signatures.find(
    (signature) => signature.signer_role === "landlord"
  );

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-950 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={
              viewer === "tenant"
                ? `/dashboard/tenant/leases/${lease.id}`
                : `/dashboard/landlord/leases/${lease.id}`
            }
            className="font-bold text-slate-600"
          >
            ← Back to Lease
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full bg-slate-950 px-6 py-3 font-black text-white"
          >
            Print / Save as PDF
          </button>
        </div>

        <div className="bg-white p-10 shadow-sm ring-1 ring-slate-200 print:p-0 print:shadow-none print:ring-0">
          <header className="border-b border-slate-300 pb-6">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-slate-500">
              Keylo Lease Agreement
            </p>

            <h1 className="mt-3 text-4xl font-black">Residential Lease</h1>

            <p className="mt-3 text-slate-600">
              Lease ID: <span className="font-bold">{lease.id}</span>
            </p>

            <p className="mt-1 text-slate-600">
              Status:{" "}
              <span className="font-bold">
                {lease.lease_status === "completed"
                  ? "Completed"
                  : lease.lease_status}
              </span>
            </p>
          </header>

          <section className="mt-8">
            <h2 className="text-2xl font-black">Parties</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <PrintItem label="Tenant" value={lease.tenant_name} />
              <PrintItem label="Landlord" value={lease.landlord_name} />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black">Property</h2>

            <div className="mt-4">
              <PrintItem label="Property Address" value={lease.property_address} />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black">Financial Terms</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <PrintItem
                label="Monthly Rent"
                value={formatMoney(lease.monthly_rent)}
              />
              <PrintItem
                label="Security Deposit"
                value={formatMoney(lease.security_deposit)}
              />
              <PrintItem
                label="Rent Due Day"
                value={
                  lease.rent_due_day
                    ? `Day ${lease.rent_due_day} of each month`
                    : "Not provided"
                }
              />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black">Lease Dates</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <PrintItem
                label="Lease Start Date"
                value={formatDate(lease.lease_start_date)}
              />
              <PrintItem
                label="Lease End Date"
                value={formatDate(lease.lease_end_date)}
              />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black">Terms and Conditions</h2>

            <div className="mt-4 grid gap-4">
              <PrintBlock label="Utilities Terms" value={lease.utilities_terms} />
              <PrintBlock label="Pet Terms" value={lease.pet_terms} />
              <PrintBlock
                label="Maintenance Terms"
                value={lease.maintenance_terms}
              />
              <PrintBlock
                label="Additional Terms"
                value={lease.additional_terms}
              />
            </div>
          </section>

          <section className="mt-10 border-t border-slate-300 pt-8">
            <h2 className="text-2xl font-black">Electronic Signatures</h2>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-300 p-5">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                  Tenant Signature
                </p>

                <p className="mt-4 text-2xl font-black">
                  {tenantSignature?.signer_name || "Not signed"}
                </p>

                <p className="mt-2 text-sm font-bold text-slate-600">
                  Signed:{" "}
                  {tenantSignature
                    ? formatDateTime(tenantSignature.signed_at)
                    : "Not signed"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-300 p-5">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                  Landlord Signature
                </p>

                <p className="mt-4 text-2xl font-black">
                  {landlordSignature?.signer_name || "Not signed"}
                </p>

                <p className="mt-2 text-sm font-bold text-slate-600">
                  Signed:{" "}
                  {landlordSignature
                    ? formatDateTime(landlordSignature.signed_at)
                    : "Not signed"}
                </p>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-slate-600">
              By signing electronically, each party agreed that typing their
              name and submitting the signature in Keylo represents their
              electronic signature for this lease agreement.
            </p>
          </section>

          <footer className="mt-10 border-t border-slate-300 pt-6 text-sm text-slate-500">
            <p>
              Completed:{" "}
              <span className="font-bold">
                {formatDateTime(lease.completed_at)}
              </span>
            </p>
            <p className="mt-1">
              Generated by Keylo on {new Date().toLocaleString()}.
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}

function PrintItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 print:border print:border-slate-200 print:bg-white">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 font-black">{value || "Not provided"}</p>
    </div>
  );
}

function PrintBlock({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 print:border print:border-slate-200 print:bg-white">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">
        {value || "Not provided"}
      </p>
    </div>
  );
}