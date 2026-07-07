"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ResubmitListingButtonProps = {
  propertyId: string;
};

export default function ResubmitListingButton({
  propertyId,
}: ResubmitListingButtonProps) {
  const [saving, setSaving] = useState(false);

  async function resubmitListing() {
    const confirmed = window.confirm(
      "Resubmit this listing for admin review?"
    );

    if (!confirmed) return;

    setSaving(true);

    const { error } = await supabase
      .from("properties")
      .update({
        status: "pending",
        rejection_note: null,
      })
      .eq("id", propertyId);

    if (error) {
      alert(`Could not resubmit listing: ${error.message}`);
      setSaving(false);
      return;
    }

    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={resubmitListing}
      disabled={saving}
      className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white disabled:opacity-60"
    >
      {saving ? "Submitting..." : "Resubmit for Review"}
    </button>
  );
}