"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import StatusButton from "./StatusButton";

type Application = {
  id: string;
  property_id: string;
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
  screening_status: string | null;
  created_at: string;
};

type Property = {
  id: string;
  title: string;
  city: string;
  state: string;
  landlord_id: string;
  landlord_company_id: string | null;
};

type CompanyMembership = {
  company_id: string;
  role: "owner" | "admin" | "manager" | "maintenance" | "accounting" | "viewer";
};

function formatScreeningStatus(status: string | null) {
  if (!status || status === "not_requested") return "Screening: Not Requested";
  if (status === "requested") return "Screening: Requested";
  if (status === "tenant_approved") return "Screening: Tenant Approved";
  if (status === "tenant_declined") return "Screening: Tenant Declined";
  if (status === "in_progress") return "Screening: In Progress";
  if (status === "completed") return "Screening: Completed";
  if (status === "cancelled") return "Screening: Cancelled";
  if (status === "failed") return "Screening: Failed";

  return `Screening: ${status}`;
}

function screeningStatusClass(status: string | null) {
  if (status === "tenant_approved") return "bg-green-50 text-green-700";

  if (status === "tenant_declined" || status === "failed") {
    return "bg-red-50 text-red-700";
  }

  if (status === "requested" || status === "in_progress") {
    return "bg-yellow-50 text-yellow-700";
  }

  return "bg-slate-100 text-slate-600";
}

function canReviewApplications(role: string) {
  return role === "owner" || role === "admin" || role === "manager";
}

export default function PropertyApplicationsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [listing, setListing] = useState<Property | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadApplications();
  }, [id]);

  async function loadApplications() {
    setLoading(true);
    setAllowed(false);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please log in as a landlord.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      setMessage(profileError?.message || "Could not load your account.");
      setLoading(false);
      return;
    }

    if (profile.role !== "landlord" && profile.role !== "admin") {
      setMessage("You must be logged in as a landlord to view applications.");
      setLoading(false);
      return;
    }

    const { data: propertyRow, error: propertyError } = await supabase
      .from("properties")
      .select("id, title, city, state, landlord_id, landlord_company_id")
      .eq("id", id)
      .single();

    if (propertyError || !propertyRow) {
      setMessage(propertyError?.message || "Listing not found.");
      setLoading(false);
      return;
    }

    const property = propertyRow as Property;

    let hasAccess = profile.role === "admin" || property.landlord_id === user.id;

    if (!hasAccess && property.landlord_company_id) {
      const { data: membership, error: membershipError } = await supabase
        .from("landlord_company_members")
        .select("company_id, role")
        .eq("company_id", property.landlord_company_id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (membershipError) {
        setMessage(membershipError.message);
        setLoading(false);
        return;
      }

      const companyMembership = membership as CompanyMembership | null;

      hasAccess =
        !!companyMembership && canReviewApplications(companyMembership.role);
    }

    if (!hasAccess) {
      setMessage(
        "You do not have permission to view applications for this listing."
      );
      setLoading(false);
      return;
    }

    const { data: applicationRows, error: applicationsError } = await supabase
      .from("applications")
      .select("*")
      .eq("property_id", id)
      .order("created_at", { ascending: false });

    if (applicationsError) {
      setMessage(applicationsError.message);
      setLoading(false);
      return;
    }

    setListing(property);
    setApplications((applicationRows || []) as Application[]);
    setAllowed(true);
    setLoading(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-black sm:text-3xl">
            Loading applications...
          </h1>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <div className="rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <h1 className="text-3xl font-black">Applications unavailable</h1>
            <p className="mt-3 text-slate-600">{message}</p>

            <Link
              href="/dashboard/landlord"
              className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/dashboard/landlord"
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Landlord Dashboard
        </Link>

        <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Applications
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Tenant Applicants
            </h1>

            {listing && (
              <p className="mt-3 text-base font-bold text-slate-600 sm:text-lg">
                {listing.title} · {listing.city}, {listing.state}
              </p>
            )}
          </div>

          <Link
            href={`/listings/${id}`}
            className="rounded-full bg-slate-950 px-6 py-3 text-center font-black text-white"
          >
            View Listing
          </Link>
        </div>

        {message && (
          <div className="mt-6 rounded-2xl bg-white px-5 py-4 font-bold text-red-700 shadow-sm ring-1 ring-red-200">
            {message}
          </div>
        )}

        {applications.length > 0 ? (
          <div className="mt-8 grid gap-5">
            {applications.map((application) => (
              <div
                key={application.id}
                className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6"
              >
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-black">
                        {application.first_name} {application.last_name}
                      </h2>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                        {application.status}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${screeningStatusClass(
                          application.screening_status
                        )}`}
                      >
                        {formatScreeningStatus(application.screening_status)}
                      </span>
                    </div>

                    <p className="mt-2 break-words font-bold text-slate-500">
                      {application.email}
                      {application.phone ? ` · ${application.phone}` : ""}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#f7f4ef] px-5 py-4 text-sm font-bold text-slate-600">
                    Submitted{" "}
                    {new Date(application.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <InfoBox
                    title="Monthly Income"
                    value={
                      application.monthly_income
                        ? `$${application.monthly_income.toLocaleString()}`
                        : "Not provided"
                    }
                  />

                  <InfoBox
                    title="Move-In Date"
                    value={application.move_in_date || "Not provided"}
                  />

                  <InfoBox
                    title="Household Size"
                    value={
                      application.household_size
                        ? String(application.household_size)
                        : "Not provided"
                    }
                  />
                </div>

                <div className="mt-5 rounded-2xl bg-[#f7f4ef] p-5">
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                    Pets
                  </p>
                  <p className="mt-2 font-bold text-slate-700">
                    {application.pets || "Not provided"}
                  </p>
                </div>

                <div className="mt-5 rounded-2xl bg-[#f7f4ef] p-5">
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                    Message
                  </p>
                  <p className="mt-2 leading-7 text-slate-700">
                    {application.message || "No message provided."}
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href={`/dashboard/landlord/applications/${application.id}`}
                    className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
                  >
                    View Full Application
                  </Link>

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
                    status="reviewing"
                    label="Mark as Reviewing"
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
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <h2 className="text-2xl font-black">No applications yet</h2>
            <p className="mt-3 text-slate-600">
              When tenants apply, their applications will appear here.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function InfoBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f7f4ef] p-4">
      <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}