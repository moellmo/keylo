"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LogoutButton() {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await supabase.auth.signOut();

      // Force a clean full-page reload so Header/user state resets everywhere.
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      alert("Could not log out. Please try again.");
      setLoggingOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
    >
      {loggingOut ? "Signing out..." : "Logout"}
    </button>
  );
}