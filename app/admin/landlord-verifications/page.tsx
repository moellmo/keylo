"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createNotification } from "@/lib/createNotification";

type Verification = {
  id: string;
  landlord_id: string;
  legal_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  verification_status: string;
  admin_note: string | null;
  submitted_at: string | null;
  created_at: string;
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

const documentLabels: Record<string, string> = {
  government_id: "Government ID",
  proof_of_ownership: "Proof of Property Ownership",
  utility_bill: "Utility Bill",
  tax_bill: "Tax Bill",
  management_agreement: "Management Agreement",
  company_document: "Company Document",
  other: "Other Document",
};

function formatStatus(status: string) {
  if (status === "pending_review") return "Pending Review";
  if (status === "incomplete") return "Incomplete";
  if (status === "verified") return "Verified";
  if (status === "rejected") return "Rejected";
  if (status === "uploaded") return "Uploaded";
  if (status === "approved") return "Approved";

  return status;
}

export default function AdminLandlordVerificationsPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");

  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [documents, setDocuments] = useState<LandlordDocument[]>([]);
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    loadVerifications();
  }, []);

  async function loadVerifications() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please log in as admin.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      setMessage("Only admins can view landlord verifications.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    setAllowed(true);

    const { data: verificationRows, error: verificationError } = await supabase
      .from("landlord_verifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (verificationError) {
      setMessage(verificationError.message);
      setLoading(false);
      return;
    }

    const { data: documentRows, error: documentsError } = await supabase
      .from("landlord_documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (documentsError) {
      setMessage(documentsError.message);
      setLoading(false);
      return;
    }

    setVerifications((verificationRows || []) as Verification[]);
    setDocuments((documentRows || []) as LandlordDocument[]);
    setLoading(false);
  }

  function getDocumentsForLandlord(landlordId: string) {
    return documents.filter((document) => document.landlord_id === landlordId);
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

  async function updateVerification(
    verification: Verification,
    status: "verified" | "rejected"
  ) {
    let adminNote = verification.admin_note || "";

    if (status === "rejected") {
      const note = window.prompt(
        "Why is this landlord verification rejected?",
        verification.admin_note || ""
      );

      if (note === null) return;

      adminNote = note;
    }

    const confirmed = window.confirm(
      status === "verified"
        ? "Approve this landlord verification?"
        : "Reject this landlord verification?"
    );

    if (!confirmed) return;

    setSavingId(verification.id);
    setMessage("");

    const { error } = await supabase
      .from("landlord_verifications")
      .update({
        verification_status: status,
        admin_note: adminNote,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", verification.id);

    if (error) {
      setMessage(error.message);
      setSavingId("");
      return;
    }

    if (status === "verified") {
      await createNotification({
  userId: verification.landlord_id,
  title: "Landlord verification approved",
  message:
    "Your landlord verification was approved. You can now submit listings for review.",
  type: "landlord_verification_approved",
  targetUrl: "/dashboard/landlord/verification",
  dedupe: true,
});
    }

    if (status === "rejected") {
      await createNotification({
  userId: verification.landlord_id,
  title: "Landlord verification rejected",
  message: adminNote
    ? `Your landlord verification was rejected. Reason: ${adminNote}`
    : "Your landlord verification was rejected. Please review and resubmit your information.",
  type: "landlord_verification_rejected",
  targetUrl: "/dashboard/landlord/verification",
  dedupe: true,
});
    }

    setSavingId("");
    setMessage(
      status === "verified"
        ? "Landlord verification approved."
        : "Landlord verification rejected."
    );

    loadVerifications();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading verifications...</h1>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Admin only</h1>

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

  const pendingCount = verifications.filter(
    (verification) => verification.verification_status === "pending_review"
  ).length;

  const verifiedCount = verifications.filter(
    (verification) => verification.verification_status === "verified"
  ).length;

  const rejectedCount = verifications.filter(
    (verification) => verification.verification_status === "rejected"
  ).length;

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link href="/admin" className="text-sm font-bold text-slate-600">
          ← Back to Admin Dashboard
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Admin Review
          </p>

          <h1 className="mt-3 text-5xl font-black tracking-tight">
            Landlord Verifications
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            Review landlord identity, company, and ownership documents before
            allowing verified listing activity.
          </p>

          {message && (
            <div className="mt-6 rounded-2xl bg-slate-100 px-5 py-4 font-bold text-slate-800">
              {message}
            </div>
          )}

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <div className="rounded-3xl bg-[#f7f4ef] p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Pending
              </p>
              <p className="mt-3 text-4xl font-black">{pendingCount}</p>
            </div>

            <div className="rounded-3xl bg-[#f7f4ef] p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Verified
              </p>
              <p className="mt-3 text-4xl font-black">{verifiedCount}</p>
            </div>

            <div className="rounded-3xl bg-[#f7f4ef] p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Rejected
              </p>
              <p className="mt-3 text-4xl font-black">{rejectedCount}</p>
            </div>
          </div>
        </div>

        <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-2xl font-black">All Landlord Verifications</h2>
          </div>

          {verifications.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {verifications.map((verification) => {
                const landlordDocuments = getDocumentsForLandlord(
                  verification.landlord_id
                );

                return (
                  <div key={verification.id} className="p-6">
                    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-2xl font-black">
                            {verification.legal_name || "Unnamed Landlord"}
                          </h3>

                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                            {formatStatus(verification.verification_status)}
                          </span>
                        </div>

                        <p className="mt-2 font-bold text-slate-600">
                          {verification.company_name || "No company"} ·{" "}
                          {verification.email || "No email"} ·{" "}
                          {verification.phone || "No phone"}
                        </p>

                        <p className="mt-2 text-sm font-bold text-slate-500">
                          Submitted:{" "}
                          {verification.submitted_at
                            ? new Date(
                                verification.submitted_at
                              ).toLocaleDateString()
                            : "Not submitted"}
                        </p>

                        {verification.admin_note && (
                          <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 font-bold text-amber-800">
                            Admin note: {verification.admin_note}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={() =>
                            updateVerification(verification, "verified")
                          }
                          disabled={savingId === verification.id}
                          className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white disabled:opacity-60"
                        >
                          {savingId === verification.id
                            ? "Saving..."
                            : "Approve"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updateVerification(verification, "rejected")
                          }
                          disabled={savingId === verification.id}
                          className="rounded-full border border-red-200 bg-white px-5 py-3 text-center font-black text-red-700 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 rounded-3xl bg-[#f7f4ef] p-5">
                      <h4 className="font-black">
                        Documents ({landlordDocuments.length})
                      </h4>

                      {landlordDocuments.length > 0 ? (
                        <div className="mt-4 grid gap-3">
                          {landlordDocuments.map((document) => (
                            <div
                              key={document.id}
                              className="flex flex-col gap-3 rounded-2xl bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <p className="font-black">
                                  {documentLabels[document.document_type] ||
                                    document.document_type}
                                </p>

                                <p className="mt-1 text-sm font-bold text-slate-500">
                                  {document.file_name} ·{" "}
                                  {formatStatus(document.verification_status)}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => openDocument(document)}
                                className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-black text-white"
                              >
                                View Document
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 font-bold text-slate-500">
                          No documents uploaded.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">
                No landlord verifications yet
              </h3>

              <p className="mt-3 text-slate-600">
                Submitted landlord verifications will appear here.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}