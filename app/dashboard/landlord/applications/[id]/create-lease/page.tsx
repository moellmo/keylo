"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createNotification } from "@/lib/createNotification";

type PropertyForLease = {
  id: string;
  title: string;
  monthly_rent: number;
  street_address: string | null;
  city: string;
  state: string;
  zip_code: string | null;
  landlord_id: string | null;
  landlord_company_id: string | null;
};

type ApplicationRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  landlord_id: string | null;
  landlord_company_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  properties: PropertyForLease | PropertyForLease[] | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  company_name: string | null;
};

type LeaseTemplate = {
  id: string;
  landlord_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
};

type LeaseTemplateSection = {
  id: string;
  template_id: string;
  landlord_id: string;
  section_title: string;
  section_body: string;
  sort_order: number;
  is_required: boolean;
};

type CustomLeaseSection = {
  section_title: string;
  section_body: string;
  sort_order: number;
  is_required: boolean;
};

type CompanyMembership = {
  company_id: string;
  role: "owner" | "admin" | "manager" | "maintenance" | "accounting" | "viewer";
};

function getProperty(application: ApplicationRow) {
  if (Array.isArray(application.properties)) {
    return application.properties[0] || null;
  }

  return application.properties;
}

function canCreateCompanyLease(role: string) {
  return role === "owner" || role === "admin" || role === "manager";
}

