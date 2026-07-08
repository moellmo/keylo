"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createNotification } from "@/lib/createNotification";
import StatusButton from "../../properties/[id]/applications/StatusButton";
import KeyloScoreCard from "@/components/KeyloScoreCard";

type PropertyForApplication = {
  id: string;
  title: string;
  monthly_rent: number;
  city: string;
  state: string;
  landlord_id: string | null;
  landlord_company_id: string | null;
};

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
  tenant_id: string;
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

  legal_first_name: string | null;
  legal_last_name: string | null;
  date_of_birth: string | null;

  current_street_address: string | null;
  current_city: string | null;
  current_state: string | null;
  current_zip_code: string | null;

  employment_status: string | null;
  employer_name: string | null;
  job_title: string | null;
  additional_income: number | null;
  desired_move_in_date: string | null;

  current_landlord_name: string | null;
  current_landlord_phone: string | null;
  current_landlord_email: string | null;

  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;

  tenant_profile_status: string | null;
  tenant_document_count: number | null;

  properties: PropertyForApplication | PropertyForApplication[] | null;
};

type TenantDocument = {
  id: string;
  tenant_id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  verification_status: string;
  created_at: string;
};

type CompanyMembership = {
  company_id: string;
  role: "owner" | "admin" | "manager" | "maintenance" | "accounting" | "viewer";
};

function canReviewApplications(role: string) {
  return role === "owner" || role === "admin" || role === "manager";
}

const documentLabels: Record<string, string> = {
  government_id: "Government ID",
  proof_of_income: "Proof of Income",
  rental_history: "Rental History",
  other: "Other Document",
};

function getProperty(application: ApplicationDetail) {
  if (Array.isArray(application.properties)) {
    return application.properties[0] || null;
  }

  return application.properties;
}

function formatScreeningStatus(status: string | null | undefined) {
  if (!status || status === "not_requested") return "Not Requested";
  if (status === "requested") return "Requested";
  if (status === "tenant_approved") return "Tenant Approved";
  if (status === "tenant_declined") return "Tenant Declined";
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

export default function ApplicationDetailPage() {
  const params = useParams();
  const applicationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [documents, setDocuments] = useState<TenantDocument[]>([]);
  const [screeningRequest, setScreeningRequest] =
    useState<ScreeningRequest | null>(null);
  const [screeningNote, setScreeningNote] = useState("");
  const [requestingScreening, setRequestingScreening] = useState(false);
  const [startingConversation, setStartingConversation] = useState(false);

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
      setMessage("Please log in as a landlord to view this application.");
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
      setAllowed(false);
      setLoading(false);
      return;
    }

    const app = data as unknown as ApplicationDetail;
    const property = getProperty(app);

    const isAdmin = profile?.role === "admin";
const isListingOwner =
  property?.landlord_id === user.id || app.landlord_id === user.id;

const companyId =
  app.landlord_company_id || property?.landlord_company_id || null;

let isCompanyReviewer = false;

if (!isAdmin && !isListingOwner && companyId) {
  const { data: membership, error: membershipError } = await supabase
    .from("landlord_company_members")
    .select("company_id, role")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) {
    setMessage(membershipError.message);
    setAllowed(false);
    setLoading(false);
    return;
  }

  const companyMembership = membership as CompanyMembership | null;

  isCompanyReviewer =
    !!companyMembership && canReviewApplications(companyMembership.role);
}

