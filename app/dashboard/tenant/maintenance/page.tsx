"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type MaintenanceRequest = {
  id: string;
  lease_id: string;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  title: string;
  description: string;
  priority: "low" | "normal" | "urgent" | "emergency";
  status: "open" | "in_progress" | "resolved" | "closed" | "cancelled";
  landlord_notes: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  leases:
    | {
        id: string;
        property_address: string | null;
        landlord_name: string | null;
        lease_status: string;
      }
    | {
        id: string;
        property_address: string | null;
        landlord_name: string | null;
        lease_status: string;
      }[]
    | null;
};

function getLease(request: MaintenanceRequest) {
  if (Array.isArray(request.leases)) {
    return request.leases[0] || null;
  }

  return request.leases;
}

function formatStatus(status: string) {
  if (status === "open") return "Open";
  if (status === "in_progress") return "In Progress";
  if (status === "resolved") return "Resolved";
  if (status === "closed") return "Closed";
  if (status === "cancelled") return "Cancelled";
  return status;
}

function formatPriority(priority: string) {
  if (priority === "low") return "Low";
  if (priority === "normal") return "Normal";
  if (priority === "urgent") return "Urgent";
  if (priority === "emergency") return "Emergency";
  return priority;
}

export default function TenantMaintenancePage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
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
      .from("maintenance_requests")
      .select(
        `
        *,
        leases (
          id,
          property_address,
          landlord_name,
          lease_status
        )
      `
      )
      .eq("tenant_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    setRequests((data || []) as unknown as MaintenanceRequest[]);
    setAllowed(true);
    setLoading(false);
  }

  const openRequests = requests.filter(
    (request) =>
      request.status === "open" || request.status === "in_progress"
  );

  const completedRequests = requests.filter(
    (request) =>
      request.status === "resolved" ||
      request.status === "closed" ||
      request.status === "cancelled"
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading maintenance...</h1>
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
                Maintenance Requests
              </p>

              <h1 className="mt-3 text-5xl font-black tracking-tight">
                Maintenance
              </h1>

              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
                Submit repair requests and track landlord updates.
              </p>
            </div>

            <Link
              href="/dashboard/tenant/maintenance/new"
              className="rounded-full bg-slate-950 px-6 py-3 text-center font-black text-white"
            >
              New Request
            </Link>
          </div>

          <section className="mt-8 grid gap-5 md:grid-cols-3">
            <SummaryCard label="Open" value={String(openRequests.length)} />
            <SummaryCard
              label="Completed"
              value={String(completedRequests.length)}
            />
            <SummaryCard label="Total" value={String(requests.length)} />
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black">Open Requests</h2>

            {openRequests.length > 0 ? (
              <div className="mt-5 grid gap-5">
                {openRequests.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No open maintenance requests"
                text="New requests will appear here."
              />
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black">Completed / Closed</h2>

            {completedRequests.length > 0 ? (
              <div className="mt-5 grid gap-5">
                {completedRequests.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No completed requests yet"
                text="Resolved, closed, or cancelled requests will appear here."
              />
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

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-5 rounded-3xl bg-[#f7f4ef] p-8 text-center">
      <h3 className="text-2xl font-black">{title}</h3>
      <p className="mt-2 text-slate-600">{text}</p>
    </div>
  );
}

function RequestCard({ request }: { request: MaintenanceRequest }) {
  const lease = getLease(request);

  return (
    <div className="rounded-3xl bg-[#f7f4ef] p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-black">{request.title}</h3>

            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
              {formatPriority(request.priority)}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-xs font-black ${
                request.status === "resolved" || request.status === "closed"
                  ? "bg-green-50 text-green-700"
                  : request.priority === "emergency" ||
                      request.priority === "urgent"
                    ? "bg-red-50 text-red-700"
                    : "bg-amber-50 text-amber-700"
              }`}
            >
              {formatStatus(request.status)}
            </span>
          </div>

          {lease?.property_address && (
            <p className="mt-3 font-bold text-slate-500">
              {lease.property_address}
            </p>
          )}

          <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">
            {request.description}
          </p>

          {request.landlord_notes && (
            <div className="mt-4 rounded-2xl bg-white p-4">
              <p className="text-sm font-black text-slate-500">
                Landlord Update
              </p>
              <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-700">
                {request.landlord_notes}
              </p>
            </div>
          )}

          <p className="mt-4 text-sm font-bold text-slate-500">
            Submitted {new Date(request.created_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}