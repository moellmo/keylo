"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ArchiveListingButtonProps = {
  propertyId: string;
};

export default function ArchiveListingButton({
  propertyId,
}: ArchiveListingButtonProps) {
  const [saving, setSaving] = useState(false);

  async function archiveListing() {
    const confirmed = window.confirm(
      "Archive this listing? It will be removed from public search but kept in your dashboard."
    );

    if (!confirmed) return;

    setSaving(true);

    const { error } = await supabase
      .from("properties")
      .update({ status: "archived" })
      .eq("id", propertyId);

    if (error) {
      alert(`Error archiving listing: ${error.message}`);
      setSaving(false);
      return;
    }

    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={archiveListing}
      disabled={saving}
      className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black disabled:opacity-60"
    >
      {saving ? "Archiving..." : "Archive"}
    </button>
  );
}