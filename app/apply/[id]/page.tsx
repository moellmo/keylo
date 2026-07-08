"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { createCompanyNotifications } from "@/lib/createCompanyNotifications";

type Property = {
  id: string;
  title: string;
  monthly_rent: number;
  city: string;
  state: string;
  bedrooms: string | null;
  bathrooms: string | null;
  status: string;
  landlord_id: string;
  landlord_company_id: string | null;
};

type BasicProfile = {
  email: string | null;
  full_name: string | null;
  phone: string | null;
};

type TenantProfile = {
  legal_first_name: string | null;
  legal_last_name: string | null;
  date_of_birth: string | null;
  phone: string | null;

  current_street_address: string | null;
  current_city: string | null;
  current_state: string | null;
  current_zip_code: string | null;

  employment_status: string | null;
  employer_name: string | null;
  job_title: string | null;
  monthly_income: number | null;
  additional_income: number | null;

  household_size: number | null;
  pets: string | null;
  desired_move_in_date: string | null;

  current_landlord_name: string | null;
  current_landlord_phone: string | null;
  current_landlord_email: string | null;

  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;

  profile_status: string | null;
};

export default function ApplyPage() {
  const params = useParams();
  const router = useRouter();

  const propertyId = String(params.id);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [userId, setUserId] = useState("");
  const [property, setProperty] = useState<Property | null>(null);
  const [basicProfile, setBasicProfile] = useState<BasicProfile | null>(null);
  const [tenantProfile, setTenantProfile] = useState<TenantProfile | null>(
    null
  );

  const [documentCount, setDocumentCount] = useState(0);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [moveInDate, setMoveInDate] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadApplicationPage() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Please log in as a tenant to apply.");
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("email, full_name, phone, role")
        .eq("id", user.id)
        .single();

      if (profileError) {
        setMessage(profileError.message);
        setLoading(false);
        return;
      }

      if (profileRow?.role !== "tenant" && profileRow?.role !== "admin") {
        setMessage("You must be logged in as a tenant to apply.");
        setLoading(false);
        return;
      }

      setBasicProfile({
        email: profileRow.email || user.email || "",
        full_name: profileRow.full_name || "",
        phone: profileRow.phone || "",
      });

      const { data: propertyRow, error: propertyError } = await supabase
        .from("properties")
        .select(
  "id, title, monthly_rent, city, state, bedrooms, bathrooms, status, landlord_id, landlord_company_id"
)
        .eq("id", propertyId)
        .eq("status", "published")
        .single();

      if (propertyError || !propertyRow) {
        setMessage("This listing is not available for applications.");
        setLoading(false);
        return;
      }

      setProperty(propertyRow as Property);

      const { data: tenantProfileRow, error: tenantProfileError } =
        await supabase
          .from("tenant_profiles")
          .select("*")
          .eq("tenant_id", user.id)
          .maybeSingle();

      if (tenantProfileError) {
        setMessage(tenantProfileError.message);
        setLoading(false);
        return;
      }

      setTenantProfile((tenantProfileRow || null) as TenantProfile | null);

      if (tenantProfileRow?.desired_move_in_date) {
        setMoveInDate(tenantProfileRow.desired_move_in_date);
      }

      const { count: docsCount, error: docsError } = await supabase
        .from("tenant_documents")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", user.id);

      if (docsError) {
        setMessage(docsError.message);
        setLoading(false);
        return;
      }

      setDocumentCount(docsCount || 0);

      const { data: existingApplication, error: existingError } =
        await supabase
          .from("applications")
          .select("id")
          .eq("tenant_id", user.id)
          .eq("property_id", propertyId)
          .maybeSingle();

      if (existingError) {
        setMessage(existingError.message);
        setLoading(false);
        return;
      }

      setAlreadyApplied(!!existingApplication);
      setLoading(false);
    }

    loadApplicationPage();
  }, [propertyId]);

  function profileIsComplete() {
    if (!tenantProfile) return false;

    return (
      !!tenantProfile.legal_first_name &&
      !!tenantProfile.legal_last_name &&
      !!tenantProfile.date_of_birth &&
      !!tenantProfile.phone &&
      !!tenantProfile.current_street_address &&
      !!tenantProfile.current_city &&
      !!tenantProfile.current_state &&
      !!tenantProfile.current_zip_code &&
      !!tenantProfile.employment_status &&
      !!tenantProfile.monthly_income &&
      !!tenantProfile.household_size
    );
  }

  async function submitApplication() {
    if (!userId || !property || !tenantProfile || !basicProfile) {
      setMessage("Missing application information.");
      return;
    }

    if (!profileIsComplete()) {
      setMessage("Please complete your Instant Apply profile before applying.");
      return;
    }

    if (alreadyApplied) {
      setMessage("You already applied to this listing.");
      return;
    }

    setSubmitting(true);
    setMessage("");

   const { data: newApplication, error } = await supabase
  .from("applications")
.insert({
  property_id: property.id,
  tenant_id: userId,
  landlord_id: property.landlord_id,
  landlord_company_id: property.landlord_company_id,

      first_name: tenantProfile.legal_first_name,
      last_name: tenantProfile.legal_last_name,
      email: basicProfile.email,
      phone: tenantProfile.phone,

      monthly_income: tenantProfile.monthly_income,
      household_size: tenantProfile.household_size,
      pets: tenantProfile.pets,
      move_in_date: moveInDate || tenantProfile.desired_move_in_date || null,

      legal_first_name: tenantProfile.legal_first_name,
      legal_last_name: tenantProfile.legal_last_name,
      date_of_birth: tenantProfile.date_of_birth,

      current_street_address: tenantProfile.current_street_address,
      current_city: tenantProfile.current_city,
      current_state: tenantProfile.current_state,
      current_zip_code: tenantProfile.current_zip_code,

      employment_status: tenantProfile.employment_status,
      employer_name: tenantProfile.employer_name,
      job_title: tenantProfile.job_title,
      additional_income: tenantProfile.additional_income,

      desired_move_in_date:
        moveInDate || tenantProfile.desired_move_in_date || null,

      current_landlord_name: tenantProfile.current_landlord_name,
      current_landlord_phone: tenantProfile.current_landlord_phone,
      current_landlord_email: tenantProfile.current_landlord_email,

      emergency_contact_name: tenantProfile.emergency_contact_name,
      emergency_contact_phone: tenantProfile.emergency_contact_phone,
      emergency_contact_relationship:
        tenantProfile.emergency_contact_relationship,

      tenant_profile_status: tenantProfile.profile_status || "incomplete",
      tenant_document_count: documentCount,

           status: "submitted",
    })
    .select("id")
    .single();

    if (error) {
  setMessage(error.message);
  setSubmitting(false);
  return;
}

if (!newApplication?.id) {
  setMessage("Application was submitted, but the confirmation could not be loaded.");
  setSubmitting(false);
  return;
}

await createCompanyNotifications({
  companyId: property.landlord_company_id,
  fallbackUserId: property.landlord_id,
  roles: ["owner", "admin", "manager"],
  title: "New application received",
  message: `${
    tenantProfile.legal_first_name || "A tenant"
  } applied for ${property.title}.`,
  type: "application_submitted",
  targetUrl: `/dashboard/landlord/applications/${newApplication.id}`,
  dedupe: true,
});

router.push("/dashboard/tenant");
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

  if (!property) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Application unavailable</h1>

          <p className="mt-3 text-slate-600">
            {message || "This rental is not available for applications."}
          </p>

          <Link
            href="/listings"
            className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
          >
            Browse Rentals
          </Link>
        </div>
      </main>
    );
  }

  const complete = profileIsComplete();

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link href={`/listings/${property.id}`} className="text-sm font-bold text-slate-600">
          ← Back to Listing
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Keylo Instant Apply
          </p>

          <h1 className="mt-3 text-5xl font-black tracking-tight">
            Apply to {property.title}
          </h1>

          <p className="mt-4 text-lg leading-8 text-slate-600">
            {property.city}, {property.state} · $
            {property.monthly_rent.toLocaleString()}/mo
          </p>

          {message && (
            <div className="mt-6 rounded-2xl bg-slate-100 px-5 py-4 font-bold text-slate-800">
              {message}
            </div>
          )}

          {alreadyApplied && (
            <div className="mt-6 rounded-2xl bg-amber-50 px-5 py-4 font-bold text-amber-800">
              You already applied to this listing.
            </div>
          )}

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <div className="rounded-3xl bg-[#f7f4ef] p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Profile
              </p>

              <p className="mt-3 text-2xl font-black">
                {complete ? "Complete" : "Incomplete"}
              </p>

              {!complete && (
                <Link
  href={`/dashboard/tenant/profile?returnTo=/apply/${property.id}`}
  className="mt-4 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
>
  Complete Profile
</Link>
              )}
            </div>

            <div className="rounded-3xl bg-[#f7f4ef] p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Documents
              </p>

              <p className="mt-3 text-2xl font-black">
                {documentCount} Uploaded
              </p>

              <Link
  href={`/dashboard/tenant/documents?returnTo=/apply/${property.id}`}
  className="mt-4 inline-flex rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black"
