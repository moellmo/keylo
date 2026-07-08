"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import StatusButton from "../../properties/[id]/applications/StatusButton";

type PropertyForApplication = {
  id: string;
  title: string;
  monthly_rent: number;
  city: string;
  state: string;
  landlord_id: string | null;
};

type ApplicationDetail = {
  id: string;
  property_id: string;
  tenant_id: string;

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

export default function ApplicationDetailPage() {
  const params = useParams();
  const applicationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [documents, setDocuments] = useState<TenantDocument[]>([]);

  useEffect(() => {
    async function loadApplication() {
      setLoading(true);

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
            landlord_id
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
      const isListingOwner = property?.landlord_id === user.id;

      if (!isAdmin && !isListingOwner) {
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

      setApplication(app);
      setDocuments((documentRows || []) as TenantDocument[]);
      setAllowed(true);
      setLoading(false);
    }

    loadApplication();
  }, [applicationId]);

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
            </div>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl bg-slate-100 px-5 py-4 font-bold text-red-700">
              {message}
            </div>
          )}

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

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row">
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