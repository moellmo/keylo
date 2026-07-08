import Link from "next/link";
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

export default async function PropertyApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: property } = await supabase
    .from("properties")
    .select("id, title, city, state")
    .eq("id", id)
    .single();

  const { data: applications, error } = await supabase
    .from("applications")
    .select("*")
    .eq("property_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <h1 className="text-4xl font-black">Applications</h1>
          <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-2xl font-black">Could not load applications</h2>
            <p className="mt-3 text-slate-600">{error.message}</p>
          </div>
        </div>
      </main>
    );
  }

  const listing = property as Property | null;
  const applicantList = (applications || []) as Application[];

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-10">
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

            <h1 className="mt-3 text-5xl font-black tracking-tight">
              Tenant Applicants
            </h1>

            {listing && (
              <p className="mt-3 text-lg font-bold text-slate-600">
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

        {applicantList.length > 0 ? (
          <div className="mt-8 grid gap-5">
            {applicantList.map((application) => (
              <div
                key={application.id}
                className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200"
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

                    <p className="mt-2 font-bold text-slate-500">
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
                  <div className="rounded-2xl bg-[#f7f4ef] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                      Monthly Income
                    </p>
                    <p className="mt-2 text-xl font-black">
                      {application.monthly_income
                        ? `$${application.monthly_income.toLocaleString()}`
                        : "Not provided"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#f7f4ef] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                      Move-In Date
                    </p>
                    <p className="mt-2 text-xl font-black">
                      {application.move_in_date || "Not provided"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#f7f4ef] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                      Household Size
                    </p>
                    <p className="mt-2 text-xl font-black">
                      {application.household_size || "Not provided"}
                    </p>
                  </div>
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

               <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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