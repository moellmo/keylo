"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createCompanyNotifications } from "@/lib/createCompanyNotifications";

type ScreeningStatus =
  | "not_requested"
  | "requested"
  | "tenant_approved"
  | "tenant_declined"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "failed";

type ScreeningRequest = {
  id: string;
  application_id: string;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  landlord_company_id: string | null;
  screening_type:
    | "credit"
    | "background"
    | "credit_background"
    | "income_verification"
    | "custom";
  status:
    | "requested"
    | "tenant_approved"
    | "tenant_declined"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "failed";
  provider: string | null;
  landlord_note: string | null;
  tenant_consent_text: string | null;
  tenant_consented_at: string | null;
  tenant_declined_at: string | null;
  requested_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ApplicationDetail = {
  id: string;
  property_id: string;
  tenant_id: string | null;
  landlord_id: string | null;
  landlord_company_id: string | null;

  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  monthly_income: number | null;
  move_in_date: string | null;
  household_size: number | null;
  pets: string | null;
  message: string | null;
  status: string;
  created_at: string;

  screening_status: ScreeningStatus | null;
  latest_screening_request_id: string | null;

  properties:
    | {
        id: string;
        title: string;
        monthly_rent: number;
        city: string;
        state: string;
        landlord_id: string | null;
        landlord_company_id: string | null;
      }
    | {
        id: string;
        title: string;
        monthly_rent: number;
        city: string;
        state: string;
        landlord_id: string | null;
        landlord_company_id: string | null;
      }[]
    | null;
};

function getProperty(application: ApplicationDetail) {
  if (Array.isArray(application.properties)) {
    return application.properties[0] || null;
  }

  return application.properties;
}

function formatStatus(status: string) {
  if (status === "submitted") return "Submitted";
  if (status === "reviewing") return "Under Review";
  if (status === "approved") return "Approved";
  if (status === "declined") return "Declined";

  return status;
}

function statusMessage(status: string) {
  if (status === "submitted") {
    return "Your application was submitted successfully.";
  }

  if (status === "reviewing") {
    return "The landlord is reviewing your application.";
  }

  if (status === "approved") {
    return "Good news — your application was approved. The landlord may send a lease next.";
  }

  if (status === "declined") {
    return "This application was declined.";
  }

  return "Your application status was updated.";
}

function statusBoxStyle(status: string) {
  if (status === "approved") {
    return "bg-green-50 text-green-800 ring-green-200";
  }

  if (status === "declined") {
    return "bg-red-50 text-red-800 ring-red-200";
  }

  if (status === "reviewing") {
    return "bg-blue-50 text-blue-800 ring-blue-200";
  }

  return "bg-[#f7f4ef] text-slate-700 ring-slate-200";
}

function formatScreeningStatus(status: string | null | undefined) {
  if (!status || status === "not_requested") return "Not Requested";
  if (status === "requested") return "Consent Requested";
  if (status === "tenant_approved") return "Approved by Tenant";
  if (status === "tenant_declined") return "Declined by Tenant";
  if (status === "in_progress") return "In Progress";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "failed") return "Failed";

  return status;
}

function formatScreeningType(type: string | null | undefined) {
  if (!type) return "Credit & Background";
  if (type === "credit") return "Credit Check";
  if (type === "background") return "Background Check";
  if (type === "credit_background") return "Credit & Background";
  if (type === "income_verification") return "Income Verification";
  if (type === "custom") return "Custom Screening";

  return type;
}

