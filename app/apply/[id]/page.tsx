"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ApplyPage() {
  const params = useParams();
  const propertyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    monthly_income: "",
    move_in_date: "",
    household_size: "",
    pets: "",
    message: "",
  });

  useEffect(() => {
  async function checkTenant() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setAllowed(false);
      setMessage("Please log in as a tenant before applying.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, email, full_name, phone, monthly_income, household_size, pets")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "tenant" && profile?.role !== "admin") {
      setAllowed(false);
      setMessage("Only tenant accounts can apply to rental listings.");
      setLoading(false);
      return;
    }

    const savedFullName =
      profile?.full_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      "";

    const savedEmail = profile?.email || user.email || "";

    const nameParts = savedFullName.trim().split(" ").filter(Boolean);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    setForm((current) => ({
  ...current,
  first_name: current.first_name || firstName,
  last_name: current.last_name || lastName,
  email: current.email || savedEmail,
  phone: current.phone || profile?.phone || "",
  monthly_income:
    current.monthly_income ||
    (profile?.monthly_income ? String(profile.monthly_income) : ""),
  household_size:
    current.household_size ||
    (profile?.household_size ? String(profile.household_size) : ""),
  pets: current.pets || profile?.pets || "",
}));

    setAllowed(true);
    setLoading(false);
  }

  checkTenant();
}, []);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submitApplication() {
    setSaving(true);
    setMessage("");

    if (!form.first_name || !form.last_name || !form.email) {
      setMessage("Please fill in first name, last name, and email.");
      setSaving(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please log in as a tenant before applying.");
      setSaving(false);
      return;
    }
const { data: applicationData, error } = await supabase
  .from("applications")
  .insert({
    property_id: propertyId,
    tenant_id: user.id,
    first_name: form.first_name,
    last_name: form.last_name,
    email: form.email,
    phone: form.phone,
    monthly_income: form.monthly_income ? Number(form.monthly_income) : null,
    move_in_date: form.move_in_date || null,
    household_size: form.household_size ? Number(form.household_size) : null,
    pets: form.pets,
    message: form.message,
    status: "submitted",
  })
  .select("id")
  .single();

    if (error) {
      if (
        error.message.includes("duplicate") ||
        error.message.includes("unique")
      ) {
        setMessage(
          "You already applied to this listing. You can track it in your tenant dashboard."
        );
      } else {
        setMessage(`Error submitting application: ${error.message}`);
      }

      setSaving(false);
      return;
    }

    if (applicationData?.id) {
  await fetch("/api/email/new-application", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      applicationId: applicationData.id,
    }),
  });
}

    setMessage("Application submitted successfully.");
    setSaving(false);

    window.location.href = "/dashboard/tenant";
    return;
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

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <Link href={`/listings/${propertyId}`} className="text-sm font-bold text-slate-600">
            ← Back to Listing
          </Link>

          <div className="mt-6 rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <h1 className="text-3xl font-black">Login Required</h1>

            <p className="mt-3 text-slate-600">{message}</p>

            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/auth/login"
                className="rounded-full bg-slate-950 px-6 py-3 font-black text-white"
              >
                Login
              </Link>

              <Link
                href="/auth/signup"
                className="rounded-full border border-slate-300 bg-white px-6 py-3 font-black"
              >
                Create Tenant Account
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link href={`/listings/${propertyId}`} className="text-sm font-bold text-slate-600">
          ← Back to Listing
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 pb-6">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Tenant Application
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
              Apply for this rental
            </h1>

            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              Submit your basic rental application details. Later this will become
              Keylo Instant Apply with tenant profiles, document uploads, and screening.
            </p>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl bg-slate-100 px-5 py-4 font-bold text-slate-800">
              {message}
            </div>
          )}

          <form className="mt-8 space-y-8">
            <section>
              <h2 className="text-2xl font-black">Applicant information</h2>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-black">
                    First name *
                  </label>
                  <input
                    value={form.first_name}
                    onChange={(e) => updateField("first_name", e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                    placeholder="First name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    Last name *
                  </label>
                  <input
                    value={form.last_name}
                    onChange={(e) => updateField("last_name", e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                    placeholder="Last name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    Email *
                  </label>
                  <input
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    type="email"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    Phone
                  </label>
                  <input
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                    placeholder="Phone number"
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-black">Rental details</h2>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-black">
                    Monthly income
                  </label>
                  <input
                    value={form.monthly_income}
                    onChange={(e) => updateField("monthly_income", e.target.value)}
                    type="number"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                    placeholder="Example: 8500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    Desired move-in date
                  </label>
                  <input
                    value={form.move_in_date}
                    onChange={(e) => updateField("move_in_date", e.target.value)}
                    type="date"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    Household size
                  </label>
                  <input
                    value={form.household_size}
                    onChange={(e) => updateField("household_size", e.target.value)}
                    type="number"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                    placeholder="Example: 4"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    Pets
                  </label>
                  <input
                    value={form.pets}
                    onChange={(e) => updateField("pets", e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                    placeholder="No pets / 1 small dog / cat, etc."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-black">
                    Message to landlord
                  </label>
                  <textarea
                    value={form.message}
                    onChange={(e) => updateField("message", e.target.value)}
                    rows={5}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                    placeholder="Tell the landlord anything helpful about your application."
                  />
                </div>
              </div>
            </section>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
              <Link
                href={`/listings/${propertyId}`}
                className="rounded-full border border-slate-300 bg-white px-6 py-3 text-center font-black"
              >
                Cancel
              </Link>

              <button
                type="button"
                onClick={submitApplication}
                disabled={saving}
                className="rounded-full bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-60"
              >
                {saving ? "Submitting..." : "Submit Application"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}