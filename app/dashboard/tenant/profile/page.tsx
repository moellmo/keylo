"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function TenantProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    monthly_income: "",
    household_size: "",
    pets: "",
  });

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Please log in to edit your profile.");
        setLoading(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, full_name, email, phone, monthly_income, household_size, pets")
        .eq("id", user.id)
        .single();

      if (error || !profile) {
        setMessage("Could not load your profile.");
        setLoading(false);
        return;
      }

      if (profile.role !== "tenant" && profile.role !== "admin") {
        setMessage("Only tenant accounts can edit a tenant profile.");
        setLoading(false);
        return;
      }

      setForm({
        full_name: profile.full_name || "",
        email: profile.email || user.email || "",
        phone: profile.phone || "",
        monthly_income: profile.monthly_income
          ? String(profile.monthly_income)
          : "",
        household_size: profile.household_size
          ? String(profile.household_size)
          : "",
        pets: profile.pets || "",
      });

      setAllowed(true);
      setLoading(false);
    }

    loadProfile();
  }, []);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveProfile() {
    setSaving(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please log in again.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        monthly_income: form.monthly_income
          ? Number(form.monthly_income)
          : null,
        household_size: form.household_size
          ? Number(form.household_size)
          : null,
        pets: form.pets,
      })
      .eq("id", user.id);

    if (error) {
      setMessage(`Could not save profile: ${error.message}`);
      setSaving(false);
      return;
    }

    setMessage("Profile saved.");
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading profile...</h1>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Profile unavailable</h1>
          <p className="mt-3 text-slate-600">{message}</p>

          <Link
            href="/dashboard/tenant"
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
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/dashboard/tenant" className="text-sm font-bold text-slate-600">
          ← Back to Tenant Dashboard
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Tenant Profile
          </p>

          <h1 className="mt-3 text-5xl font-black tracking-tight">
            Your Rental Profile
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Save your basic information so rental applications are faster.
          </p>

          {message && (
            <div className="mt-6 rounded-2xl bg-slate-100 px-5 py-4 font-bold text-slate-800">
              {message}
            </div>
          )}

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-black">
                Full name
              </label>
              <input
                value={form.full_name}
                onChange={(e) => updateField("full_name", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                placeholder="Full name"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-black">
                Email
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
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
            <Link
              href="/dashboard/tenant"
              className="rounded-full border border-slate-300 bg-white px-6 py-3 text-center font-black"
            >
              Cancel
            </Link>

            <button
              type="button"
              onClick={saveProfile}
              disabled={saving}
              className="rounded-full bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}