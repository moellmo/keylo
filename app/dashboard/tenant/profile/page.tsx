"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TenantProfile = {
  legal_first_name: string;
  legal_last_name: string;
  date_of_birth: string;
  phone: string;
  current_street_address: string;
  current_city: string;
  current_state: string;
  current_zip_code: string;
  employment_status: string;
  employer_name: string;
  job_title: string;
  monthly_income: string;
  additional_income: string;
  household_size: string;
  pets: string;
  desired_move_in_date: string;
  current_landlord_name: string;
  current_landlord_phone: string;
  current_landlord_email: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
};

const emptyProfile: TenantProfile = {
  legal_first_name: "",
  legal_last_name: "",
  date_of_birth: "",
  phone: "",
  current_street_address: "",
  current_city: "",
  current_state: "",
  current_zip_code: "",
  employment_status: "",
  employer_name: "",
  job_title: "",
  monthly_income: "",
  additional_income: "",
  household_size: "",
  pets: "",
  desired_move_in_date: "",
  current_landlord_name: "",
  current_landlord_phone: "",
  current_landlord_email: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_contact_relationship: "",
};

function isValidPastDate(value: string) {
  if (!value) return false;

  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return parsed < today;
}

export default function TenantProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
          <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <h1 className="text-3xl font-black">Loading profile...</h1>
          </div>
        </main>
      }
    >
      <TenantProfileContent />
    </Suspense>
  );
}