export default function CreateLeasePage() {
  const params = useParams();
  const router = useRouter();

  const applicationId = String(params.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "error">("info");

  const [landlordId, setLandlordId] = useState("");
  const [application, setApplication] = useState<ApplicationRow | null>(null);
  const [landlordProfile, setLandlordProfile] = useState<ProfileRow | null>(
    null
  );

  const [templates, setTemplates] = useState<LeaseTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateSections, setTemplateSections] = useState<
    LeaseTemplateSection[]
  >([]);

  const [form, setForm] = useState({
    tenant_name: "",
    landlord_name: "",
    property_address: "",
    monthly_rent: "",
    security_deposit: "",
    lease_start_date: "",
    lease_end_date: "",
    rent_due_day: "1",
    utilities_terms:
      "Tenant is responsible for utilities unless otherwise agreed in writing.",
    pet_terms: "Pet terms are subject to the property pet policy.",
    maintenance_terms:
      "Tenant must promptly notify landlord of maintenance issues. Landlord is responsible for required property maintenance unless caused by tenant damage.",
    additional_terms: "",
  });

  useEffect(() => {
    async function loadPage() {
      setLoading(true);
      setMessage("");
      setMessageType("info");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Please log in as a landlord.");
        setAllowed(false);
        setLoading(false);
        return;
      }

      setLandlordId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, company_name")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        setMessage("Could not load your account.");
        setAllowed(false);
        setLoading(false);
        return;
      }

      if (profile.role !== "landlord" && profile.role !== "admin") {
        setMessage("Only landlords can create leases.");
        setAllowed(false);
        setLoading(false);
        return;
      }

      setLandlordProfile(profile as ProfileRow);

      const { data: applicationRow, error: applicationError } = await supabase
        .from("applications")
        .select(
          `
          id,
          tenant_id,
          property_id,
          landlord_id,
          landlord_company_id,
          first_name,
          last_name,
          email,
          phone,
          status,
          properties (
            id,
            title,
            monthly_rent,
            street_address,
            city,
            state,
            zip_code,
            landlord_id,
            landlord_company_id
          )
        `
        )
        .eq("id", applicationId)
        .single();

      if (applicationError || !applicationRow) {
        setMessage("Application not found.");
        setAllowed(false);
        setLoading(false);
        return;
      }

      const app = applicationRow as unknown as ApplicationRow;
      const property = getProperty(app);

      const isAdmin = profile.role === "admin";
      const isListingOwner =
        property?.landlord_id === user.id || app.landlord_id === user.id;

      const companyId =
        app.landlord_company_id || property?.landlord_company_id || null;

      let isCompanyManager = false;

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

        isCompanyManager =
          !!companyMembership && canCreateCompanyLease(companyMembership.role);
      }

      if (!isAdmin && !isListingOwner && !isCompanyManager) {
        setMessage(
          "You do not have permission to create a lease for this application."
        );
        setAllowed(false);
        setLoading(false);
        return;
      }

      if (app.status !== "approved") {
        setMessage("This application must be approved before creating a lease.");
        setAllowed(false);
        setLoading(false);
        return;
      }

      const { data: existingLease } = await supabase
        .from("leases")
        .select("id")
        .eq("application_id", applicationId)
        .maybeSingle();

      if (existingLease?.id) {
        router.push(`/dashboard/landlord/leases/${existingLease.id}`);
        return;
      }

      const propertyAddress = property
        ? [
            property.street_address,
            property.city,
            property.state,
            property.zip_code,
          ]
            .filter(Boolean)
            .join(", ")
        : "";

      setApplication(app);

      setForm((current) => ({
        ...current,
        tenant_name: `${app.first_name} ${app.last_name}`,
        landlord_name:
          profile.company_name || profile.full_name || profile.email || "",
        property_address: propertyAddress,
        monthly_rent: property?.monthly_rent
          ? String(property.monthly_rent)
          : "",
      }));

     const templateOwnerId =
  property?.landlord_id || app.landlord_id || user.id;

const { data: templateRows, error: templateError } = await supabase
  .from("lease_templates")
  .select("id, landlord_id, name, description, is_default")
  .eq("landlord_id", templateOwnerId)
  .order("is_default", { ascending: false })
  .order("created_at", { ascending: false });

      if (templateError) {
        setMessage(templateError.message);
        setAllowed(false);
        setLoading(false);
        return;
      }

      const loadedTemplates = (templateRows || []) as LeaseTemplate[];
      setTemplates(loadedTemplates);

      const defaultTemplate =
        loadedTemplates.find((template) => template.is_default) ||
        loadedTemplates[0];

      if (defaultTemplate?.id) {
        setSelectedTemplateId(defaultTemplate.id);
        await loadTemplateSections(defaultTemplate.id);
      }

      setAllowed(true);
      setLoading(false);
    }

    loadPage();
  }, [applicationId, router]);

  async function loadTemplateSections(templateId: string) {
    if (!templateId) {
      setTemplateSections([]);
      return;
    }

    const { data, error } = await supabase
      .from("lease_template_sections")
      .select(
        `
        id,
        template_id,
        landlord_id,
        section_title,
        section_body,
        sort_order,
        is_required
      `
      )
      .eq("template_id", templateId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(error.message);
      setTemplateSections([]);
      return;
    }

    setTemplateSections((data || []) as LeaseTemplateSection[]);
  }

  async function changeTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    await loadTemplateSections(templateId);
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function showError(errorMessage: string) {
    setMessageType("error");
    setMessage(errorMessage);

    setTimeout(() => {
      const errorBox = document.getElementById("lease-error-message");

      if (errorBox) {
        errorBox.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 50);
  }

  function clearMessages() {
    setMessage("");
    setMessageType("info");
  }

  function buildCustomSections(): CustomLeaseSection[] {
    return templateSections.map((section) => ({
      section_title: section.section_title,
      section_body: section.section_body,
      sort_order: section.sort_order,
      is_required: section.is_required,
    }));
  }

  async function saveLease(leaseStatus: "draft" | "sent_to_tenant") {
    if (!application) {
      showError("Missing application.");
      return;
    }

    const property = getProperty(application);

    if (!property) {
      showError("Missing property.");
      return;
    }

    if (!landlordId) {
      showError("Missing landlord account. Please log out and log back in.");
      return;
    }

    if (!form.tenant_name.trim()) {
      showError("Please fill in the tenant name.");
      return;
    }

    if (!form.landlord_name.trim()) {
      showError("Please fill in the landlord name.");
      return;
    }

    if (!form.property_address.trim()) {
      showError("Please fill in the property address.");
      return;
    }

    if (!form.monthly_rent || Number(form.monthly_rent) <= 0) {
      showError("Please enter a valid monthly rent.");
      return;
    }

    if (!form.security_deposit || Number(form.security_deposit) < 0) {
      showError("Please enter a valid security deposit.");
      return;
    }

    if (!form.lease_start_date) {
      showError("Please choose a lease start date.");
      return;
    }

    if (!form.lease_end_date) {
      showError("Please choose a lease end date.");
      return;
    }

    if (!form.rent_due_day || Number(form.rent_due_day) < 1) {
      showError("Please enter a valid rent due day.");
      return;
    }

    setSaving(true);
    clearMessages();

    const customSections = buildCustomSections();

    const leaseLandlordId =
      property.landlord_id || application.landlord_id || landlordId;

    const leaseCompanyId =
      application.landlord_company_id || property.landlord_company_id || null;

    const { data: newLease, error } = await supabase
      .from("leases")
      .insert({
        application_id: application.id,
        property_id: property.id,
        tenant_id: application.tenant_id,
        landlord_id: leaseLandlordId,
        landlord_company_id: leaseCompanyId,

        lease_status: leaseStatus,

        tenant_name: form.tenant_name.trim(),
        landlord_name: form.landlord_name.trim(),
        property_address: form.property_address.trim(),

        monthly_rent: Number(form.monthly_rent),
        security_deposit: Number(form.security_deposit),
        lease_start_date: form.lease_start_date,
        lease_end_date: form.lease_end_date,
        rent_due_day: Number(form.rent_due_day),

        utilities_terms: form.utilities_terms.trim(),
        pet_terms: form.pet_terms.trim(),
        maintenance_terms: form.maintenance_terms.trim(),
        additional_terms: form.additional_terms.trim(),

        lease_template_id: selectedTemplateId || null,
        custom_sections: customSections,

        tenant_esign_fee_status: "unpaid",
        landlord_esign_fee_status: "unpaid",

        sent_to_tenant_at:
          leaseStatus === "sent_to_tenant" ? new Date().toISOString() : null,

        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      showError(error.message);
      setSaving(false);
      return;
    }

    if (!newLease?.id) {
      showError("Lease was not created. Please try again.");
      setSaving(false);
      return;
    }

    await supabase.from("lease_fees").upsert(
      [
        {
  lease_id: newLease.id,
  user_id: leaseLandlordId,
  payer_role: "landlord",
  fee_type: "esign_fee",
  amount_cents: 7500,
  currency: "usd",
  status: "unpaid",
  updated_at: new Date().toISOString(),
},
        {
          lease_id: newLease.id,
          user_id: landlordId,
          payer_role: "landlord",
          fee_type: "esign_fee",
          amount_cents: 7500,
          currency: "usd",
          status: "unpaid",
          updated_at: new Date().toISOString(),
        },
      ],
      {
        onConflict: "lease_id,user_id,fee_type",
      }
    );

    if (leaseStatus === "sent_to_tenant") {
      await createNotification({
        userId: application.tenant_id,
        title: "Lease ready to sign",
        message: `Your lease for ${
          form.property_address || "the rental"
        } is ready to review and sign.`,
        type: "lease_sent",
        targetUrl: `/dashboard/tenant/leases/${newLease.id}`,
        dedupe: true,
      });
    }

    setSaving(false);
    router.push(`/dashboard/landlord/leases/${newLease.id}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-black sm:text-3xl">
            Loading lease builder...
          </h1>
        </div>
      </main>
    );
  }

  if (!allowed || !application) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Lease unavailable</h1>

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
  const selectedTemplate = templates.find(
    (template) => template.id === selectedTemplateId
  );

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href={`/dashboard/landlord/applications/${application.id}`}
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Application
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Lease Builder
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Create Lease
          </h1>

          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Build a lease from the approved application for{" "}
            <strong>
              {application.first_name} {application.last_name}
            </strong>
            {property ? ` at ${property.title}.` : "."}
          </p>

          {message && messageType === "info" && (
            <div className="mt-6 rounded-2xl bg-slate-100 px-5 py-4 font-bold text-slate-800">
              {message}
            </div>
          )}

          <div className="mt-8 grid gap-8">
            <section className="rounded-3xl bg-[#f7f4ef] p-5 sm:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-2xl font-black">Lease Template</h2>

                  <p className="mt-2 leading-7 text-slate-600">
                    Choose a saved template from your Lease Builder. Its custom
                    clauses will be saved into this lease.
                  </p>
                </div>

                <Link
                  href="/dashboard/landlord/lease-builder"
                  className="w-fit rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black"
                >
                  Manage Templates
                </Link>
              </div>

              {templates.length > 0 ? (
                <>
                  <label className="mt-5 block">
                    <span className="mb-2 block text-sm font-black text-slate-700">
                      Select Template
                    </span>

                    <select
                      value={selectedTemplateId}
                      onChange={(event) => changeTemplate(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-black outline-none focus:border-slate-950"
                    >
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                          {template.is_default ? " — Default" : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="mt-5 rounded-2xl bg-white p-5">
                    <h3 className="text-xl font-black">
                      {selectedTemplate?.name || "Selected Template"}
                    </h3>

                    {selectedTemplate?.description && (
                      <p className="mt-2 font-bold text-slate-500">
                        {selectedTemplate.description}
                      </p>
                    )}

                    <p className="mt-3 text-sm font-bold text-slate-500">
                      {templateSections.length} custom section
                      {templateSections.length === 1 ? "" : "s"} will be added
                      to this lease.
                    </p>
                  </div>

                  {templateSections.length > 0 && (
                    <div className="mt-5 divide-y divide-slate-200 rounded-2xl bg-white">
                      {templateSections.map((section) => (
                        <div key={section.id} className="p-5">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="font-black">
                              {section.sort_order}. {section.section_title}
                            </h3>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black ${
                                section.is_required
                                  ? "bg-slate-950 text-white"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {section.is_required ? "Required" : "Optional"}
                            </span>
                          </div>

                          <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">
                            {section.section_body}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-5 rounded-2xl bg-white p-5">
                  <h3 className="text-xl font-black">No templates yet</h3>

                  <p className="mt-2 leading-7 text-slate-600">
                    You can still create this lease using the basic lease terms
                    below. To add reusable custom clauses, create a lease
                    template first.
                  </p>

                  <Link
                    href="/dashboard/landlord/lease-builder"
                    className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 font-black text-white"
                  >
                    Create Lease Template
                  </Link>
                </div>
              )}
            </section>

            <section>
              <h2 className="text-2xl font-black">Lease Parties</h2>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <Field
                  label="Tenant Name"
                  value={form.tenant_name}
                  onChange={(value) => updateField("tenant_name", value)}
                />

                <Field
                  label="Landlord Name"
                  value={form.landlord_name}
                  onChange={(value) => updateField("landlord_name", value)}
                />

                <TextArea
                  label="Property Address"
                  value={form.property_address}
                  onChange={(value) => updateField("property_address", value)}
                />
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-black">Lease Terms</h2>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <Field
                  label="Monthly Rent"
                  type="number"
                  value={form.monthly_rent}
                  onChange={(value) => updateField("monthly_rent", value)}
                />

                <Field
                  label="Security Deposit"
                  type="number"
                  value={form.security_deposit}
                  onChange={(value) => updateField("security_deposit", value)}
                />

                <Field
                  label="Lease Start Date"
                  type="date"
                  value={form.lease_start_date}
                  onChange={(value) => updateField("lease_start_date", value)}
                />

                <Field
                  label="Lease End Date"
                  type="date"
                  value={form.lease_end_date}
                  onChange={(value) => updateField("lease_end_date", value)}
                />

                <Field
                  label="Rent Due Day"
                  type="number"
                  value={form.rent_due_day}
                  onChange={(value) => updateField("rent_due_day", value)}
                />
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-black">Basic Lease Clauses</h2>

              <div className="mt-5 grid gap-5">
                <TextArea
                  label="Utilities Terms"
                  value={form.utilities_terms}
                  onChange={(value) => updateField("utilities_terms", value)}
                />

                <TextArea
                  label="Pet Terms"
                  value={form.pet_terms}
                  onChange={(value) => updateField("pet_terms", value)}
                />

                <TextArea
                  label="Maintenance Terms"
                  value={form.maintenance_terms}
                  onChange={(value) =>
                    updateField("maintenance_terms", value)
                  }
                />

                <TextArea
                  label="Additional Terms"
                  value={form.additional_terms}
                  onChange={(value) => updateField("additional_terms", value)}
                />
              </div>
            </section>

            <section className="rounded-3xl bg-[#f7f4ef] p-5 sm:p-6">
              <h2 className="text-2xl font-black">E-Sign Fees</h2>

              <p className="mt-3 leading-7 text-slate-600">
                Keylo will create a $75 e-sign fee for the tenant and a $75
                e-sign fee for the landlord. Stripe payment will be connected in
                the next step.
              </p>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div className="rounded-3xl bg-white p-5">
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                    Tenant E-Sign Fee
                  </p>
                  <p className="mt-2 text-3xl font-black">$75</p>
                  <p className="mt-2 text-sm font-bold text-slate-500">
                    Status: unpaid
                  </p>
                </div>

                <div className="rounded-3xl bg-white p-5">
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                    Landlord E-Sign Fee
                  </p>
                  <p className="mt-2 text-3xl font-black">$75</p>
                  <p className="mt-2 text-sm font-bold text-slate-500">
                    Status: unpaid
                  </p>
                </div>
              </div>
            </section>
          </div>

          {message && messageType === "error" && (
            <div
              id="lease-error-message"
              className="mt-8 rounded-2xl bg-red-50 px-5 py-4 font-bold text-red-700 ring-1 ring-red-200"
            >
              {message}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
            <Link
              href={`/dashboard/landlord/applications/${application.id}`}
              className="rounded-full border border-slate-300 bg-white px-6 py-3 text-center font-black"
            >
              Cancel
            </Link>

            <button
              type="button"
              onClick={() => saveLease("draft")}
              disabled={saving}
              className="rounded-full border border-slate-300 bg-white px-6 py-3 font-black text-slate-950 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>

            <button
              type="button"
              onClick={() => saveLease("sent_to_tenant")}
              disabled={saving}
              className="rounded-full bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-60"
            >
              {saving ? "Sending..." : "Send to Tenant"}
            </button>
          </div>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </span>

      <input
        type={type}
        value={value}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block md:col-span-2">
      <span className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </span>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
      />
    </label>
  );
}