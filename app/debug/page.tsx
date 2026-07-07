"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function DebugPage() {
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    async function loadDebug() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      let profile = null;
      let profileError = null;

      if (user) {
        const result = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        profile = result.data;
        profileError = result.error;
      }

      setInfo({
        userError,
        user,
        profile,
        profileError,
      });
    }

    loadDebug();
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f4ef] p-8 text-slate-950">
      <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-3xl font-black">Keylo Debug</h1>

        <pre className="mt-6 overflow-auto rounded-2xl bg-slate-950 p-5 text-sm text-white">
          {JSON.stringify(info, null, 2)}
        </pre>
      </div>
    </main>
  );
}