"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type RemoveSavedListingButtonProps = {
  savedListingId: string;
};

export default function RemoveSavedListingButton({
  savedListingId,
}: RemoveSavedListingButtonProps) {
  const [saving, setSaving] = useState(false);

  async function removeSavedListing() {
    const confirmed = window.confirm("Remove this saved listing?");
    if (!confirmed) return;

    setSaving(true);

    const { error } = await supabase
      .from("saved_listings")
      .delete()
      .eq("id", savedListingId);

    if (error) {
      alert(`Could not remove saved listing: ${error.message}`);
      setSaving(false);
      return;
    }

    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={removeSavedListing}
      disabled={saving}
      className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black disabled:opacity-60"
    >
      {saving ? "Removing..." : "Remove"}
    </button>
  );
}