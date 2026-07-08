"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type LandlordVerification = {
  id: string;
  landlord_id: string;
  legal_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  verification_status: string;
  admin_note: string | null;
  submitted_at: string | null;
};

type LandlordDocument = {
  id: string;
  landlord_id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  verification_status: string;
  created_at: string;
};

const documentTypes = [
  { value: "government_id", label: "Government ID" },
  { value: "proof_of_ownership", label: "Proof of Property Ownership" },
  { value: "utility_bill", label: "Utility Bill" },
  { value: "tax_bill", label: "Tax Bill" },
  { value: "management_agreement", label: "Management Agreement" },
  { value: "company_document", label: "Company Document" },
  { value: "other", label: "Other Document" },
];

export default function LandlordVerificationPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [landlordId, setLandlordId] = useState("");
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");

  const [verification, setVerification] = useState<LandlordVerification | null>(
    null
  );
  const [documents, setDocuments] = useState<LandlordDocument[]>([]);

  const [legalName, setLegalName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [documentType, setDocumentType] = useState("government_id");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    loadVerification();
  }, []);

  async function loadVerification() {
    setLoading(true);

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
      .select("role, email, full_name, company_name, phone")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      setMessage("Could not load your profile.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    if (profile.role !== "landlord" && profile.role !== "admin") {
      setMessage("Only landlords can submit verification.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    setAllowed(true);

    const { data: verificationRow, error: verificationError } = await supabase
      .from("landlord_verifications")
      .select("*")
      .eq("landlord_id", user.id)
      .maybeSingle();

    if (verificationError) {
      setMessage(verificationError.message);
      setLoading(false);
      return;
    }

    if (verificationRow) {
      setVerification(verificationRow as LandlordVerification);
      setLegalName(verificationRow.legal_name || "");
      setCompanyName(verificationRow.company_name || "");
      setPhone(verificationRow.phone || "");
      setEmail(verificationRow.email || "");
    } else {
      setLegalName(profile.full_name || "");
      setCompanyName(profile.company_name || "");
      setPhone(profile.phone || "");
      setEmail(profile.email || user.email || "");
    }

    const { data: documentRows, error: documentsError } = await supabase
      .from("landlord_documents")
      .select("*")
      .eq("landlord_id", user.id)
      .order("created_at", { ascending: false });

    if (documentsError) {
      setMessage(documentsError.message);
      setLoading(false);
      return;
    }

    setDocuments((documentRows || []) as LandlordDocument[]);
    setLoading(false);
  }

  async function saveVerification(status = "incomplete") {
    if (!landlordId) {
      setMessage("Please log in first.");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      landlord_id: landlordId,
      legal_name: legalName.trim(),
      company_name: companyName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      verification_status: status,
      submitted_at: status === "pending_review" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("landlord_verifications")
      .upsert(payload, {
        onConflict: "landlord_id",
      });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setMessage(
      status === "pending_review"
        ? "Verification submitted for admin review."
        : "Verification information saved."
    );

    setSaving(false);
    loadVerification();
  }

  async function uploadDocument() {
    if (!landlordId) {
      setMessage("Please log in first.");
      return;
    }

    if (!selectedFile) {
      setMessage("Please choose a file.");
      return;
    }

    setUploading(true);
    setMessage("");

    const safeFileName = selectedFile.name
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9.\-_]/g, "");

    const filePath = `${landlordId}/${documentType}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("landlord-documents")
      .upload(filePath, selectedFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      setMessage(uploadError.message);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("landlord_documents")
      .insert({
        landlord_id: landlordId,
        document_type: documentType,
        file_name: selectedFile.name,
        file_path: filePath,
        verification_status: "uploaded",
      });

    if (insertError) {
      setMessage(insertError.message);
      setUploading(false);
      return;
    }

    setSelectedFile(null);
    setMessage("Document uploaded.");
    setUploading(false);
    loadVerification();
  }

  async function deleteDocument(document: LandlordDocument) {
    const confirmed = window.confirm("Delete this document?");
    if (!confirmed) return;

    const { error: storageError } = await supabase.storage
      .from("landlord-documents")
      .remove([document.file_path]);

    if (storageError) {
      setMessage(storageError.message);
      return;
    }

    const { error: deleteError } = await supabase
      .from("landlord_documents")
      .delete()
      .eq("id", document.id);

    if (deleteError) {
      setMessage(deleteError.message);
      return;
    }

    setMessage("Document deleted.");
    loadVerification();
  }

  async function openDocument(document: LandlordDocument) {
    const { data, error } = await supabase.storage
      .from("landlord-documents")
      .createSignedUrl(document.file_path, 60 * 10);

    if (error) {
      setMessage(error.message);
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  function getDocumentLabel(type: string) {
    return documentTypes.find((item) => item.value === type)?.label || type;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading verification...</h1>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Verification unavailable</h1>
          <p className="mt-3 text-slate-600">{message}</p>

          <Link
            href="/auth/login"
            className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
          >
            Login
          </Link>
        </div>
      </main>
    );
  }

  const status = verification?.verification_status || "incomplete";
  const statusLabel =
  status === "pending_review"
    ? "Pending Review"
    : status === "incomplete"
    ? "Incomplete"
    : status === "verified"
    ? "Verified"
    : status === "rejected"
    ? "Rejected"
    : status;

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/dashboard/landlord"
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Landlord Dashboard
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Keylo Verify
              </p>

              <h1 className="mt-3 text-5xl font-black tracking-tight">
                Landlord Verification
              </h1>

              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
                Verify your identity, company, and property ownership before
                submitting listings for approval.
              </p>
            </div>

            <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
  {statusLabel}
</span>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl bg-slate-100 px-5 py-4 font-bold text-slate-800">
              {message}
            </div>
          )}

          {verification?.admin_note && (
            <div className="mt-6 rounded-2xl bg-amber-50 px-5 py-4 font-bold text-amber-800">
              Admin note: {verification.admin_note}
            </div>
          )}

          <section className="mt-8">
            <h2 className="text-2xl font-black">Verification Info</h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Field
                label="Legal Name"
                value={legalName}
                onChange={setLegalName}
              />

              <Field
                label="Company Name"
                value={companyName}
                onChange={setCompanyName}
              />

              <Field label="Phone" value={phone} onChange={setPhone} />

              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => saveVerification("incomplete")}
                disabled={saving}
                className="rounded-full border border-slate-300 bg-white px-6 py-4 font-black text-slate-950 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>

              <button
                type="button"
                onClick={() => saveVerification("pending_review")}
                disabled={saving || documents.length === 0}
                className="rounded-full bg-slate-950 px-6 py-4 font-black text-white disabled:opacity-60"
              >
                {saving ? "Submitting..." : "Submit for Review"}
              </button>
            </div>

            {documents.length === 0 && (
              <p className="mt-3 text-sm font-bold text-slate-500">
                Upload at least one verification document before submitting.
              </p>
            )}
          </section>

          <section className="mt-10 rounded-3xl bg-[#f7f4ef] p-6">
            <h2 className="text-2xl font-black">Upload Document</h2>

            <div className="mt-5 grid gap-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">
                  Document Type
                </span>

                <select
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-500"
                >
                  {documentTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">
                  File
                </span>

                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(event) =>
                    setSelectedFile(event.target.files?.[0] || null)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-500"
                />
              </label>

              <button
                type="button"
                onClick={uploadDocument}
                disabled={uploading}
                className="rounded-full bg-slate-950 px-6 py-4 font-black text-white disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-2xl font-black">Uploaded Documents</h2>
          </div>

          {documents.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-black">
                        {getDocumentLabel(document.document_type)}
                      </h3>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                        {document.verification_status === "pending_review"
  ? "Pending Review"
  : document.verification_status === "uploaded"
  ? "Uploaded"
  : document.verification_status === "approved"
  ? "Approved"
  : document.verification_status === "rejected"
  ? "Rejected"
  : document.verification_status}
                      </span>
                    </div>

                    <p className="mt-2 font-bold text-slate-500">
                      {document.file_name}
                    </p>

                    <p className="mt-2 text-sm font-bold text-slate-500">
                      Uploaded{" "}
                      {new Date(document.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => openDocument(document)}
                      className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
                    >
                      View
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteDocument(document)}
                      className="rounded-full border border-red-200 bg-white px-5 py-3 text-center font-black text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">
                No verification documents uploaded yet
              </h3>

              <p className="mt-3 text-slate-600">
                Upload ID, ownership, company, or management documents to submit
                your landlord verification.
              </p>
            </div>
          )}
        </section>
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