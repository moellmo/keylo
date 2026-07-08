"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ApplicationDetail = {
  id: string;
  property_id: string;
  tenant_id: string | null;
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
  properties: {
    id: string;
    title: string;
    monthly_rent: number;
    city: string;
    state: string;
  } | null;
};

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

export default function TenantApplicationDetailPage() {
  const params = useParams();
  const applicationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadApplication() {
      setLoading(true);

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
            state
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

      const app = data as ApplicationDetail;

      const isAdmin = profile?.role === "admin";
      const isOwner = app.tenant_id === user.id;

      if (!isAdmin && !isOwner) {
        setMessage("You do not have permission to view this application.");
        setLoading(false);
        return;
      }

      setApplication(app);
      setLoading(false);
    }

    loadApplication();
  }, [applicationId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading application...</h1>
        </div>
      </main>
    );
  }

  if (!application) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
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

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/dashboard/tenant"
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Tenant Dashboard
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Your Application
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                {application.properties?.title || "Rental Listing"}
              </h1>

              <p className="mt-3 text-lg font-bold text-slate-600">
                {application.properties
                  ? `${application.properties.city}, ${
                      application.properties.state
                    } · $${application.properties.monthly_rent.toLocaleString()}/mo`
                  : "Listing details unavailable"}
              </p>

              <p className="mt-2 text-sm font-bold text-slate-500">
                Submitted {new Date(application.created_at).toLocaleDateString()}
              </p>
            </div>

            <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
              {formatStatus(application.status)}
            </span>
          </div>

          <div
            className={`mt-6 rounded-2xl px-5 py-4 font-bold ring-1 ${statusBoxStyle(
              application.status
            )}`}
          >
            {statusMessage(application.status)}
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="rounded-3xl bg-[#f7f4ef] p-5">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                Applicant
              </p>

              <p className="mt-2 text-xl font-black">
                {application.first_name} {application.last_name}
              </p>
            </div>

            <div className="rounded-3xl bg-[#f7f4ef] p-5">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                Email
              </p>

              <p className="mt-2 break-words text-xl font-black">
                {application.email}
              </p>
            </div>

            <div className="rounded-3xl bg-[#f7f4ef] p-5">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                Phone
              </p>

              <p className="mt-2 text-xl font-black">
                {application.phone || "Not provided"}
              </p>
            </div>

            <div className="rounded-3xl bg-[#f7f4ef] p-5">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                Monthly Income
              </p>

              <p className="mt-2 text-xl font-black">
                {application.monthly_income
                  ? `$${application.monthly_income.toLocaleString()}`
                  : "Not provided"}
              </p>
            </div>

            <div className="rounded-3xl bg-[#f7f4ef] p-5">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                Desired Move-In
              </p>

              <p className="mt-2 text-xl font-black">
                {application.move_in_date || "Not provided"}
              </p>
            </div>

            <div className="rounded-3xl bg-[#f7f4ef] p-5">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                Household Size
              </p>

              <p className="mt-2 text-xl font-black">
                {application.household_size || "Not provided"}
              </p>
            </div>

            <div className="rounded-3xl bg-[#f7f4ef] p-5">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                Pets
              </p>

              <p className="mt-2 text-xl font-black">
                {application.pets || "Not provided"}
              </p>
            </div>

            <div className="rounded-3xl bg-[#f7f4ef] p-5">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                Status
              </p>

              <p className="mt-2 text-xl font-black">
                {formatStatus(application.status)}
              </p>
            </div>
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
            <Link
              href={`/listings/${application.property_id}`}
              className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
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