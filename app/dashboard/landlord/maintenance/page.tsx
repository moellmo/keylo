"use client";

import Link from "next/link";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createNotification } from "@/lib/createNotification";

type LeaseForMaintenance = {
  id: string;
  property_address: string | null;
  tenant_name: string | null;
  landlord_name: string | null;
  lease_status: string;
};

type MaintenanceRequest = {
  id: string;
  lease_id: string;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  landlord_company_id: string | null;
  title: string;
  description: string;
  priority: "low" | "normal" | "urgent" | "emergency";
  status: "open" | "in_progress" | "resolved" | "closed" | "cancelled";
  landlord_notes: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  leases: LeaseForMaintenance | LeaseForMaintenance[] | null;
};

type MaintenancePhotoRow = {
  maintenance_request_id: string;
};

type MaintenanceUpdate = {
  id: string;
  maintenance_request_id: string;
  actor_role: "tenant" | "landlord" | "admin";
  update_type:
    | "created"
    | "status_changed"
    | "note_added"
    | "photo_added"
    | "tenant_message"
    | "landlord_message";
  old_status: string | null;
  new_status: string | null;
  note: string | null;
  created_at: string;
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

function getLease(request: MaintenanceRequest) {
  if (Array.isArray(request.leases)) {
    return request.leases[0] || null;
  }

  return request.leases;
}

function getCompanyFromMembership(membership: CompanyMembership | null) {
  if (!membership) return null;

  if (Array.isArray(membership.landlord_companies)) {
    return membership.landlord_companies[0] || null;
  }

  return membership.landlord_companies;
}

function canManageMaintenance(role: string) {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "manager" ||
    role === "maintenance"
  );
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

function formatUpdateType(type: string) {
  if (type === "created") return "Request Created";
  if (type === "status_changed") return "Status Changed";
  if (type === "note_added") return "Note Added";
  if (type === "photo_added") return "Photo Added";
  if (type === "tenant_message") return "Tenant Update";
  if (type === "landlord_message") return "Landlord Update";
  return type;
}

export default function LandlordMaintenancePage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("error");
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [savingId, setSavingId] = useState("");
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [latestUpdates, setLatestUpdates] = useState<
    Record<string, MaintenanceUpdate>
  >({});

  const [companyName, setCompanyName] = useState("");
  const [companyRole, setCompanyRole] = useState("");

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

      if (membership && !canManageMaintenance(membership.role)) {
        showError("Your company role does not have access to maintenance.");
        setAllowed(false);
        setLoading(false);
        return;
      }
    }

    let query = supabase
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

    if (profile?.role === "admin") {
      const { data, error } = await query;

      if (error) {
        showError(error.message);
        setAllowed(false);
        setLoading(false);
        return;
      }

      await finishLoadingRequests((data || []) as unknown as MaintenanceRequest[]);
      return;
    }

    if (companyId && canManageMaintenance(membershipRole)) {
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

    await finishLoadingRequests((data || []) as unknown as MaintenanceRequest[]);
  }

  async function finishLoadingRequests(rows: MaintenanceRequest[]) {
    setRequests(rows);

    const startingNotes: Record<string, string> = {};
    rows.forEach((request) => {
      startingNotes[request.id] = request.landlord_notes || "";
    });

    setNotesById(startingNotes);

    const requestIds = rows.map((request) => request.id);

    if (requestIds.length > 0) {
      const { data: photoRows, error: photoError } = await supabase
        .from("maintenance_request_photos")
        .select("maintenance_request_id")
        .in("maintenance_request_id", requestIds);

      if (photoError) {
        showError(photoError.message);
        setAllowed(false);
        setLoading(false);
        return;
      }

      const nextPhotoCounts: Record<string, number> = {};

      ((photoRows || []) as MaintenancePhotoRow[]).forEach((photo) => {
        nextPhotoCounts[photo.maintenance_request_id] =
          (nextPhotoCounts[photo.maintenance_request_id] || 0) + 1;
      });

      setPhotoCounts(nextPhotoCounts);

      const { data: updateRows, error: updateError } = await supabase
        .from("maintenance_request_updates")
        .select(
          `
          id,
          maintenance_request_id,
          actor_role,
          update_type,
          old_status,
          new_status,
          note,
          created_at
        `
        )
        .in("maintenance_request_id", requestIds)
        .order("created_at", { ascending: false });

      if (updateError) {
        showError(updateError.message);
        setAllowed(false);
        setLoading(false);
        return;
      }

      const nextLatestUpdates: Record<string, MaintenanceUpdate> = {};

      ((updateRows || []) as MaintenanceUpdate[]).forEach((update) => {
        if (!nextLatestUpdates[update.maintenance_request_id]) {
          nextLatestUpdates[update.maintenance_request_id] = update;
        }
      });

      setLatestUpdates(nextLatestUpdates);
    } else {
      setPhotoCounts({});
      setLatestUpdates({});
    }

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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      showError("Please log in again.");
      setSavingId("");
      return;
    }

    const now = new Date().toISOString();

    const updatePayload: {
      status: MaintenanceRequest["status"];
      landlord_notes: string | null;
      updated_at: string;
      resolved_at?: string | null;
      closed_at?: string | null;
    } = {
      status,
      landlord_notes: notesById[request.id]?.trim() || request.landlord_notes,
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

    const { error: timelineError } = await supabase
      .from("maintenance_request_updates")
      .insert({
        maintenance_request_id: request.id,
        actor_id: user.id,
        actor_role: "landlord",
        update_type: "status_changed",
        old_status: request.status,
        new_status: status,
        note:
          notesById[request.id]?.trim() ||
          `Status changed to ${formatStatus(status)}.`,
      });

    if (timelineError) {
      showError(timelineError.message);
      setSavingId("");
      return;
    }

    await createNotification({
      userId: request.tenant_id,
      title: "Maintenance request updated",
      message: `"${request.title}" is now ${formatStatus(status)}.`,
      type: "maintenance_update",
      targetUrl: `/dashboard/tenant/maintenance/${request.id}`,
      dedupe: false,
    });

    setSavingId("");
    await loadRequests();
    showSuccess("Maintenance request updated.");
  }

  async function saveNotes(request: MaintenanceRequest) {
    if (!notesById[request.id]?.trim()) {
      showError("Please enter a note.");
      return;
    }

    setSavingId(request.id);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      showError("Please log in again.");
      setSavingId("");
      return;
    }

    const note = notesById[request.id].trim();

    const { error } = await supabase
      .from("maintenance_requests")
      .update({
        landlord_notes: note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) {
      showError(error.message);
      setSavingId("");
      return;
    }

    const { error: updateError } = await supabase
      .from("maintenance_request_updates")
      .insert({
        maintenance_request_id: request.id,
        actor_id: user.id,
        actor_role: "landlord",
        update_type: "landlord_message",
        note,
      });

    if (updateError) {
      showError(updateError.message);
      setSavingId("");
      return;
    }

    await createNotification({
      userId: request.tenant_id,
      title: "Maintenance note added",
      message: `Your landlord added an update to "${request.title}".`,
      type: "maintenance_update",
      targetUrl: `/dashboard/tenant/maintenance/${request.id}`,
      dedupe: false,
    });

    setSavingId("");
    await loadRequests();
    showSuccess("Landlord note saved.");
  }

  const activeRequests = requests.filter(
    (request) => request.status === "open" || request.status === "in_progress"
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
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-black sm:text-3xl">
            Loading maintenance...
          </h1>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6 sm:py-10">
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
                Maintenance Requests
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                Maintenance
              </h1>

              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                View tenant repair requests, photo counts, latest updates, and
                full request tracking.
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
                    photoCount={photoCounts[request.id] || 0}
                    latestUpdate={latestUpdates[request.id] || null}
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
                    photoCount={photoCounts[request.id] || 0}
                    latestUpdate={latestUpdates[request.id] || null}
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
  photoCount,
  latestUpdate,
}: {
  request: MaintenanceRequest;
  savingId: string;
  notesById: Record<string, string>;
  setNotesById: Dispatch<SetStateAction<Record<string, string>>>;
  onSaveNotes: (request: MaintenanceRequest) => void;
  onUpdateStatus: (
    request: MaintenanceRequest,
    status: MaintenanceRequest["status"]
  ) => void;
  photoCount: number;
  latestUpdate: MaintenanceUpdate | null;
}) {
  const lease = getLease(request);
  const isActive =
    request.status === "open" || request.status === "in_progress";

  return (
    <div className="rounded-3xl bg-[#f7f4ef] p-5 sm:p-6">
      <div className="flex flex-col gap-5">
        <Link
          href={`/dashboard/landlord/maintenance/${request.id}`}
          className="block rounded-2xl bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-black">{request.title}</h3>

                <span className="rounded-full bg-[#f7f4ef] px-3 py-1 text-xs font-black text-slate-700">
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

                <span className="rounded-full bg-[#f7f4ef] px-3 py-1 text-xs font-black text-slate-700">
                  {photoCount} photo{photoCount === 1 ? "" : "s"}
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

              <p className="mt-4 line-clamp-3 whitespace-pre-wrap leading-7 text-slate-700">
                {request.description}
              </p>

              {latestUpdate && (
                <div className="mt-4 rounded-2xl bg-[#f7f4ef] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black text-slate-500">
                      Latest Update
                    </p>

                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black uppercase text-slate-500">
                      {latestUpdate.actor_role}
                    </span>

                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black uppercase text-slate-500">
                      {formatUpdateType(latestUpdate.update_type)}
                    </span>
                  </div>

                  {latestUpdate.old_status && latestUpdate.new_status && (
                    <p className="mt-2 text-sm font-bold text-slate-600">
                      {formatStatus(latestUpdate.old_status)} →{" "}
                      {formatStatus(latestUpdate.new_status)}
                    </p>
                  )}

                  {latestUpdate.note && (
                    <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {latestUpdate.note}
                    </p>
                  )}

                  <p className="mt-3 text-xs font-bold text-slate-500">
                    {new Date(latestUpdate.created_at).toLocaleString()}
                  </p>
                </div>
              )}

              <p className="mt-4 text-sm font-bold text-slate-500">
                Submitted {new Date(request.created_at).toLocaleString()}
              </p>
            </div>

            <span className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-black text-white">
              View Full Request
            </span>
          </div>
        </Link>

        <label className="block">
          <span className="mb-2 block text-sm font-black text-slate-700">
            Quick Landlord Note
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