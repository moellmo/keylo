"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type UserRole = "tenant" | "landlord";

function safeNextPath(next: string | null) {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  return next;
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupLoading />}>
      <SignupContent />
    </Suspense>
  );
}

function SignupLoading() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] px-6 py-12 text-slate-950">
      <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <h1 className="text-3xl font-black">Loading signup...</h1>
      </div>
    </main>
  );
}

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = safeNextPath(searchParams.get("next"));
  const isCompanyInvite = !!nextPath?.startsWith("/company-invites/");

  const [role, setRole] = useState<UserRole>(
    isCompanyInvite ? "landlord" : "tenant"
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function createAccount() {
    setSaving(true);
    setMessage("");

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setMessage("Please fill in your name, email, and password.");
      setSaving(false);
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      setSaving(false);
      return;
    }

    const finalRole: UserRole = isCompanyInvite ? "landlord" : role;

    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: finalRole,
        },
      },
    });

    if (signupError) {
      setMessage(signupError.message);
      setSaving(false);
      return;
    }

    const user = signupData.user;

    if (!user) {
      setMessage("Account created. Please check your email to confirm your account.");
      setSaving(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      email: email.trim(),
      full_name: fullName.trim(),
      role: finalRole,
    });

    if (profileError) {
      setMessage(
        `Account created, but profile could not be saved: ${profileError.message}`
      );
      setSaving(false);
      return;
    }

    setMessage("Account created successfully.");

    if (nextPath) {
      router.push(nextPath);
      return;
    }

    if (finalRole === "landlord") {
      router.push("/dashboard/landlord");
      return;
    }

    router.push("/dashboard/tenant");
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] px-6 py-12 text-slate-950">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-start">
          <section className="rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Create Account
            </p>

            <h1 className="mt-3 text-5xl font-black tracking-tight">
              Join Keylo
            </h1>

            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              {isCompanyInvite
                ? "Create your account to accept this landlord company invite."
                : "Choose the account type that matches how you want to use Keylo."}
            </p>

            {message && (
              <div className="mt-6 rounded-2xl bg-slate-100 px-5 py-4 font-bold text-slate-800">
                {message}
              </div>
            )}

            {isCompanyInvite ? (
              <div className="mt-8 rounded-3xl bg-blue-50 p-6 text-blue-900 ring-1 ring-blue-200">
                <p className="text-xl font-black">Landlord Team Invite</p>
                <p className="mt-2 text-sm leading-6">
                  This account will be created as a landlord account so you can
                  join the company team after signup.
                </p>
              </div>
            ) : (
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRole("tenant")}
                  className={`rounded-3xl border p-6 text-left transition ${
                    role === "tenant"
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-950 hover:border-slate-400"
                  }`}
                >
                  <p className="text-xl font-black">I’m a Tenant</p>
                  <p
                    className={`mt-2 text-sm leading-6 ${
                      role === "tenant" ? "text-slate-200" : "text-slate-600"
                    }`}
                  >
                    Browse rentals, save listings, apply online, and track your
                    applications.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setRole("landlord")}
                  className={`rounded-3xl border p-6 text-left transition ${
                    role === "landlord"
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-950 hover:border-slate-400"
                  }`}
                >
                  <p className="text-xl font-black">I’m a Landlord</p>
                  <p
                    className={`mt-2 text-sm leading-6 ${
                      role === "landlord" ? "text-slate-200" : "text-slate-600"
                    }`}
                  >
                    Post rentals, manage listings, and review tenant applications.
                  </p>
                </button>
              </div>
            )}

            <div className="mt-8 grid gap-5">
              <div>
                <label className="mb-2 block text-sm font-black">
                  Full name
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-black">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-black">
                  Password
                </label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                  placeholder="Minimum 6 characters"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={createAccount}
              disabled={saving}
              className="mt-8 w-full rounded-full bg-slate-950 px-6 py-4 font-black text-white disabled:opacity-60"
            >
              {saving
                ? "Creating account..."
                : isCompanyInvite
                  ? "Create Account & Continue to Invite"
                  : role === "landlord"
                    ? "Create Landlord Account"
                    : "Create Tenant Account"}
            </button>

            <p className="mt-6 text-center text-sm font-bold text-slate-500">
              Already have an account?{" "}
              <Link
                href={
                  nextPath
                    ? `/auth/login?next=${encodeURIComponent(nextPath)}`
                    : "/auth/login"
                }
                className="text-slate-950 underline"
              >
                Login
              </Link>
            </p>
          </section>

          <aside className="rounded-[2rem] bg-slate-950 p-8 text-white">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">
              Keylo Phase 1
            </p>

            <h2 className="mt-3 text-3xl font-black">
              One account, the right dashboard.
            </h2>

            <div className="mt-8 space-y-5">
              <div className="rounded-3xl bg-white/10 p-5">
                <p className="font-black">Tenants</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Save rentals, apply online, and track application status.
                </p>
              </div>

              <div className="rounded-3xl bg-white/10 p-5">
                <p className="font-black">Landlords</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Submit rental listings for approval and review applicants.
                </p>
              </div>

              <div className="rounded-3xl bg-white/10 p-5">
                <p className="font-black">Company Teams</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Join a landlord company to help manage listings,
                  applications, leases, payments, and maintenance.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}