function TenantProfileContent() {
  const messageRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">(
    "info"
  );
  const [hasSaved, setHasSaved] = useState(false);
  const [profile, setProfile] = useState<TenantProfile>(emptyProfile);

  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/dashboard/tenant";

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessageType("error");
        setMessage("Please log in to edit your tenant profile.");
        setLoading(false);
        return;
      }

      setTenantId(user.id);

      const { data: existingProfile, error } = await supabase
        .from("tenant_profiles")
        .select("*")
        .eq("tenant_id", user.id)
        .maybeSingle();

      if (error) {
        setMessageType("error");
        setMessage(error.message);
        setLoading(false);
        return;
      }

      if (existingProfile) {
        setProfile({
          legal_first_name: existingProfile.legal_first_name || "",
          legal_last_name: existingProfile.legal_last_name || "",
          date_of_birth: existingProfile.date_of_birth || "",
          phone: existingProfile.phone || "",
          current_street_address: existingProfile.current_street_address || "",
          current_city: existingProfile.current_city || "",
          current_state: existingProfile.current_state || "",
          current_zip_code: existingProfile.current_zip_code || "",
          employment_status: existingProfile.employment_status || "",
          employer_name: existingProfile.employer_name || "",
          job_title: existingProfile.job_title || "",
          monthly_income: existingProfile.monthly_income
            ? String(existingProfile.monthly_income)
            : "",
          additional_income: existingProfile.additional_income
            ? String(existingProfile.additional_income)
            : "",
          household_size: existingProfile.household_size
            ? String(existingProfile.household_size)
            : "",
          pets: existingProfile.pets || "",
          desired_move_in_date: existingProfile.desired_move_in_date || "",
          current_landlord_name: existingProfile.current_landlord_name || "",
          current_landlord_phone: existingProfile.current_landlord_phone || "",
          current_landlord_email: existingProfile.current_landlord_email || "",
          emergency_contact_name: existingProfile.emergency_contact_name || "",
          emergency_contact_phone: existingProfile.emergency_contact_phone || "",
          emergency_contact_relationship:
            existingProfile.emergency_contact_relationship || "",
        });
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  function updateField(field: keyof TenantProfile, value: string) {
    setHasSaved(false);
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function calculateStatus() {
    const requiredFields = [
      profile.legal_first_name,
      profile.legal_last_name,
      profile.date_of_birth,
      profile.phone,
      profile.current_street_address,
      profile.current_city,
      profile.current_state,
      profile.current_zip_code,
      profile.employment_status,
      profile.monthly_income,
      profile.household_size,
    ];

    const complete =
      requiredFields.every((value) => value.trim() !== "") &&
      isValidPastDate(profile.date_of_birth) &&
      Number(profile.monthly_income) > 0 &&
      Number(profile.household_size) > 0;

    return complete ? "complete" : "incomplete";
  }

  function getMissingItems() {
    const missing: string[] = [];

    if (!profile.legal_first_name.trim()) missing.push("Legal first name");
    if (!profile.legal_last_name.trim()) missing.push("Legal last name");

    if (!profile.date_of_birth) {
      missing.push("Date of birth");
    } else if (!isValidPastDate(profile.date_of_birth)) {
      missing.push("Valid date of birth");
    }

    if (!profile.phone.trim()) missing.push("Phone");
    if (!profile.current_street_address.trim()) missing.push("Street address");
    if (!profile.current_city.trim()) missing.push("City");
    if (!profile.current_state.trim()) missing.push("State");
    if (!profile.current_zip_code.trim()) missing.push("ZIP code");
    if (!profile.employment_status.trim()) missing.push("Employment status");

    if (!profile.monthly_income || Number(profile.monthly_income) <= 0) {
      missing.push("Monthly income");
    }

    if (!profile.household_size || Number(profile.household_size) <= 0) {
      missing.push("Household size");
    }

    return missing;
  }

  async function saveProfile() {
    if (!tenantId) {
      setMessageType("error");
      setMessage("You must be logged in to save your profile.");
      return;
    }

    setSaving(true);
    setMessage("");
    setHasSaved(false);

    const status = calculateStatus();
    const missingItems = getMissingItems();

    const payload = {
      tenant_id: tenantId,
      legal_first_name: profile.legal_first_name.trim(),
      legal_last_name: profile.legal_last_name.trim(),
      date_of_birth: profile.date_of_birth || null,
      phone: profile.phone.trim(),
      current_street_address: profile.current_street_address.trim(),
      current_city: profile.current_city.trim(),
      current_state: profile.current_state.trim(),
      current_zip_code: profile.current_zip_code.trim(),
      employment_status: profile.employment_status.trim(),
      employer_name: profile.employer_name.trim(),
      job_title: profile.job_title.trim(),
      monthly_income: profile.monthly_income
        ? Number(profile.monthly_income)
        : null,
      additional_income: profile.additional_income
        ? Number(profile.additional_income)
        : null,
      household_size: profile.household_size
        ? Number(profile.household_size)
        : null,
      pets: profile.pets.trim(),
      desired_move_in_date: profile.desired_move_in_date || null,
      current_landlord_name: profile.current_landlord_name.trim(),
      current_landlord_phone: profile.current_landlord_phone.trim(),
      current_landlord_email: profile.current_landlord_email.trim(),
      emergency_contact_name: profile.emergency_contact_name.trim(),
      emergency_contact_phone: profile.emergency_contact_phone.trim(),
      emergency_contact_relationship:
        profile.emergency_contact_relationship.trim(),
      profile_status: status,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("tenant_profiles").upsert(payload, {
      onConflict: "tenant_id",
    });

    if (error) {
      setMessageType("error");
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setMessageType(status === "complete" ? "success" : "info");
    setMessage(
      status === "complete"
        ? "Tenant profile saved. Your profile is complete and you can continue your application."
        : `Tenant profile saved, but it is still incomplete. Missing: ${missingItems.join(
            ", "
          )}.`
    );
    setHasSaved(true);
    setSaving(false);

    setTimeout(() => {
      messageRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
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

  const status = calculateStatus();

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link href={returnTo} className="text-sm font-bold text-slate-600">
          ←{" "}
          {returnTo.startsWith("/apply/")
            ? "Back to Application"
            : "Back to Tenant Dashboard"}
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Keylo Instant Apply
          </p>

          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-5xl font-black tracking-tight">
                Tenant Profile
              </h1>

              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
                Fill this out once and use it for future rental applications.
                This is the foundation for Instant Apply, verification,
                screening, leases, and Keylo Score.
              </p>
            </div>

            <span
              className={`w-fit rounded-full px-4 py-2 text-sm font-black ${
                status === "complete"
                  ? "bg-green-50 text-green-700 ring-1 ring-green-200"
                  : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
              }`}
            >
              {status === "complete" ? "Profile Complete" : "Profile Incomplete"}
            </span>
          </div>

          {message && (
            <div
              ref={messageRef}
              className={`mt-6 rounded-2xl px-5 py-4 font-bold ring-1 ${
                messageType === "success"
                  ? "bg-green-50 text-green-700 ring-green-200"
                  : messageType === "error"
                    ? "bg-red-50 text-red-700 ring-red-200"
                    : "bg-amber-50 text-amber-800 ring-amber-200"
              }`}
            >
              {message}
            </div>
          )}

          <div className="mt-8 grid gap-8">
            <section>
              <h2 className="text-2xl font-black">Legal Information</h2>

              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <Field
                  label="Legal First Name"
                  value={profile.legal_first_name}
                  onChange={(value) => updateField("legal_first_name", value)}
                />

                <Field
                  label="Legal Last Name"
                  value={profile.legal_last_name}
                  onChange={(value) => updateField("legal_last_name", value)}
                />

                <Field
                  label="Date of Birth"
                  type="date"
                  value={profile.date_of_birth}
                  onChange={(value) => updateField("date_of_birth", value)}
                />

                <Field
                  label="Phone"
                  value={profile.phone}
                  onChange={(value) => updateField("phone", value)}
                />
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-black">Current Address</h2>

              <div className="mt-4 grid gap-5">
                <Field
                  label="Street Address"
                  value={profile.current_street_address}
                  onChange={(value) =>
                    updateField("current_street_address", value)
                  }
                />

                <div className="grid gap-5 md:grid-cols-3">
                  <Field
                    label="City"
                    value={profile.current_city}
                    onChange={(value) => updateField("current_city", value)}
                  />

                  <Field
                    label="State"
                    value={profile.current_state}
                    onChange={(value) => updateField("current_state", value)}
                  />

                  <Field
                    label="ZIP Code"
                    value={profile.current_zip_code}
                    onChange={(value) => updateField("current_zip_code", value)}
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-black">Income & Employment</h2>

              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <Field
                  label="Employment Status"
                  placeholder="Employed, self-employed, student, etc."
                  value={profile.employment_status}
                  onChange={(value) => updateField("employment_status", value)}
                />

                <Field
                  label="Employer Name"
                  value={profile.employer_name}
                  onChange={(value) => updateField("employer_name", value)}
                />

                <Field
                  label="Job Title"
                  value={profile.job_title}
                  onChange={(value) => updateField("job_title", value)}
                />

                <Field
                  label="Monthly Income"
                  type="number"
                  value={profile.monthly_income}
                  onChange={(value) => updateField("monthly_income", value)}
                />

                <Field
                  label="Additional Monthly Income"
                  type="number"
                  value={profile.additional_income}
                  onChange={(value) => updateField("additional_income", value)}
                />
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-black">Rental Details</h2>

              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <Field
                  label="Household Size"
                  type="number"
                  value={profile.household_size}
                  onChange={(value) => updateField("household_size", value)}
                />

                <Field
                  label="Desired Move-in Date"
                  type="date"
                  value={profile.desired_move_in_date}
                  onChange={(value) =>
                    updateField("desired_move_in_date", value)
                  }
                />

                <TextArea
                  label="Pets"
                  placeholder="No pets, or describe pets here."
                  value={profile.pets}
                  onChange={(value) => updateField("pets", value)}
                />
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-black">Current Landlord</h2>

              <div className="mt-4 grid gap-5 md:grid-cols-3">
                <Field
                  label="Landlord Name"
                  value={profile.current_landlord_name}
                  onChange={(value) =>
                    updateField("current_landlord_name", value)
                  }
                />

                <Field
                  label="Landlord Phone"
                  value={profile.current_landlord_phone}
                  onChange={(value) =>
                    updateField("current_landlord_phone", value)
                  }
                />

                <Field
                  label="Landlord Email"
                  type="email"
                  value={profile.current_landlord_email}
                  onChange={(value) =>
                    updateField("current_landlord_email", value)
                  }
                />
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-black">Emergency Contact</h2>

              <div className="mt-4 grid gap-5 md:grid-cols-3">
                <Field
                  label="Contact Name"
                  value={profile.emergency_contact_name}
                  onChange={(value) =>
                    updateField("emergency_contact_name", value)
                  }
                />

                <Field
                  label="Contact Phone"
                  value={profile.emergency_contact_phone}
                  onChange={(value) =>
                    updateField("emergency_contact_phone", value)
                  }
                />

                <Field
                  label="Relationship"
                  value={profile.emergency_contact_relationship}
                  onChange={(value) =>
                    updateField("emergency_contact_relationship", value)
                  }
                />
              </div>
            </section>
          </div>

          <button
            type="button"
            onClick={saveProfile}
            disabled={saving}
            className="mt-10 w-full rounded-full bg-slate-950 px-6 py-4 font-black text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Tenant Profile"}
          </button>

          <Link
            href={returnTo}
            className={`mt-4 flex w-full justify-center rounded-full px-6 py-4 font-black ${
              hasSaved && status === "complete" && returnTo.startsWith("/apply/")
                ? "bg-green-600 text-white"
                : "border border-slate-300 bg-white text-slate-950"
            }`}
          >
            {returnTo.startsWith("/apply/")
              ? hasSaved && status === "complete"
                ? "Continue Application"
                : "Back to Application"
              : "Back to Dashboard"}
          </Link>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </span>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block md:col-span-2">
      <span className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </span>

      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
      />
    </label>
  );
}