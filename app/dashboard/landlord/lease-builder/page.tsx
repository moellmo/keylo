"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type LeaseTemplate = {
  id: string;
  landlord_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
};

type LeaseTemplateSection = {
  id: string;
  template_id: string;
  landlord_id: string;
  section_title: string;
  section_body: string;
  sort_order: number;
  is_required: boolean;
  created_at: string;
};

export default function LeaseBuilderPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("");
  const [templates, setTemplates] = useState<LeaseTemplate[]>([]);
  const [sections, setSections] = useState<LeaseTemplateSection[]>([]);

  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionBody, setSectionBody] = useState("");
  const [sectionRequired, setSectionRequired] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingSection, setSavingSection] = useState(false);

  useEffect(() => {
    loadBuilder();
  }, []);

  async function loadBuilder() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please log in as a landlord.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "landlord" && profile?.role !== "admin") {
      setMessage("Only landlords can use the lease builder.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: templateRows, error: templateError } = await supabase
      .from("lease_templates")
      .select("*")
      .eq("landlord_id", user.id)
      .order("created_at", { ascending: false });

    if (templateError) {
      setMessage(templateError.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    const loadedTemplates = (templateRows || []) as LeaseTemplate[];
    setTemplates(loadedTemplates);

    const activeTemplateId =
      selectedTemplateId || loadedTemplates[0]?.id || "";

    if (activeTemplateId) {
      setSelectedTemplateId(activeTemplateId);
      await loadSections(activeTemplateId);
    } else {
      setSections([]);
    }

    setAllowed(true);
    setLoading(false);
  }

  async function loadSections(templateId: string) {
    const { data, error } = await supabase
      .from("lease_template_sections")
      .select("*")
      .eq("template_id", templateId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    setSections((data || []) as LeaseTemplateSection[]);
  }

  async function createTemplate() {
    if (!templateName.trim()) {
      setMessage("Template name is required.");
      return;
    }

    setSavingTemplate(true);
    setMessage("");

    const { data, error } = await supabase
      .from("lease_templates")
      .insert({
        landlord_id: userId,
        name: templateName.trim(),
        description: templateDescription.trim() || null,
        is_default: templates.length === 0,
      })
      .select("*")
      .single();

    if (error) {
      setMessage(error.message);
      setSavingTemplate(false);
      return;
    }

    setTemplateName("");
    setTemplateDescription("");
    setSelectedTemplateId(data.id);
    setSavingTemplate(false);
    await loadBuilder();
  }

  async function setDefaultTemplate(templateId: string) {
    setMessage("");

    const { error: clearError } = await supabase
      .from("lease_templates")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("landlord_id", userId);

    if (clearError) {
      setMessage(clearError.message);
      return;
    }

    const { error } = await supabase
      .from("lease_templates")
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq("id", templateId)
      .eq("landlord_id", userId);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadBuilder();
  }

  async function deleteTemplate(templateId: string) {
    const confirmed = window.confirm(
      "Delete this lease template and all its sections?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("lease_templates")
      .delete()
      .eq("id", templateId)
      .eq("landlord_id", userId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSelectedTemplateId("");
    await loadBuilder();
  }

  async function addSection() {
    if (!selectedTemplateId) {
      setMessage("Create or select a lease template first.");
      return;
    }

    if (!sectionTitle.trim()) {
      setMessage("Section title is required.");
      return;
    }

    if (!sectionBody.trim()) {
      setMessage("Section body is required.");
      return;
    }

    setSavingSection(true);
    setMessage("");

    const nextSortOrder =
      sections.length > 0
        ? Math.max(...sections.map((section) => section.sort_order || 0)) + 1
        : 1;

    const { error } = await supabase.from("lease_template_sections").insert({
      template_id: selectedTemplateId,
      landlord_id: userId,
      section_title: sectionTitle.trim(),
      section_body: sectionBody.trim(),
      sort_order: nextSortOrder,
      is_required: sectionRequired,
    });

    if (error) {
      setMessage(error.message);
      setSavingSection(false);
      return;
    }

    setSectionTitle("");
    setSectionBody("");
    setSectionRequired(true);
    setSavingSection(false);
    await loadSections(selectedTemplateId);
  }

  async function deleteSection(sectionId: string) {
    const confirmed = window.confirm("Delete this lease section?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("lease_template_sections")
      .delete()
      .eq("id", sectionId)
      .eq("landlord_id", userId);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadSections(selectedTemplateId);
  }

  async function moveSection(section: LeaseTemplateSection, direction: -1 | 1) {
    const newSortOrder = section.sort_order + direction;

    if (newSortOrder < 1) return;

    const { error } = await supabase
      .from("lease_template_sections")
      .update({
        sort_order: newSortOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", section.id)
      .eq("landlord_id", userId);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadSections(selectedTemplateId);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading lease builder...</h1>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Lease builder unavailable</h1>

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

  const selectedTemplate = templates.find(
    (template) => template.id === selectedTemplateId
  );

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link
          href="/dashboard/landlord"
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Landlord Dashboard
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Keylo Lease Builder
              </p>

              <h1 className="mt-3 text-5xl font-black tracking-tight">
                Build Lease Templates
              </h1>

              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
                Create reusable lease templates with custom sections and clauses.
                These templates will be used when creating leases from approved
                applications.
              </p>
            </div>

            <Link
              href="/dashboard/landlord"
              className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
            >
              Dashboard
            </Link>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl bg-slate-100 px-5 py-4 font-bold text-red-700">
              {message}
            </div>
          )}

          <div className="mt-8 grid gap-8 lg:grid-cols-[360px_1fr]">
            <aside className="rounded-3xl bg-[#f7f4ef] p-6">
              <h2 className="text-2xl font-black">Templates</h2>

              <div className="mt-5 grid gap-3">
                <label>
                  <span className="text-sm font-black text-slate-700">
                    Template Name
                  </span>

                  <input
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    placeholder="Example: Standard Residential Lease"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-slate-950"
                  />
                </label>

                <label>
                  <span className="text-sm font-black text-slate-700">
                    Description optional
                  </span>

                  <textarea
                    value={templateDescription}
                    onChange={(event) =>
                      setTemplateDescription(event.target.value)
                    }
                    rows={3}
                    placeholder="Short note for internal use"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-slate-950"
                  />
                </label>

                <button
                  type="button"
                  onClick={createTemplate}
                  disabled={savingTemplate}
                  className="rounded-full bg-slate-950 px-5 py-3 font-black text-white disabled:opacity-60"
                >
                  {savingTemplate ? "Creating..." : "Create Template"}
                </button>
              </div>

              <div className="mt-8 grid gap-3">
                {templates.length > 0 ? (
                  templates.map((template) => (
                    <div
                      key={template.id}
                      className={`rounded-3xl bg-white p-4 ring-1 ${
                        selectedTemplateId === template.id
                          ? "ring-slate-950"
                          : "ring-slate-200"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={async () => {
                          setSelectedTemplateId(template.id);
                          await loadSections(template.id);
                        }}
                        className="block w-full text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-black">{template.name}</h3>

                            {template.description && (
                              <p className="mt-1 text-sm font-bold text-slate-500">
                                {template.description}
                              </p>
                            )}
                          </div>

                          {template.is_default && (
                            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-700">
                              Default
                            </span>
                          )}
                        </div>
                      </button>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {!template.is_default && (
                          <button
                            type="button"
                            onClick={() => setDefaultTemplate(template.id)}
                            className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-black"
                          >
                            Set Default
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => deleteTemplate(template.id)}
                          className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl bg-white p-5 text-center">
                    <p className="font-bold text-slate-600">
                      No lease templates yet.
                    </p>
                  </div>
                )}
              </div>
            </aside>

            <section>
              <div className="rounded-3xl bg-[#f7f4ef] p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-2xl font-black">
                      {selectedTemplate
                        ? selectedTemplate.name
                        : "Select a Template"}
                    </h2>

                    <p className="mt-2 text-slate-600">
                      Add sections like rent terms, late fees, maintenance,
                      pets, utilities, move-in rules, and custom clauses.
                    </p>
                  </div>

                  {selectedTemplate?.is_default && (
                    <span className="w-fit rounded-full bg-green-50 px-4 py-2 text-sm font-black text-green-700">
                      Default Template
                    </span>
                  )}
                </div>

                <div className="mt-6 grid gap-5">
                  <label>
                    <span className="text-sm font-black text-slate-700">
                      Section Title
                    </span>

                    <input
                      value={sectionTitle}
                      onChange={(event) => setSectionTitle(event.target.value)}
                      placeholder="Example: Late Fees"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-slate-950"
                    />
                  </label>

                  <label>
                    <span className="text-sm font-black text-slate-700">
                      Section Body / Clause
                    </span>

                    <textarea
                      value={sectionBody}
                      onChange={(event) => setSectionBody(event.target.value)}
                      rows={6}
                      placeholder="Write the lease clause here..."
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold leading-7 outline-none focus:border-slate-950"
                    />
                  </label>

                  <label className="flex items-start gap-3 rounded-2xl bg-white p-4 font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={sectionRequired}
                      onChange={(event) =>
                        setSectionRequired(event.target.checked)
                      }
                      className="mt-1"
                    />
                    <span>This section is required in the lease.</span>
                  </label>

                  <button
                    type="button"
                    onClick={addSection}
                    disabled={savingSection || !selectedTemplateId}
                    className="w-fit rounded-full bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-60"
                  >
                    {savingSection ? "Adding..." : "Add Section"}
                  </button>
                </div>
              </div>

              <div className="mt-8 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
                <div className="border-b border-slate-200 p-6">
                  <h2 className="text-2xl font-black">Template Sections</h2>
                </div>

                {sections.length > 0 ? (
                  <div className="divide-y divide-slate-200">
                    {sections.map((section) => (
                      <div key={section.id} className="p-6">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <h3 className="text-xl font-black">
                                {section.sort_order}. {section.section_title}
                              </h3>

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-black ${
                                  section.is_required
                                    ? "bg-slate-950 text-white"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {section.is_required
                                  ? "Required"
                                  : "Optional"}
                              </span>
                            </div>

                            <p className="mt-3 whitespace-pre-wrap leading-8 text-slate-700">
                              {section.section_body}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => moveSection(section, -1)}
                              className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-black"
                            >
                              Up
                            </button>

                            <button
                              type="button"
                              onClick={() => moveSection(section, 1)}
                              className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-black"
                            >
                              Down
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteSection(section.id)}
                              className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <h3 className="text-2xl font-black">No sections yet</h3>

                    <p className="mt-3 text-slate-600">
                      Add the first section to build this lease template.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}