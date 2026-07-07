"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Loading dashboard...");

  useEffect(() => {
    async function loadDashboard() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (error || !profile) {
        setMessage(
          "Your account exists, but no profile role was found. Check the profiles table in Supabase."
        );
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

      if (profile.role === "tenant") {
        router.push("/dashboard/tenant");
        return;
      }

      setMessage(`Unknown role: ${profile.role}`);
    }

    loadDashboard();
  }, [router]);

  return (
    <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <h1 className="text-3xl font-black">{message}</h1>

        <Link
          href="/auth/login"
          className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
        >
          Back to Login
        </Link>
      </div>
    </main>
  );
}