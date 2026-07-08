"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function safeNextPath(next: string | null) {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  return next;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginLoading() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] px-6 py-12 text-slate-950">
      <div className="mx-auto max-w-md">
        <div className="rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading login...</h1>
        </div>
      </div>
    </main>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = safeNextPath(searchParams.get("next"));
  const isCompanyInvite = !!nextPath?.startsWith("/company-invites/");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loggingIn, setLoggingIn] = useState(false);
  const [message, setMessage] = useState("");

  async function login() {
    setLoggingIn(true);
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setMessage("Please enter your email and password.");
      setLoggingIn(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoggingIn(false);
      return;
    }

    const user = data.user;

    if (!user) {
      setMessage("Login failed. Please try again.");
      setLoggingIn(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      setMessage("Login worked, but we could not find your profile.");
      setLoggingIn(false);
      return;
    }

    if (nextPath) {
      router.push(nextPath);
      return;
    }

    if (profile.role === "admin") {
      router.push("/admin");
      return;
    }

    if (profile.role === "landlord") {
      router.push("/dashboard/landlord");
      return;
    }

    router.push("/dashboard/tenant");
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] px-6 py-12 text-slate-950">
      <div className="mx-auto max-w-md">
        <div className="rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Login
          </p>

          <h1 className="mt-3 text-5xl font-black tracking-tight">
            Welcome back
          </h1>

          <p className="mt-4 leading-7 text-slate-600">
            {isCompanyInvite
              ? "Log in to continue accepting your landlord company invite."
              : "Log in to manage your rentals, applications, saved listings, or admin tools."}
          </p>

          {isCompanyInvite && (
            <div className="mt-6 rounded-2xl bg-blue-50 px-5 py-4 font-bold text-blue-800 ring-1 ring-blue-200">
              After login, you’ll return to the invite page to join the company.
            </div>
          )}

          {message && (
            <div className="mt-6 rounded-2xl bg-slate-100 px-5 py-4 font-bold text-slate-800">
              {message}
            </div>
          )}

          <div className="mt-8 grid gap-5">
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
              <label className="mb-2 block text-sm font-black">Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                placeholder="Password"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={login}
            disabled={loggingIn}
            className="mt-8 w-full rounded-full bg-slate-950 px-6 py-4 font-black text-white disabled:opacity-60"
          >
            {loggingIn
              ? "Logging in..."
              : isCompanyInvite
                ? "Login & Continue to Invite"
                : "Login"}
          </button>

          <p className="mt-6 text-center text-sm font-bold text-slate-500">
            New to Keylo?{" "}
            <Link
              href={
                nextPath
                  ? `/auth/signup?next=${encodeURIComponent(nextPath)}`
                  : "/auth/signup"
              }
              className="text-slate-950 underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}