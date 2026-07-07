"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AdminListingStatusButtonProps = {
  propertyId: string;
  status: "draft" | "pending" | "published" | "paused" | "archived" | "rejected";
  label: string;
  variant?: "dark" | "light";
};

export default function AdminListingStatusButton({
  propertyId,
  status,
  label,
  variant = "light",
}: AdminListingStatusButtonProps) {
  const [saving, setSaving] = useState(false);

  async function updateStatus() {
    const confirmed = window.confirm(`Change listing status to ${status}?`);
    if (!confirmed) return;

    setSaving(true);

    const { error } = await supabase
      .from("properties")
      .update({
        status,
      })
      .eq("id", propertyId);

    if (error) {
      alert(`Could not update listing: ${error.message}`);
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
          ? "rounded-full bg-slate-950 px-4 py-2 text-center text-sm font-black text-white disabled:opacity-60"
          : "rounded-full border border-slate-300 bg-white px-4 py-2 text-center text-sm font-black text-slate-950 disabled:opacity-60"
      }
    >
      {saving ? "Saving..." : label}
    </button>
  );
}