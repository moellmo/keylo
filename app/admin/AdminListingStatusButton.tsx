"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createNotification } from "@/lib/createNotification";

type AdminListingStatusButtonProps = {
  propertyId: string;
  status: "draft" | "pending" | "published" | "paused" | "archived" | "rejected";
  label: string;
  variant?: "dark" | "light";
};

type UpdatedProperty = {
  id: string;
  title: string | null;
  landlord_id: string | null;
};

function getNotificationCopy(
  status: AdminListingStatusButtonProps["status"],
  title: string
) {
  if (status === "published") {
    return {
      title: "Listing approved",
      message: `Your listing "${title}" has been approved and is now live.`,
      type: "listing_approved",
      targetPath: "preview",
    };
  }

  if (status === "rejected") {
    return {
      title: "Listing rejected",
      message: `Your listing "${title}" was rejected. Please review and update it.`,
      type: "listing_rejected",
      targetPath: "edit",
    };
  }

  if (status === "pending") {
    return {
      title: "Listing submitted for review",
      message: `Your listing "${title}" is now pending admin review.`,
      type: "listing_pending",
      targetPath: "preview",
    };
  }

  if (status === "paused") {
    return {
      title: "Listing paused",
      message: `Your listing "${title}" has been paused.`,
      type: "listing_paused",
      targetPath: "preview",
    };
  }

  if (status === "archived") {
    return {
      title: "Listing archived",
      message: `Your listing "${title}" has been archived.`,
      type: "listing_archived",
      targetPath: "preview",
    };
  }

  return {
    title: "Listing updated",
    message: `Your listing "${title}" was updated.`,
    type: "listing_updated",
    targetPath: "preview",
  };
}

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

    const { data, error } = await supabase
      .from("properties")
      .update({
        status,
      })
      .eq("id", propertyId)
      .select("id, title, landlord_id")
      .single();

    if (error) {
      alert(`Could not update listing: ${error.message}`);
      setSaving(false);
      return;
    }

    const updatedProperty = data as UpdatedProperty;
    const listingTitle = updatedProperty.title || "your listing";

    if (updatedProperty.landlord_id) {
      const notification = getNotificationCopy(status, listingTitle);

      await createNotification({
  userId: updatedProperty.landlord_id,
  title: notification.title,
  message: notification.message,
  type: notification.type,
  targetUrl: `/dashboard/landlord/properties/${updatedProperty.id}/${notification.targetPath}`,
  dedupe: true,
});
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