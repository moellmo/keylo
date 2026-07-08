"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { createNotification } from "@/lib/createNotification";

type Lease = {
  id: string;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  lease_status: string;
  tenant_name: string | null;
  landlord_name: string | null;
  property_address: string | null;
};

export default function NewMaintenanceRequestPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [leases, setLeases] = useState<Lease[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    lease_id: "",
    title: "",
    description: "",
    priority: "normal",
  });

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
      setMessage("Please log in as a tenant.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
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
        property_address
      `
      )
      .eq("tenant_id", user.id)
      .in("lease_status", ["sent_to_tenant", "tenant_signed", "completed"])
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    const leaseRows = (data || []) as Lease[];
    setLeases(leaseRows);

    if (leaseRows.length > 0) {
      setForm((current) => ({
        ...current,
        lease_id: current.lease_id || leaseRows[0].id,
      }));
    }

    setAllowed(true);
    setLoading(false);
  }

  async function submitRequest() {
    if (!form.lease_id) {
      setMessage("Please choose a lease/property.");
      return;
    }

    if (!form.title.trim()) {
      setMessage("Please enter a request title.");
      return;
    }

    if (!form.description.trim()) {
      setMessage("Please describe the maintenance issue.");
      return;
    }

    const selectedLease = leases.find((lease) => lease.id === form.lease_id);

    if (!selectedLease) {
      setMessage("Selected lease was not found.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { data: newRequest, error } = await supabase
      .from("maintenance_requests")
      .insert({
        lease_id: selectedLease.id,
        property_id: selectedLease.property_id,
        tenant_id: selectedLease.tenant_id,
        landlord_id: selectedLease.landlord_id,
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        status: "open",
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    await createNotification({
      userId: selectedLease.landlord_id,
      title: "New maintenance request",
      message: `${selectedLease.tenant_name || "A tenant"} submitted: ${
        form.title
      }`,
      type: "maintenance_request",
      targetUrl: "/dashboard/landlord/maintenance",
      dedupe: false,
    });

    setSaving(false);

    if (newRequest?.id) {
      router.push("/dashboard/tenant/maintenance");
    } else {
      router.push("/dashboard/tenant/maintenance");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading request form...</h1>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Maintenance unavailable</h1>

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
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link
          href="/dashboard/tenant/maintenance"
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Maintenance
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Maintenance Request
          </p>

          <h1 className="mt-3 text-5xl font-black tracking-tight">
            New Request
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            Tell your landlord what needs attention. For emergencies, contact
            your landlord or local emergency services directly as well.
          </p>

          {message && (
            <div className="mt-6 rounded-2xl bg-red-50 px-5 py-4 font-bold text-red-700 ring-1 ring-red-200">
              {message}
            </div>
          )}

          {leases.length === 0 ? (
            <div className="mt-8 rounded-3xl bg-[#f7f4ef] p-8 text-center">
              <h2 className="text-2xl font-black">No active lease found</h2>

              <p className="mt-3 text-slate-600">
                You need an active or completed lease before submitting a
                maintenance request.
              </p>

              <Link
                href="/dashboard/tenant"
                className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
              >
                Back to Dashboard
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid gap-6">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">
                  Lease / Property
                </span>

                <select
                  value={form.lease_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      lease_id: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-black outline-none focus:border-slate-950"
                >
                  {leases.map((lease) => (
                    <option key={lease.id} value={lease.id}>
                      {lease.property_address || "Property"} ·{" "}
                      {lease.landlord_name || "Landlord"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">
                  Priority
                </span>

                <select
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priority: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-black outline-none focus:border-slate-950"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">
                  Title
                </span>

                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Example: Kitchen sink is leaking"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-500"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">
                  Description
                </span>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={7}
                  placeholder="Describe the issue, where it is located, when it started, and any details the landlord should know."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 leading-7 outline-none focus:border-slate-500"
                />
              </label>

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
                <Link
                  href="/dashboard/tenant/maintenance"
                  className="rounded-full border border-slate-300 bg-white px-6 py-3 text-center font-black"
                >
                  Cancel
                </Link>

                <button
                  type="button"
                  onClick={submitRequest}
                  disabled={saving}
                  className="rounded-full bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-60"
                >
                  {saving ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}