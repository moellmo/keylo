"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createNotification } from "@/lib/createNotification";

type RejectListingButtonProps = {
  propertyId: string;
};

type UpdatedProperty = {
  id: string;
  title: string | null;
  landlord_id: string | null;
  rejection_note: string | null;
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

    const { data, error } = await supabase
      .from("properties")
      .update({
        status: "rejected",
        rejection_note: reason,
      })
      .eq("id", propertyId)
      .select("id, title, landlord_id, rejection_note")
      .single();

    if (error) {
      alert(`Could not reject listing: ${error.message}`);
      setSaving(false);
      return;
    }

    const updatedProperty = data as UpdatedProperty;

    if (updatedProperty.landlord_id) {
     await createNotification({
  userId: updatedProperty.landlord_id,
  title: "Listing rejected",
  message: `Your listing "${
    updatedProperty.title || "your listing"
  }" was rejected. Reason: ${reason}`,
  type: "listing_rejected",
  targetUrl: `/dashboard/landlord/properties/${updatedProperty.id}/edit`,
  dedupe: true,
});
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