export default function TenantApplicationDetailPage() {
  const params = useParams();
  const applicationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [screeningRequest, setScreeningRequest] =
    useState<ScreeningRequest | null>(null);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [startingConversation, setStartingConversation] = useState(false);
  const [savingScreening, setSavingScreening] = useState(false);

  useEffect(() => {
    loadApplication();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  async function loadApplication() {
    setLoading(true);
    setMessage("");
    setSuccessMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please log in to view this application.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const { data, error } = await supabase
      .from("applications")
      .select(
        `
        *,
        properties (
          id,
          title,
          monthly_rent,
          city,
          state,
          landlord_id,
          landlord_company_id
        )
      `
      )
      .eq("id", applicationId)
      .single();

    if (error || !data) {
      setMessage("Application not found.");
      setLoading(false);
      return;
    }

    const app = data as unknown as ApplicationDetail;

    const isAdmin = profile?.role === "admin";
    const isOwner = app.tenant_id === user.id;

    if (!isAdmin && !isOwner) {
      setMessage("You do not have permission to view this application.");
      setLoading(false);
      return;
    }

    const { data: screeningRows, error: screeningError } = await supabase
      .from("screening_requests")
      .select("*")
      .eq("application_id", app.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (screeningError) {
      setMessage(screeningError.message);
      setLoading(false);
      return;
    }

    const latestScreening =
      screeningRows && screeningRows.length > 0
        ? ((screeningRows[0] as unknown) as ScreeningRequest)
        : null;

    setApplication(app);
    setScreeningRequest(latestScreening);
    setLoading(false);
  }

  async function startConversation() {
  if (!application) return;

  const property = getProperty(application);

  if (!application.tenant_id) {
    setMessage("Could not find the tenant for this application.");
    return;
  }

  if (!property?.landlord_id) {
    setMessage("Could not find the landlord for this application.");
    return;
  }

  setStartingConversation(true);
  setMessage("");
  setSuccessMessage("");

  const conversationCompanyId =
    application.landlord_company_id || property.landlord_company_id || null;

  let existingConversationQuery = supabase
    .from("conversations")
    .select("id")
    .eq("application_id", application.id)
    .eq("tenant_id", application.tenant_id)
    .eq("landlord_id", property.landlord_id);

  if (conversationCompanyId) {
    existingConversationQuery = existingConversationQuery.eq(
      "landlord_company_id",
      conversationCompanyId
    );
  }

  const { data: existingConversation, error: existingError } =
    await existingConversationQuery.maybeSingle();

  if (existingError) {
    setMessage(existingError.message);
    setStartingConversation(false);
    return;
  }

  if (existingConversation?.id) {
    window.location.href = `/dashboard/messages/${existingConversation.id}`;
    return;
  }

  const { data: newConversation, error } = await supabase
    .from("conversations")
    .insert({
      application_id: application.id,
      property_id: application.property_id,
      tenant_id: application.tenant_id,
      landlord_id: property.landlord_id,
      landlord_company_id: conversationCompanyId,
      subject: property.title
        ? `Application for ${property.title}`
        : "Rental application conversation",
      last_message: null,
      last_message_at: null,
    })
    .select("id")
    .single();

  if (error) {
    setMessage(error.message);
    setStartingConversation(false);
    return;
  }

  window.location.href = `/dashboard/messages/${newConversation.id}`;
}

  async function approveScreening() {
    if (!application || !screeningRequest) return;

    const property = getProperty(application);

    const confirmed = window.confirm(
      "Approve this screening request? This is currently a placeholder consent flow. Later this can connect to TransUnion or another provider."
    );

    if (!confirmed) return;

    setSavingScreening(true);
    setMessage("");
    setSuccessMessage("");

    const consentText =
      "Tenant approved the landlord's request for rental screening through Keylo. This is currently a placeholder consent record and does not yet run a live TransUnion report.";

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("screening_requests")
      .update({
        status: "tenant_approved",
        tenant_consent_text: consentText,
        tenant_consented_at: now,
        updated_at: now,
      })
      .eq("id", screeningRequest.id);

    if (error) {
      setMessage(error.message);
      setSavingScreening(false);
      return;
    }

    const { error: appError } = await supabase
      .from("applications")
      .update({
        screening_status: "tenant_approved",
        latest_screening_request_id: screeningRequest.id,
      })
      .eq("id", application.id);

    if (appError) {
      setMessage(appError.message);
      setSavingScreening(false);
      return;
    }

    await createCompanyNotifications({
      companyId:
        application.landlord_company_id ||
        property?.landlord_company_id ||
        screeningRequest.landlord_company_id,
      fallbackUserId: application.landlord_id || property?.landlord_id,
      roles: ["owner", "admin", "manager"],
      title: "Screening approved",
      message: `${application.first_name} ${application.last_name} approved the screening request.`,
      type: "screening_update",
      targetUrl: `/dashboard/landlord/applications/${application.id}`,
      dedupe: false,
    });

    setScreeningRequest({
      ...screeningRequest,
      status: "tenant_approved",
      tenant_consent_text: consentText,
      tenant_consented_at: now,
      updated_at: now,
    });

    setApplication({
      ...application,
      screening_status: "tenant_approved",
      latest_screening_request_id: screeningRequest.id,
    });

    setSuccessMessage("Screening consent approved.");
    setSavingScreening(false);
  }

  async function declineScreening() {
    if (!application || !screeningRequest) return;

    const property = getProperty(application);

    const confirmed = window.confirm("Decline this screening request?");
    if (!confirmed) return;

    setSavingScreening(true);
    setMessage("");
    setSuccessMessage("");

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("screening_requests")
      .update({
        status: "tenant_declined",
        tenant_declined_at: now,
        updated_at: now,
      })
      .eq("id", screeningRequest.id);

    if (error) {
      setMessage(error.message);
      setSavingScreening(false);
      return;
    }

    const { error: appError } = await supabase
      .from("applications")
      .update({
        screening_status: "tenant_declined",
        latest_screening_request_id: screeningRequest.id,
      })
      .eq("id", application.id);

    if (appError) {
      setMessage(appError.message);
      setSavingScreening(false);
      return;
    }

    await createCompanyNotifications({
      companyId:
        application.landlord_company_id ||
        property?.landlord_company_id ||
        screeningRequest.landlord_company_id,
      fallbackUserId: application.landlord_id || property?.landlord_id,
      roles: ["owner", "admin", "manager"],
      title: "Screening declined",
      message: `${application.first_name} ${application.last_name} declined the screening request.`,
      type: "screening_update",
      targetUrl: `/dashboard/landlord/applications/${application.id}`,
      dedupe: false,
    });

    setScreeningRequest({
      ...screeningRequest,
      status: "tenant_declined",
      tenant_declined_at: now,
      updated_at: now,
    });

    setApplication({
      ...application,
      screening_status: "tenant_declined",
      latest_screening_request_id: screeningRequest.id,
    });

    setSuccessMessage("Screening request declined.");
    setSavingScreening(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-black sm:text-3xl">
            Loading application...
          </h1>
        </div>
      </main>
    );
  }

  if (!application) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Application unavailable</h1>

          <p className="mt-3 text-slate-600">{message}</p>

          <Link
            href="/dashboard/tenant"
            className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
          >
            Back to Tenant Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const property = getProperty(application);

  const canRespondToScreening =
    screeningRequest?.status === "requested" ||
    screeningRequest?.status === "in_progress";

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/dashboard/tenant"
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Tenant Dashboard
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Your Application
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                {property?.title || "Rental Listing"}
              </h1>

              <p className="mt-3 text-lg font-bold text-slate-600">
                {property
                  ? `${property.city}, ${
                      property.state
                    } · $${property.monthly_rent.toLocaleString()}/mo`
                  : "Listing details unavailable"}
              </p>

              <p className="mt-2 text-sm font-bold text-slate-500">
                Submitted{" "}
                {new Date(application.created_at).toLocaleDateString()}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
                {formatStatus(application.status)}
              </span>

              <span className="w-fit rounded-full bg-yellow-50 px-4 py-2 text-sm font-black text-yellow-700">
                Screening:{" "}
                {formatScreeningStatus(
                  screeningRequest?.status || application.screening_status
                )}
              </span>
            </div>
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

          <div
            className={`mt-6 rounded-2xl px-5 py-4 font-bold ring-1 ${statusBoxStyle(
              application.status
            )}`}
          >
            {statusMessage(application.status)}
          </div>

          <section className="mt-8 rounded-3xl bg-[#f7f4ef] p-5 sm:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                  Screening
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Rental Screening Consent
                </h2>

                <p className="mt-3 leading-7 text-slate-600">
                  This is the placeholder consent flow for future TransUnion or
                  other screening provider integration. No live credit or
                  background report is being pulled yet.
                </p>
              </div>

              <span className="w-fit rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700">
                {formatScreeningStatus(
                  screeningRequest?.status || application.screening_status
                )}
              </span>
            </div>

            {screeningRequest ? (
              <div className="mt-5 rounded-3xl bg-white p-5">
                <div className="grid gap-5 md:grid-cols-3">
                  <InfoCard
                    label="Type"
                    value={formatScreeningType(
                      screeningRequest.screening_type
                    )}
                  />

                  <InfoCard
                    label="Provider"
                    value={screeningRequest.provider || "Manual placeholder"}
                  />

                  <InfoCard
                    label="Requested"
                    value={new Date(
                      screeningRequest.requested_at
                    ).toLocaleDateString()}
                  />
                </div>

                {screeningRequest.landlord_note && (
                  <div className="mt-5 rounded-2xl bg-[#f7f4ef] p-4">
                    <p className="text-sm font-black text-slate-500">
                      Landlord Note
                    </p>
                    <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-700">
                      {screeningRequest.landlord_note}
                    </p>
                  </div>
                )}

                {canRespondToScreening && (
                  <div className="mt-5 rounded-2xl bg-yellow-50 p-5 ring-1 ring-yellow-200">
                    <h3 className="text-xl font-black text-yellow-900">
                      Consent Requested
                    </h3>

                    <p className="mt-3 leading-7 text-yellow-900">
                      By approving, you are giving consent in Keylo for the
                      landlord to continue with the screening process. This does
                      not yet run a live TransUnion report.
                    </p>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={approveScreening}
                        disabled={savingScreening}
                        className="rounded-full bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-60"
                      >
                        {savingScreening
                          ? "Saving..."
                          : "Approve Screening"}
                      </button>

                      <button
                        type="button"
                        onClick={declineScreening}
                        disabled={savingScreening}
                        className="rounded-full border border-red-200 bg-red-50 px-6 py-3 font-black text-red-700 disabled:opacity-60"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                )}

                {screeningRequest.tenant_consented_at && (
                  <div className="mt-5 rounded-2xl bg-green-50 p-4 text-green-800 ring-1 ring-green-200">
                    <p className="font-black">You approved screening.</p>
                    <p className="mt-1 text-sm font-bold">
                      Approved{" "}
                      {new Date(
                        screeningRequest.tenant_consented_at
                      ).toLocaleString()}
                    </p>
                  </div>
                )}

                {screeningRequest.tenant_declined_at && (
                  <div className="mt-5 rounded-2xl bg-red-50 p-4 text-red-800 ring-1 ring-red-200">
                    <p className="font-black">You declined screening.</p>
                    <p className="mt-1 text-sm font-bold">
                      Declined{" "}
                      {new Date(
                        screeningRequest.tenant_declined_at
                      ).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-3xl bg-white p-5">
                <p className="font-bold text-slate-600">
                  No screening has been requested for this application yet.
                </p>
              </div>
            )}
          </section>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <InfoCard
              label="Applicant"
              value={`${application.first_name} ${application.last_name}`}
            />

            <InfoCard label="Email" value={application.email} />

            <InfoCard
              label="Phone"
              value={application.phone || "Not provided"}
            />

            <InfoCard
              label="Monthly Income"
              value={
                application.monthly_income
                  ? `$${application.monthly_income.toLocaleString()}`
                  : "Not provided"
              }
            />

            <InfoCard
              label="Desired Move-In"
              value={application.move_in_date || "Not provided"}
            />

            <InfoCard
              label="Household Size"
              value={
                application.household_size
                  ? String(application.household_size)
                  : "Not provided"
              }
            />

            <InfoCard
              label="Pets"
              value={application.pets || "Not provided"}
            />

            <InfoCard label="Status" value={formatStatus(application.status)} />
          </div>

          <div className="mt-6 rounded-3xl bg-[#f7f4ef] p-6">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
              Message to Landlord
            </p>

            <p className="mt-3 leading-8 text-slate-700">
              {application.message || "No message provided."}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row">
            <button
              type="button"
              onClick={startConversation}
              disabled={startingConversation}
              className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white disabled:opacity-60"
            >
              {startingConversation ? "Opening..." : "Message Landlord"}
            </button>

            <Link
              href={`/listings/${application.property_id}`}
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
            >
              View Listing
            </Link>

            <Link
              href="/dashboard/tenant"
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
            >
              Back to Dashboard
            </Link>
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