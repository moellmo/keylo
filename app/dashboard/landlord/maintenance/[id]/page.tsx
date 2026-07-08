"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { createNotification } from "@/lib/createNotification";

type LeaseForMaintenance = {
  id: string;
  property_address: string | null;
  landlord_name: string | null;
  tenant_name: string | null;
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

type MaintenancePhoto = {
  id: string;
  maintenance_request_id: string;
  uploaded_by: string;
  file_path: string;
  file_name: string | null;
  content_type: string | null;
  created_at: string;
};

type MaintenanceUpdate = {
  id: string;
  maintenance_request_id: string;
  actor_id: string;
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
};

type PhotoWithUrl = MaintenancePhoto & {
  signedUrl: string | null;
};

function getLease(request: MaintenanceRequest) {
  if (Array.isArray(request.leases)) {
    return request.leases[0] || null;
  }

  return request.leases;
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

export default function LandlordMaintenanceDetailPage() {
  const params = useParams();
  const requestId = String(params.id || "");

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("error");
  const [request, setRequest] = useState<MaintenanceRequest | null>(null);
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [updates, setUpdates] = useState<MaintenanceUpdate[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [companyRole, setCompanyRole] = useState("");

  useEffect(() => {
    loadRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  function showError(errorMessage: string) {
    setMessageType("error");
    setMessage(errorMessage);
  }

  function showSuccess(successMessage: string) {
    setMessageType("success");
    setMessage(successMessage);
  }

  async function loadRequest() {
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
      showError("Only landlords can view this request.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: requestRow, error: requestError } = await supabase
      .from("maintenance_requests")
      .select(
        `
        *,
        leases (
          id,
          property_address,
          landlord_name,
          tenant_name,
          lease_status
        )
      `
      )
      .eq("id", requestId)
      .single();

    if (requestError || !requestRow) {
      showError(requestError?.message || "Maintenance request not found.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const typedRequest = requestRow as unknown as MaintenanceRequest;

    const isAdmin = profile?.role === "admin";
    const isOriginalLandlord = typedRequest.landlord_id === user.id;

    let isCompanyMaintenanceUser = false;
    let currentCompanyRole = "";

    if (!isAdmin && !isOriginalLandlord && typedRequest.landlord_company_id) {
      const { data: membership, error: membershipError } = await supabase
        .from("landlord_company_members")
        .select("company_id, role")
        .eq("company_id", typedRequest.landlord_company_id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (membershipError) {
        showError(membershipError.message);
        setAllowed(false);
        setLoading(false);
        return;
      }

      const companyMembership = membership as CompanyMembership | null;

      currentCompanyRole = companyMembership?.role || "";
      isCompanyMaintenanceUser =
        !!companyMembership && canManageMaintenance(companyMembership.role);
    }

    if (!isAdmin && !isOriginalLandlord && !isCompanyMaintenanceUser) {
      showError("You do not have permission to view this request.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    setRequest(typedRequest);
    setNote(typedRequest.landlord_notes || "");
    setCompanyRole(currentCompanyRole);

    const { data: photoRows, error: photosError } = await supabase
      .from("maintenance_request_photos")
      .select("*")
      .eq("maintenance_request_id", requestId)
      .order("created_at", { ascending: true });

    if (photosError) {
      showError(photosError.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    const photosWithUrls: PhotoWithUrl[] = [];

    for (const photo of (photoRows || []) as MaintenancePhoto[]) {
      const { data: signedData } = await supabase.storage
        .from("maintenance-photos")
        .createSignedUrl(photo.file_path, 60 * 60);

      photosWithUrls.push({
        ...photo,
        signedUrl: signedData?.signedUrl || null,
      });
    }

    setPhotos(photosWithUrls);

    const { data: updateRows, error: updatesError } = await supabase
      .from("maintenance_request_updates")
      .select("*")
      .eq("maintenance_request_id", requestId)
      .order("created_at", { ascending: false });

    if (updatesError) {
      showError(updatesError.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    setUpdates((updateRows || []) as MaintenanceUpdate[]);
    setAllowed(true);
    setLoading(false);
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;

    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/")
    );

    setSelectedFiles(imageFiles.slice(0, 6));
  }

  async function uploadPhotos() {
    if (!request) return;

    if (selectedFiles.length === 0) {
      showError("Please choose at least one photo.");
      return;
    }

    setSaving(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      showError("Please log in again.");
      setSaving(false);
      return;
    }

    try {
      for (const file of selectedFiles) {
        const fileExt = file.name.split(".").pop() || "jpg";
        const safeFileName = file.name
          .replace(/\s+/g, "-")
          .replace(/[^a-zA-Z0-9.-]/g, "")
          .toLowerCase();

        const filePath = `${request.tenant_id}/${request.id}/${Date.now()}-${
          safeFileName || `photo.${fileExt}`
        }`;

        const { error: uploadError } = await supabase.storage
          .from("maintenance-photos")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { error: photoError } = await supabase
          .from("maintenance_request_photos")
          .insert({
            maintenance_request_id: request.id,
            lease_id: request.lease_id,
            property_id: request.property_id,
            tenant_id: request.tenant_id,
            landlord_id: request.landlord_id,
            uploaded_by: user.id,
            file_path: filePath,
            file_name: file.name,
            content_type: file.type,
          });

        if (photoError) {
          throw new Error(photoError.message);
        }

        const { error: updateError } = await supabase
          .from("maintenance_request_updates")
          .insert({
            maintenance_request_id: request.id,
            actor_id: user.id,
            actor_role: "landlord",
            update_type: "photo_added",
            note: `Photo added: ${file.name}`,
          });

        if (updateError) {
          throw new Error(updateError.message);
        }
      }

      await createNotification({
        userId: request.tenant_id,
        title: "Maintenance photo added",
        message: `Your landlord added photos to "${request.title}".`,
        type: "maintenance_update",
        targetUrl: `/dashboard/tenant/maintenance/${request.id}`,
        dedupe: false,
      });

      setSelectedFiles([]);
      await loadRequest();
      showSuccess("Photo uploaded.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Photo upload failed.");
    }

    setSaving(false);
  }

  async function saveLandlordNote() {
    if (!request) return;

    if (!note.trim()) {
      showError("Please enter a note.");
      return;
    }

    setSaving(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      showError("Please log in again.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("maintenance_requests")
      .update({
        landlord_notes: note.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) {
      showError(error.message);
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("maintenance_request_updates")
      .insert({
        maintenance_request_id: request.id,
        actor_id: user.id,
        actor_role: "landlord",
        update_type: "landlord_message",
        note: note.trim(),
      });

    if (updateError) {
      showError(updateError.message);
      setSaving(false);
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

    await loadRequest();
    showSuccess("Note saved.");
    setSaving(false);
  }

  async function updateStatus(newStatus: MaintenanceRequest["status"]) {
    if (!request) return;

    const confirmed = window.confirm(
      `Update this request to ${formatStatus(newStatus)}?`
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      showError("Please log in again.");
      setSaving(false);
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
      status: newStatus,
      landlord_notes: note.trim() || request.landlord_notes,
      updated_at: now,
    };

    if (newStatus === "resolved") {
      updatePayload.resolved_at = now;
    }

    if (newStatus === "closed") {
      updatePayload.closed_at = now;
    }

    const { error } = await supabase
      .from("maintenance_requests")
      .update(updatePayload)
      .eq("id", request.id);

    if (error) {
      showError(error.message);
      setSaving(false);
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
        new_status: newStatus,
        note: note.trim() || `Status changed to ${formatStatus(newStatus)}.`,
      });

    if (timelineError) {
      showError(timelineError.message);
      setSaving(false);
      return;
    }

    await createNotification({
      userId: request.tenant_id,
      title: "Maintenance request updated",
      message: `"${request.title}" is now ${formatStatus(newStatus)}.`,
      type: "maintenance_update",
      targetUrl: `/dashboard/tenant/maintenance/${request.id}`,
      dedupe: false,
    });

    await loadRequest();
    showSuccess("Status updated.");
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-black sm:text-3xl">
            Loading request...
          </h1>
        </div>
      </main>
    );
  }

  if (!allowed || !request) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Request unavailable</h1>

          <p className="mt-3 text-slate-600">{message}</p>

          <Link
            href="/dashboard/landlord/maintenance"
            className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
          >
            Back to Maintenance
          </Link>
        </div>
      </main>
    );
  }

  const lease = getLease(request);
  const isActive = request.status === "open" || request.status === "in_progress";

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/dashboard/landlord/maintenance"
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Maintenance
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
          <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                  Landlord Maintenance Request
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight">
                  {request.title}
                </h1>

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

                {companyRole && (
                  <p className="mt-3 w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-black capitalize text-blue-700">
                    Company role: {companyRole}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                  {formatPriority(request.priority)}
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    request.status === "resolved" ||
                    request.status === "closed"
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

            <div className="mt-6 rounded-3xl bg-[#f7f4ef] p-5 sm:p-6">
              <h2 className="text-xl font-black">Issue Description</h2>
              <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">
                {request.description}
              </p>

              <p className="mt-4 text-sm font-bold text-slate-500">
                Submitted {new Date(request.created_at).toLocaleString()}
              </p>
            </div>

            <section className="mt-8">
              <h2 className="text-2xl font-black">Photos</h2>

              {photos.length > 0 ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {photos.map((photo) => (
                    <a
                      key={photo.id}
                      href={photo.signedUrl || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-3xl bg-[#f7f4ef] ring-1 ring-slate-200"
                    >
                      {photo.signedUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.signedUrl}
                          alt={photo.file_name || "Maintenance photo"}
                          className="h-64 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-64 items-center justify-center text-sm font-bold text-slate-500">
                          Photo unavailable
                        </div>
                      )}

                      <div className="p-4 text-sm font-bold text-slate-500">
                        {photo.file_name || "Maintenance photo"}
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-3xl bg-[#f7f4ef] p-8 text-center">
                  <h3 className="text-xl font-black">No photos yet</h3>
                  <p className="mt-2 text-slate-600">
                    Tenant or landlord photos will appear here.
                  </p>
                </div>
              )}
            </section>

            <section className="mt-8 rounded-3xl bg-[#f7f4ef] p-5 sm:p-6">
              <h2 className="text-2xl font-black">Add Photos</h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Upload up to 6 photos at a time.
              </p>

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => handleFiles(event.target.files)}
                className="mt-4 block w-full text-sm font-bold text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-slate-950 file:px-5 file:py-3 file:font-black file:text-white"
              />

              {selectedFiles.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {selectedFiles.map((file) => (
                    <div
                      key={`${file.name}-${file.size}`}
                      className="rounded-2xl bg-white p-4 text-sm font-bold text-slate-600"
                    >
                      {file.name}
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={uploadPhotos}
                disabled={saving || selectedFiles.length === 0}
                className="mt-5 rounded-full bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-60"
              >
                {saving ? "Uploading..." : "Upload Photos"}
              </button>
            </section>

            <section className="mt-8 rounded-3xl bg-[#f7f4ef] p-5 sm:p-6">
              <h2 className="text-2xl font-black">Landlord Note</h2>

              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={5}
                placeholder="Add an update for the tenant..."
                className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 leading-7 outline-none focus:border-slate-500"
              />

              <button
                type="button"
                onClick={saveLandlordNote}
                disabled={saving}
                className="mt-5 rounded-full bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Note"}
              </button>
            </section>
          </section>

          <aside className="grid gap-8 self-start">
            <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-2xl font-black">Status</h2>

              <p className="mt-4 text-4xl font-black">
                {formatStatus(request.status)}
              </p>

              <p className="mt-2 font-bold text-slate-500">
                Priority: {formatPriority(request.priority)}
              </p>

              <div className="mt-6 grid gap-3">
                {isActive && request.status !== "in_progress" && (
                  <button
                    type="button"
                    onClick={() => updateStatus("in_progress")}
                    disabled={saving}
                    className="rounded-full bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-60"
                  >
                    Mark In Progress
                  </button>
                )}

                {isActive && (
                  <button
                    type="button"
                    onClick={() => updateStatus("resolved")}
                    disabled={saving}
                    className="rounded-full bg-green-700 px-6 py-3 font-black text-white disabled:opacity-60"
                  >
                    Mark Resolved
                  </button>
                )}

                {request.status === "resolved" && (
                  <button
                    type="button"
                    onClick={() => updateStatus("closed")}
                    disabled={saving}
                    className="rounded-full bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-60"
                  >
                    Close Request
                  </button>
                )}

                {isActive && (
                  <button
                    type="button"
                    onClick={() => updateStatus("cancelled")}
                    disabled={saving}
                    className="rounded-full border border-red-200 bg-red-50 px-6 py-3 font-black text-red-700 disabled:opacity-60"
                  >
                    Cancel Request
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-2xl font-black">Timeline</h2>

              {updates.length > 0 ? (
                <div className="mt-5 space-y-4">
                  {updates.map((update) => (
                    <div
                      key={update.id}
                      className="rounded-2xl bg-[#f7f4ef] p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black">
                          {formatUpdateType(update.update_type)}
                        </p>

                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black uppercase text-slate-500">
                          {update.actor_role}
                        </span>
                      </div>

                      {update.old_status && update.new_status && (
                        <p className="mt-2 text-sm font-bold text-slate-600">
                          {formatStatus(update.old_status)} →{" "}
                          {formatStatus(update.new_status)}
                        </p>
                      )}

                      {update.note && (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {update.note}
                        </p>
                      )}

                      <p className="mt-3 text-xs font-bold text-slate-500">
                        {new Date(update.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-slate-600">
                  No timeline updates yet.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}