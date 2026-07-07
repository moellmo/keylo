"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type RejectListingButtonProps = {
  propertyId: string;
};

export default function RejectListingButton({
  propertyId,
}: RejectListingButtonProps) {
  const [saving, setSaving] = useState(false);

  async function rejectListing() {
    const reason = window.prompt(
      "Why are you rejecting this listing? This note will be shown to the landlord."
    );

    if (!reason) return;

    setSaving(true);

    const { error } = await supabase
      .from("properties")
      .update({
        status: "rejected",
        rejection_note: reason,
      })
      .eq("id", propertyId);

    if (error) {
      alert(`Could not reject listing: ${error.message}`);
      setSaving(false);
      return;
    }

    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={rejectListing}
      disabled={saving}
      className="rounded-full border border-red-200 bg-white px-4 py-2 text-center text-sm font-black text-red-700 disabled:opacity-60"
    >
      {saving ? "Rejecting..." : "Reject"}
    </button>
  );
}