if (!isAdmin && !isListingOwner && !isCompanyReviewer) {
  setMessage("You do not have permission to view this application.");
  setAllowed(false);
  setLoading(false);
  return;
}

    const { data: documentRows, error: documentsError } = await supabase
      .from("tenant_documents")
      .select(
        `
        id,
        tenant_id,
        document_type,
        file_name,
        file_path,
        verification_status,
        created_at
      `
      )
      .eq("tenant_id", app.tenant_id)
      .order("created_at", { ascending: false });

    if (documentsError) {
      setMessage(documentsError.message);
      setAllowed(false);
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
      setAllowed(false);
      setLoading(false);
      return;
    }

    const latestScreening =
      screeningRows && screeningRows.length > 0
        ? ((screeningRows[0] as unknown) as ScreeningRequest)
        : null;

    setApplication(app);
    setDocuments((documentRows || []) as TenantDocument[]);
    setScreeningRequest(latestScreening);
    setScreeningNote(latestScreening?.landlord_note || "");
    setAllowed(true);
    setLoading(false);
  }

  async function openDocument(document: TenantDocument) {
    const { data, error } = await supabase.storage
      .from("tenant-documents")
      .createSignedUrl(document.file_path, 60 * 10);

    if (error) {
      setMessage(error.message);
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  async function startConversation() {
    if (!application) return;

    const property = getProperty(application);

    if (!property?.landlord_id) {
      setMessage("Could not find the landlord for this application.");
      return;
    }

    setStartingConversation(true);
    setMessage("");
    setSuccessMessage("");

    const { data: existingConversation, error: existingError } = await supabase
      .from("conversations")
      .select("id")
      .eq("application_id", application.id)
      .eq("tenant_id", application.tenant_id)
      .eq("landlord_id", property.landlord_id)
      .maybeSingle();

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

  async function requestScreening() {
    if (!application) return;

    const property = getProperty(application);

    if (!property?.landlord_id) {
      setMessage("Could not find landlord for this application.");
      return;
    }

    if (screeningRequest) {
      setMessage("A screening request already exists for this application.");
      return;
    }

    const confirmed = window.confirm(
      "Request tenant consent for credit/background screening?"
    );

    if (!confirmed) return;

    setRequestingScreening(true);
    setMessage("");
    setSuccessMessage("");

    const { data: newRequest, error } = await supabase
      .from("screening_requests")
      .insert({
  application_id: application.id,
  property_id: application.property_id,
  tenant_id: application.tenant_id,
  landlord_id: property.landlord_id,
  landlord_company_id:
    application.landlord_company_id || property.landlord_company_id || null,
  screening_type: "credit_background",
        status: "requested",
        provider: "manual_placeholder",
        landlord_note:
          screeningNote.trim() ||
          "Landlord requested tenant consent for screening.",
      })
      .select("*")
      .single();

    if (error) {
      setMessage(error.message);
      setRequestingScreening(false);
      return;
    }

    const createdRequest = newRequest as ScreeningRequest;

    const { error: appUpdateError } = await supabase
      .from("applications")
      .update({
        screening_status: "requested",
        latest_screening_request_id: createdRequest.id,
      })
      .eq("id", application.id);

    if (appUpdateError) {
      setMessage(appUpdateError.message);
      setRequestingScreening(false);
      return;
    }

    await createNotification({
      userId: application.tenant_id,
      title: "Screening request",
      message: `A landlord requested screening consent for ${
        property.title || "your rental application"
      }.`,
      type: "screening_request",
      targetUrl: `/dashboard/tenant/applications/${application.id}`,
      dedupe: false,
    });

    setScreeningRequest(createdRequest);
    setApplication({
      ...application,
      screening_status: "requested",
      latest_screening_request_id: createdRequest.id,
    });
    setSuccessMessage("Screening request sent to tenant.");
    setRequestingScreening(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading application...</h1>
        </div>
      </main>
    );
  }

  if (!allowed || !application) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Application unavailable</h1>

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

  const property = getProperty(application);

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link
          href={`/dashboard/landlord/properties/${application.property_id}/applications`}
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Applicants
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Keylo Instant Apply
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                {application.legal_first_name || application.first_name}{" "}
                {application.legal_last_name || application.last_name}
              </h1>

              <p className="mt-3 text-lg font-bold text-slate-600">
                {property?.title || "Rental Listing"} · {property?.city},{" "}
                {property?.state}
              </p>

              <p className="mt-2 text-sm font-bold text-slate-500">
                Submitted{" "}
                {new Date(application.created_at).toLocaleDateString()}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
                Application: {application.status}
              </span>

              <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
                Profile: {application.tenant_profile_status || "unknown"}
              </span>

              <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
                Docs: {documents.length}
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

          <section className="mt-8">
            <KeyloScoreCard userId={application.tenant_id} role="tenant" />
          </section>

          <section className="mt-8 rounded-3xl bg-[#f7f4ef] p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                  Screening
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Tenant Screening
                </h2>

                <p className="mt-3 leading-7 text-slate-600">
                  This is the placeholder flow for future TransUnion or other
                  screening provider integration. For now, landlords can request
                  tenant consent and track the status.
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

                {screeningRequest.tenant_consented_at && (
                  <div className="mt-5 rounded-2xl bg-green-50 p-4 text-green-800 ring-1 ring-green-200">
                    <p className="font-black">Tenant approved screening.</p>
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
                    <p className="font-black">Tenant declined screening.</p>
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
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">
                    Optional note to tenant
                  </span>

                  <textarea
                    value={screeningNote}
                    onChange={(event) => setScreeningNote(event.target.value)}
                    rows={4}
                    placeholder="Example: Please approve the screening request so we can continue reviewing your application."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 leading-7 outline-none focus:border-slate-500"
                  />
                </label>

                <button
                  type="button"
                  onClick={requestScreening}
                  disabled={requestingScreening}
                  className="mt-5 rounded-full bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-60"
                >
                  {requestingScreening
                    ? "Requesting..."
                    : "Request Screening Consent"}
                </button>
              </div>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black">Main Application</h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
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
                label="Additional Income"
                value={
                  application.additional_income
                    ? `$${application.additional_income.toLocaleString()}`
                    : "Not provided"
                }
              />

              <InfoCard
                label="Desired Move-In"
                value={
                  application.move_in_date ||
                  application.desired_move_in_date ||
                  "Not provided"
                }
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

              <InfoCard
                label="Date of Birth"
                value={application.date_of_birth || "Not provided"}
              />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black">Current Address</h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <InfoCard
                label="Street Address"
                value={application.current_street_address || "Not provided"}
              />

              <InfoCard
                label="City"
                value={application.current_city || "Not provided"}
              />

              <InfoCard
                label="State"
                value={application.current_state || "Not provided"}
              />

              <InfoCard
                label="ZIP Code"
                value={application.current_zip_code || "Not provided"}
              />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black">Employment</h2>

            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <InfoCard
                label="Employment Status"
                value={application.employment_status || "Not provided"}
              />

              <InfoCard
                label="Employer"
                value={application.employer_name || "Not provided"}
              />

              <InfoCard
                label="Job Title"
                value={application.job_title || "Not provided"}
              />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black">Current Landlord</h2>

            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <InfoCard
                label="Landlord Name"
                value={application.current_landlord_name || "Not provided"}
              />

              <InfoCard
                label="Landlord Phone"
                value={application.current_landlord_phone || "Not provided"}
              />

              <InfoCard
                label="Landlord Email"
                value={application.current_landlord_email || "Not provided"}
              />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black">Emergency Contact</h2>

            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <InfoCard
                label="Contact Name"
                value={application.emergency_contact_name || "Not provided"}
              />

              <InfoCard
                label="Contact Phone"
                value={application.emergency_contact_phone || "Not provided"}
              />

              <InfoCard
                label="Relationship"
                value={
                  application.emergency_contact_relationship || "Not provided"
                }
              />
            </div>
          </section>

          <section className="mt-8 rounded-3xl bg-[#f7f4ef] p-6">
            <h2 className="text-2xl font-black">Tenant Documents</h2>

            {documents.length > 0 ? (
              <div className="mt-5 divide-y divide-slate-200 rounded-3xl bg-white">
                {documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-black">
                          {documentLabels[document.document_type] ||
                            document.document_type}
                        </h3>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                          {document.verification_status}
                        </span>
                      </div>

                      <p className="mt-2 text-sm font-bold text-slate-500">
                        {document.file_name}
                      </p>

                      <p className="mt-1 text-sm font-bold text-slate-500">
                        Uploaded{" "}
                        {new Date(document.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => openDocument(document)}
                      className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
                    >
                      View Document
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 font-bold text-slate-600">
                No tenant documents have been uploaded yet.
              </p>
            )}
          </section>

          <section className="mt-8 rounded-3xl bg-[#f7f4ef] p-6">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
              Message to Landlord
            </p>

            <p className="mt-3 leading-8 text-slate-700">
              {application.message || "No message provided."}
            </p>
          </section>

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={startConversation}
              disabled={startingConversation}
              className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white disabled:opacity-60"
            >
              {startingConversation ? "Opening..." : "Message Tenant"}
            </button>

            <StatusButton
              applicationId={application.id}
              status="reviewing"
              label="Mark as Reviewing"
              variant="dark"
            />

            <StatusButton
              applicationId={application.id}
              status="approved"
              label="Approve"
            />

            {application.status === "approved" && (
              <Link
                href={`/dashboard/landlord/applications/${application.id}/create-lease`}
                className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
              >
                Create Lease
              </Link>
            )}

            <StatusButton
              applicationId={application.id}
              status="declined"
              label="Decline"
            />

            <Link
              href={`/listings/${application.property_id}`}
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
            >
              View Listing
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