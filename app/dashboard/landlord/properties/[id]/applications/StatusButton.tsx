"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type StatusButtonProps = {
  applicationId: string;
  status: string;
  label: string;
  variant?: "dark" | "light";
};

export default function StatusButton({
  applicationId,
  status,
  label,
  variant = "light",
}: StatusButtonProps) {
  const [saving, setSaving] = useState(false);

  async function updateStatus() {
    setSaving(true);

    const { error } = await supabase
      .from("applications")
      .update({ status })
      .eq("id", applicationId);

    if (error) {
      alert(`Error updating application: ${error.message}`);
      setSaving(false);
      return;
    }

    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={updateStatus}
      disabled={saving}
      className={
        variant === "dark"
          ? "rounded-full bg-slate-950 px-5 py-3 font-black text-white disabled:opacity-60"
          : "rounded-full border border-slate-300 bg-white px-5 py-3 font-black disabled:opacity-60"
      }
    >
      {saving ? "Saving..." : label}
    </button>
  );
}