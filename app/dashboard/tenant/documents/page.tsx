"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TenantDocument = {
  id: string;
  tenant_id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_url: string;
  verification_status: string;
  created_at: string;
};

const documentTypes = [
  {
    value: "government_id",
    label: "Government ID",
  },
  {
    value: "proof_of_income",
    label: "Proof of Income",
  },
  {
    value: "rental_history",
    label: "Rental History",
  },
  {
    value: "other",
    label: "Other Document",
  },
];

export default function TenantDocumentsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
          <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <h1 className="text-3xl font-black">Loading documents...</h1>
          </div>
        </main>
      }
    >
      <TenantDocumentsContent />
    </Suspense>
  );
}

function TenantDocumentsContent() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [documents, setDocuments] = useState<TenantDocument[]>([]);
  const [documentType, setDocumentType] = useState("government_id");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const searchParams = useSearchParams();
const returnTo = searchParams.get("returnTo") || "/dashboard/tenant";

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please log in to manage your documents.");
      setLoading(false);
      return;
    }

    setTenantId(user.id);

    const { data, error } = await supabase
      .from("tenant_documents")
      .select("*")
      .eq("tenant_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setDocuments((data || []) as TenantDocument[]);
    setLoading(false);
  }

  async function uploadDocument() {
    if (!tenantId) {
      setMessage("Please log in first.");
      return;
    }

    if (!selectedFile) {
      setMessage("Please choose a file to upload.");
      return;
    }

    setUploading(true);
    setMessage("");

    const safeFileName = selectedFile.name
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9.\-_]/g, "");

    const filePath = `${tenantId}/${documentType}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("tenant-documents")
      .upload(filePath, selectedFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      setMessage(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage
        .from("tenant-documents")
        .createSignedUrl(filePath, 60 * 60);

    if (signedUrlError) {
      setMessage(signedUrlError.message);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("tenant_documents")
      .insert({
        tenant_id: tenantId,
        document_type: documentType,
        file_name: selectedFile.name,
        file_path: filePath,
        file_url: signedUrlData.signedUrl,
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
    loadDocuments();
  }

  async function deleteDocument(document: TenantDocument) {
    const confirmed = window.confirm("Delete this document?");
    if (!confirmed) return;

    const { error: storageError } = await supabase.storage
      .from("tenant-documents")
      .remove([document.file_path]);

    if (storageError) {
      setMessage(storageError.message);
      return;
    }

    const { error: deleteError } = await supabase
      .from("tenant_documents")
      .delete()
      .eq("id", document.id);

    if (deleteError) {
      setMessage(deleteError.message);
      return;
    }

    setMessage("Document deleted.");
    loadDocuments();
  }

  function getDocumentLabel(type: string) {
    return (
      documentTypes.find((documentType) => documentType.value === type)?.label ||
      type
    );
  }

  async function openDocument(document: TenantDocument) {
    const { data, error } = await supabase.storage
      .from("tenant-documents")
      .createSignedUrl(document.file_path, 60 * 10);

    if (error) {
      setMessage(error.message);
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading documents...</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link href={returnTo} className="text-sm font-bold text-slate-600">
  ← {returnTo.startsWith("/apply/") ? "Back to Application" : "Back to Tenant Dashboard"}
</Link>

        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Keylo Verify
          </p>

          <h1 className="mt-3 text-5xl font-black tracking-tight">
            Tenant Documents
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            Upload documents once and reuse them for rental applications,
            verification, screening, and lease approvals.
          </p>

          {message && (
            <div className="mt-6 rounded-2xl bg-slate-100 px-5 py-4 font-bold text-slate-800">
              {message}
            </div>
          )}

                   <div className="mt-8 rounded-3xl bg-[#f7f4ef] p-6">
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
          </div>

          <Link
            href={returnTo}
            className="mt-6 flex w-full justify-center rounded-full border border-slate-300 bg-white px-6 py-4 font-black text-slate-950"
          >
            {returnTo.startsWith("/apply/")
              ? "Continue Application"
              : "Back to Dashboard"}
          </Link>
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
                        {document.verification_status}
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
              <h3 className="text-2xl font-black">No documents uploaded yet</h3>

              <p className="mt-3 text-slate-600">
                Upload your ID, income proof, and rental documents to make future
                applications faster.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}