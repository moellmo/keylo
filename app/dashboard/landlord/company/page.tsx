"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Company = {
  id: string;
  name: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  owner_id: string;
  created_at: string;
};

type CompanyMembership = {
  id: string;
  company_id: string;
  user_id: string;
  role: "owner" | "admin" | "manager" | "maintenance" | "accounting" | "viewer";
  status: "active" | "removed";
  landlord_companies: Company | Company[] | null;
};

function getCompanyFromMembership(membership: CompanyMembership | null) {
  if (!membership) return null;

  if (Array.isArray(membership.landlord_companies)) {
    return membership.landlord_companies[0] || null;
  }

  return membership.landlord_companies;
}

function canEditCompany(role: CompanyMembership["role"] | null) {
  return role === "owner" || role === "admin";
}

export default function LandlordCompanyPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState("");
  const [membership, setMembership] = useState<CompanyMembership | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("US");

  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadCompany();
  }, []);

  function fillForm(companyRow: Company | null) {
    setName(companyRow?.name || "");
    setLegalName(companyRow?.legal_name || "");
    setEmail(companyRow?.email || "");
    setPhone(companyRow?.phone || "");
    setWebsite(companyRow?.website || "");
    setAddressLine1(companyRow?.address_line1 || "");
    setAddressLine2(companyRow?.address_line2 || "");
    setCity(companyRow?.city || "");
    setStateValue(companyRow?.state || "");
    setPostalCode(companyRow?.postal_code || "");
    setCountry(companyRow?.country || "US");
  }

  async function loadCompany() {
    setLoading(true);
    setMessage("");
    setSuccessMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setAllowed(false);
      setMessage("Please log in as a landlord.");
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || (profile?.role !== "landlord" && profile?.role !== "admin")) {
      setAllowed(false);
      setMessage("You must be logged in as a landlord to manage a company.");
      setLoading(false);
      return;
    }

    const { data: membershipRows, error: membershipError } = await supabase
      .from("landlord_company_members")
      .select(
        `
        id,
        company_id,
        user_id,
        role,
        status,
        landlord_companies (
          id,
          name,
          legal_name,
          email,
          phone,
          website,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          country,
          owner_id,
          created_at
        )
      `
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1);

    if (membershipError) {
      setAllowed(false);
      setMessage(membershipError.message);
      setLoading(false);
      return;
    }

    const firstMembership =
      ((membershipRows || [])[0] as unknown as CompanyMembership | undefined) ||
      null;

    const companyRow = getCompanyFromMembership(firstMembership);

    setMembership(firstMembership);
    setCompany(companyRow);
    fillForm(companyRow);
    setAllowed(true);
    setLoading(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setSuccessMessage("");

    const cleanName = name.trim();

    if (!cleanName) {
      setMessage("Company name is required.");
      setSaving(false);
      return;
    }

    const payload = {
      name: cleanName,
      legal_name: legalName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      website: website.trim() || null,
      address_line1: addressLine1.trim() || null,
      address_line2: addressLine2.trim() || null,
      city: city.trim() || null,
      state: stateValue.trim() || null,
      postal_code: postalCode.trim() || null,
      country: country.trim() || "US",
      updated_at: new Date().toISOString(),
    };

    if (company) {
      if (!canEditCompany(membership?.role || null)) {
        setMessage("Only company owners and admins can update company details.");
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("landlord_companies")
        .update(payload)
        .eq("id", company.id);

      if (error) {
        setMessage(error.message);
        setSaving(false);
        return;
      }

      setSuccessMessage("Company profile updated.");
      await loadCompany();
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("landlord_companies").insert({
      ...payload,
      owner_id: userId,
    });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setSuccessMessage("Company created. You are now the company owner.");
    await loadCompany();
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-black sm:text-3xl">
            Loading company...
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
            <h1 className="text-3xl font-black">Landlord access required</h1>
            <p className="mt-3 text-slate-600">{message}</p>

            <Link
              href="/auth/login"
              className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
            >
              Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const editable = !company || canEditCompany(membership?.role || null);

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <Link
            href="/dashboard/landlord"
            className="text-sm font-bold text-slate-600"
          >
            ← Back to Landlord Dashboard
          </Link>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Landlord Company
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
                Company Profile
              </h1>

              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                Create your landlord company, manage your company details, and
                prepare for team members and role-based access.
              </p>
            </div>

            {company && (
              <Link
                href="/dashboard/landlord/team"
                className="rounded-full bg-slate-950 px-6 py-4 text-center font-black text-white"
              >
                Manage Team
              </Link>
            )}
          </div>

          {company && membership && (
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <InfoCard title="Company" value={company.name} />
              <InfoCard title="Your Role" value={membership.role} />
              <InfoCard
                title="Created"
                value={new Date(company.created_at).toLocaleDateString()}
              />
            </div>
          )}

          {!editable && (
            <div className="mt-6 rounded-2xl bg-yellow-50 px-5 py-4 font-bold text-yellow-800 ring-1 ring-yellow-200">
              You can view this company, but only company owners and admins can
              edit company details.
            </div>
          )}

          {successMessage && (
            <div className="mt-6 rounded-2xl bg-green-50 px-5 py-4 font-bold text-green-700 ring-1 ring-green-200">
              {successMessage}
            </div>
          )}

          {message && (
            <div className="mt-6 rounded-2xl bg-red-50 px-5 py-4 font-bold text-red-700 ring-1 ring-red-200">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <TextInput
                label="Company Name"
                value={name}
                onChange={setName}
                required
                disabled={!editable}
                placeholder="Example: Keylo Property Group"
              />

              <TextInput
                label="Legal Name"
                value={legalName}
                onChange={setLegalName}
                disabled={!editable}
                placeholder="Optional"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <TextInput
                label="Company Email"
                value={email}
                onChange={setEmail}
                disabled={!editable}
                placeholder="office@example.com"
                type="email"
              />

              <TextInput
                label="Phone"
                value={phone}
                onChange={setPhone}
                disabled={!editable}
                placeholder="Optional"
              />

              <TextInput
                label="Website"
                value={website}
                onChange={setWebsite}
                disabled={!editable}
                placeholder="https://example.com"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <TextInput
                label="Address Line 1"
                value={addressLine1}
                onChange={setAddressLine1}
                disabled={!editable}
                placeholder="Street address"
              />

              <TextInput
                label="Address Line 2"
                value={addressLine2}
                onChange={setAddressLine2}
                disabled={!editable}
                placeholder="Suite, unit, etc."
              />
            </div>

            <div className="grid gap-5 md:grid-cols-4">
              <TextInput
                label="City"
                value={city}
                onChange={setCity}
                disabled={!editable}
              />

              <TextInput
                label="State"
                value={stateValue}
                onChange={setStateValue}
                disabled={!editable}
              />

              <TextInput
                label="Postal Code"
                value={postalCode}
                onChange={setPostalCode}
                disabled={!editable}
              />

              <TextInput
                label="Country"
                value={country}
                onChange={setCountry}
                disabled={!editable}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {editable && (
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-slate-950 px-6 py-4 text-center font-black text-white disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : company
                      ? "Save Company"
                      : "Create Company"}
                </button>
              )}

              <Link
                href="/dashboard/landlord"
                className="rounded-full border border-slate-300 bg-white px-6 py-4 text-center font-black text-slate-950"
              >
                Back to Dashboard
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl bg-[#f7f4ef] p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <p className="mt-2 break-words text-2xl font-black capitalize">{value}</p>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-700">
        {label}
        {required ? " *" : ""}
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        type={type}
        className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-slate-500 disabled:bg-slate-100 disabled:text-slate-500"
      />
    </label>
  );
}