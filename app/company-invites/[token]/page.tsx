"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type InvitePreview = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  landlord_companies:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};

function getCompany(invite: InvitePreview | null) {
  if (!invite) return null;

  if (Array.isArray(invite.landlord_companies)) {
    return invite.landlord_companies[0] || null;
  }

  return invite.landlord_companies;
}

function roleLabel(role: string) {
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  if (role === "maintenance") return "Maintenance";
  if (role === "accounting") return "Accounting";
  if (role === "viewer") return "Viewer";

  return role.replaceAll("_", " ");
}

export default function CompanyInvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  const [loggedIn, setLoggedIn] = useState(false);
  const [currentEmail, setCurrentEmail] = useState("");
  const [invite, setInvite] = useState<InvitePreview | null>(null);

  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadInvite();
  }, []);

  async function loadInvite() {
    setLoading(true);
    setMessage("");
    setSuccessMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setLoggedIn(!!user);
    setCurrentEmail(user?.email || "");

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("landlord_company_invites")
      .select(
        `
        id,
        email,
        role,
        status,
        expires_at,
        landlord_companies (
          id,
          name
        )
      `
      )
      .eq("token", token)
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setInvite((data || null) as unknown as InvitePreview | null);
    setLoading(false);
  }

  async function acceptInvite() {
    setAccepting(true);
    setMessage("");
    setSuccessMessage("");

    const { data, error } = await supabase.rpc(
      "accept_landlord_company_invite",
      {
        invite_token: token,
      }
    );

    if (error) {
      setMessage(error.message);
      setAccepting(false);
      return;
    }

    const result = Array.isArray(data) ? data[0] : null;

    setSuccessMessage(
      result?.company_name
        ? `Invite accepted. You joined ${result.company_name}.`
        : "Invite accepted."
    );

    await loadInvite();
    setAccepting(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-black sm:text-3xl">
            Loading invite...
          </h1>
        </div>
      </main>
    );
  }

  const company = getCompany(invite);
  const inviteExpired =
    invite?.expires_at && new Date(invite.expires_at).getTime() < Date.now();

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-16">
        <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <Link href="/" className="text-sm font-bold text-slate-600">
            ← Back to Home
          </Link>

          <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Company Invite
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Join landlord team
          </h1>

          {!loggedIn ? (
            <>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Log in or create an account with the email address that received
                this invite. Then return to this invite page to accept it.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <Link
                  href={`/auth/login?next=/company-invites/${token}`}
                  className="rounded-full bg-slate-950 px-6 py-4 text-center font-black text-white"
                >
                  Login
                </Link>

                <Link
                  href={`/auth/signup?next=/company-invites/${token}`}
                  className="rounded-full border border-slate-300 bg-white px-6 py-4 text-center font-black text-slate-950"
                >
                  Create Account
                </Link>
              </div>
            </>
          ) : invite ? (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <InfoCard title="Company" value={company?.name || "Unknown"} />
                <InfoCard title="Role" value={roleLabel(invite.role)} />
                <InfoCard title="Invite Email" value={invite.email} />
                <InfoCard title="Signed In As" value={currentEmail} />
              </div>

              {invite.status !== "pending" && (
                <div className="mt-6 rounded-2xl bg-yellow-50 px-5 py-4 font-bold text-yellow-800 ring-1 ring-yellow-200">
                  This invite is currently marked as {invite.status}.
                </div>
              )}

              {inviteExpired && invite.status === "pending" && (
                <div className="mt-6 rounded-2xl bg-red-50 px-5 py-4 font-bold text-red-700 ring-1 ring-red-200">
                  This invite has expired. Ask the company admin to send a new
                  invite.
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

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {invite.status === "pending" && !inviteExpired && (
                  <button
                    type="button"
                    onClick={acceptInvite}
                    disabled={accepting}
                    className="rounded-full bg-slate-950 px-6 py-4 text-center font-black text-white disabled:opacity-60"
                  >
                    {accepting ? "Accepting..." : "Accept Invite"}
                  </button>
                )}

                <Link
                  href="/dashboard/landlord/company"
                  className="rounded-full border border-slate-300 bg-white px-6 py-4 text-center font-black text-slate-950"
                >
                  Company Dashboard
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                We could not find an active invite for this account.
              </p>

              {message && (
                <div className="mt-6 rounded-2xl bg-red-50 px-5 py-4 font-bold text-red-700 ring-1 ring-red-200">
                  {message}
                </div>
              )}

              <Link
                href="/dashboard"
                className="mt-8 inline-flex rounded-full bg-slate-950 px-6 py-4 font-black text-white"
              >
                Go to Dashboard
              </Link>
            </>
          )}
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
      <p className="mt-2 break-words text-xl font-black">{value}</p>
    </div>
  );
}