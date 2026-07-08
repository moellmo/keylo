"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createNotification } from "@/lib/createNotification";

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

export default function LandlordMaintenancePage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("error");
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [savingId, setSavingId] = useState("");
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  useEffect(() => {
    loadRequests();
  }, []);

  function showError(errorMessage: string) {
    setMessageType("error");
    setMessage(errorMessage);
  }

  function showSuccess(successMessage: string) {
    setMessageType("success");
    setMessage(successMessage);
  }

  async function loadRequests() {
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
      showError("Only landlords can view maintenance requests.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const query = supabase
      .from("maintenance_requests")
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
      .order("created_at", { ascending: false });

    const { data, error } =
      profile?.role === "admin"
        ? await query
        : await query.eq("landlord_id", user.id);

    if (error) {
      showError(error.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    const rows = (data || []) as unknown as MaintenanceRequest[];
    setRequests(rows);

    const startingNotes: Record<string, string> = {};
    rows.forEach((request) => {
      startingNotes[request.id] = request.landlord_notes || "";
    });

    setNotesById(startingNotes);
    setAllowed(true);
    setLoading(false);
  }

  async function updateRequestStatus(
    request: MaintenanceRequest,
    status: MaintenanceRequest["status"]
  ) {
    const confirmed = window.confirm(
      `Update this request to ${formatStatus(status)}?`
    );

    if (!confirmed) return;

    setSavingId(request.id);
    setMessage("");

    const now = new Date().toISOString();

    const updatePayload: {
      status: MaintenanceRequest["status"];
      landlord_notes: string | null;
      updated_at: string;
      resolved_at?: string | null;
      closed_at?: string | null;
    } = {
      status,
      landlord_notes: notesById[request.id]?.trim() || null,
      updated_at: now,
    };

    if (status === "resolved") {
      updatePayload.resolved_at = now;
    }

    if (status === "closed") {
      updatePayload.closed_at = now;
    }

    const { error } = await supabase
      .from("maintenance_requests")
      .update(updatePayload)
      .eq("id", request.id);

    if (error) {
      showError(error.message);
      setSavingId("");
      return;
    }

    await createNotification({
      userId: request.tenant_id,
      title: "Maintenance request updated",
      message: `"${request.title}" is now ${formatStatus(status)}.`,
      type: "maintenance_update",
      targetUrl: "/dashboard/tenant/maintenance",
      dedupe: false,
    });

    setSavingId("");
    await loadRequests();
    showSuccess("Maintenance request updated.");
  }

  async function saveNotes(request: MaintenanceRequest) {
    setSavingId(request.id);
    setMessage("");

    const { error } = await supabase
      .from("maintenance_requests")
      .update({
        landlord_notes: notesById[request.id]?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) {
      showError(error.message);
      setSavingId("");
      return;
    }

    await createNotification({
      userId: request.tenant_id,
      title: "Maintenance note added",
      message: `Your landlord added an update to "${request.title}".`,
      type: "maintenance_update",
      targetUrl: "/dashboard/tenant/maintenance",
      dedupe: false,
    });

    setSavingId("");
    await loadRequests();
    showSuccess("Landlord note saved.");
  }

  const activeRequests = requests.filter(
    (request) =>
      request.status === "open" || request.status === "in_progress"
  );

  const completedRequests = requests.filter(
    (request) =>
      request.status === "resolved" ||
      request.status === "closed" ||
      request.status === "cancelled"
  );

  const urgentRequests = requests.filter(
    (request) =>
      (request.priority === "urgent" || request.priority === "emergency") &&
      (request.status === "open" || request.status === "in_progress")
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
          href="/dashboard/landlord"
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Landlord Dashboard
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
                View tenant repair requests, update status, and send notes back
                to tenants.
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
            <SummaryCard label="Active" value={String(activeRequests.length)} />
            <SummaryCard label="Urgent" value={String(urgentRequests.length)} />
            <SummaryCard label="Total" value={String(requests.length)} />
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black">Active Requests</h2>

            {activeRequests.length > 0 ? (
              <div className="mt-5 grid gap-5">
                {activeRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    savingId={savingId}
                    notesById={notesById}
                    setNotesById={setNotesById}
                    onSaveNotes={saveNotes}
                    onUpdateStatus={updateRequestStatus}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No active maintenance requests"
                text="Open and in-progress requests will appear here."
              />
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black">Completed / Closed</h2>

            {completedRequests.length > 0 ? (
              <div className="mt-5 grid gap-5">
                {completedRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    savingId={savingId}
                    notesById={notesById}
                    setNotesById={setNotesById}
                    onSaveNotes={saveNotes}
                    onUpdateStatus={updateRequestStatus}
                  />
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

function RequestCard({
  request,
  savingId,
  notesById,
  setNotesById,
  onSaveNotes,
  onUpdateStatus,
}: {
  request: MaintenanceRequest;
  savingId: string;
  notesById: Record<string, string>;
  setNotesById: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSaveNotes: (request: MaintenanceRequest) => void;
  onUpdateStatus: (
    request: MaintenanceRequest,
    status: MaintenanceRequest["status"]
  ) => void;
}) {
  const lease = getLease(request);
  const isActive =
    request.status === "open" || request.status === "in_progress";

  return (
    <div className="rounded-3xl bg-[#f7f4ef] p-6">
      <div className="flex flex-col gap-5">
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

          {lease?.tenant_name && (
            <p className="mt-3 font-bold text-slate-500">
              Tenant: {lease.tenant_name}
            </p>
          )}

          {lease?.property_address && (
            <p className="mt-2 font-bold text-slate-500">
              {lease.property_address}
            </p>
          )}

          <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">
            {request.description}
          </p>

          <p className="mt-4 text-sm font-bold text-slate-500">
            Submitted {new Date(request.created_at).toLocaleString()}
          </p>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-black text-slate-700">
            Landlord Notes / Update
          </span>

          <textarea
            value={notesById[request.id] || ""}
            onChange={(event) =>
              setNotesById((current) => ({
                ...current,
                [request.id]: event.target.value,
              }))
            }
            rows={4}
            placeholder="Add an update for the tenant..."
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 leading-7 outline-none focus:border-slate-500"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSaveNotes(request)}
            disabled={savingId === request.id}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black disabled:opacity-60"
          >
            {savingId === request.id ? "Saving..." : "Save Note"}
          </button>

          {isActive && request.status !== "in_progress" && (
            <button
              type="button"
              onClick={() => onUpdateStatus(request, "in_progress")}
              disabled={savingId === request.id}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
            >
              Mark In Progress
            </button>
          )}

          {isActive && (
            <button
              type="button"
              onClick={() => onUpdateStatus(request, "resolved")}
              disabled={savingId === request.id}
              className="rounded-full bg-green-700 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
            >
              Mark Resolved
            </button>
          )}

          {request.status === "resolved" && (
            <button
              type="button"
              onClick={() => onUpdateStatus(request, "closed")}
              disabled={savingId === request.id}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
            >
              Close
            </button>
          )}

          {isActive && (
            <button
              type="button"
              onClick={() => onUpdateStatus(request, "cancelled")}
              disabled={savingId === request.id}
              className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-700 disabled:opacity-60"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}