>
  Manage Documents
</Link>
            </div>

            <div className="rounded-3xl bg-[#f7f4ef] p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Application
              </p>

              <p className="mt-3 text-2xl font-black">
                {alreadyApplied ? "Submitted" : "Ready"}
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-200 p-6">
            <h2 className="text-2xl font-black">Application Snapshot</h2>

            {tenantProfile ? (
              <div className="mt-5 grid gap-4 text-sm font-bold text-slate-600 md:grid-cols-2">
                <p>
                  Name: {tenantProfile.legal_first_name}{" "}
                  {tenantProfile.legal_last_name}
                </p>

                <p>Email: {basicProfile?.email || "Not provided"}</p>

                <p>Phone: {tenantProfile.phone || "Not provided"}</p>

                <p>
                  Monthly Income:{" "}
                  {tenantProfile.monthly_income
                    ? `$${tenantProfile.monthly_income.toLocaleString()}`
                    : "Not provided"}
                </p>

                <p>
                  Household Size:{" "}
                  {tenantProfile.household_size || "Not provided"}
                </p>

                <p>Pets: {tenantProfile.pets || "Not provided"}</p>

                <p>
                  Employment:{" "}
                  {tenantProfile.employment_status || "Not provided"}
                </p>

                <p>
                  Current Address:{" "}
                  {tenantProfile.current_city && tenantProfile.current_state
                    ? `${tenantProfile.current_city}, ${tenantProfile.current_state}`
                    : "Not provided"}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-slate-600">
                You need to complete your tenant profile before applying.
              </p>
            )}
          </div>

          <div className="mt-8">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">
                Desired Move-in Date
              </span>

              <input
                type="date"
                value={moveInDate}
                onChange={(event) => setMoveInDate(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={submitApplication}
            disabled={submitting || alreadyApplied || !complete}
            className="mt-8 w-full rounded-full bg-slate-950 px-6 py-4 font-black text-white disabled:opacity-60"
          >
            {submitting
              ? "Submitting..."
              : alreadyApplied
              ? "Already Applied"
              : complete
              ? "Submit Instant Application"
              : "Complete Profile to Apply"}
          </button>
        </div>
      </div>
    </main>
  );
}