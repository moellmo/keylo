"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createNotification } from "@/lib/createNotification";

type StatusButtonProps = {
  applicationId: string;
  status: string;
  label: string;
  variant?: "dark" | "light";
};

type UpdatedApplication = {
  id: string;
  tenant_id: string;
  property_id: string;
  properties:
    | {
        title: string | null;
      }
    | {
        title: string | null;
      }[]
    | null;
};

function getPropertyTitle(application: UpdatedApplication) {
  if (Array.isArray(application.properties)) {
    return application.properties[0]?.title || "the rental";
  }

  return application.properties?.title || "the rental";
}

function getNotificationCopy(status: string, propertyTitle: string) {
  if (status === "reviewing") {
    return {
      title: "Application under review",
      message: `Your application for ${propertyTitle} is now being reviewed.`,
      type: "application_reviewing",
    };
  }

  if (status === "approved") {
    return {
      title: "Application approved",
      message: `Good news — your application for ${propertyTitle} was approved.`,
      type: "application_approved",
    };
  }

  if (status === "declined") {
    return {
      title: "Application declined",
      message: `Your application for ${propertyTitle} was declined.`,
      type: "application_declined",
    };
  }

  return {
    title: "Application updated",
    message: `Your application for ${propertyTitle} was updated.`,
    type: "application_updated",
  };
}

export default function StatusButton({
  applicationId,
  status,
  label,
  variant = "light",
}: StatusButtonProps) {
  const [saving, setSaving] = useState(false);

  async function updateStatus() {
    setSaving(true);

    const { data, error } = await supabase
      .from("applications")
      .update({ status })
      .eq("id", applicationId)
      .select(
        `
        id,
        tenant_id,
        property_id,
        properties (
          title
        )
      `
      )
      .single();

    if (error) {
      alert(`Error updating application: ${error.message}`);
      setSaving(false);
      return;
    }

    const updatedApplication = data as unknown as UpdatedApplication;
    const propertyTitle = getPropertyTitle(updatedApplication);
    const notification = getNotificationCopy(status, propertyTitle);

    await createNotification({
      userId: updatedApplication.tenant_id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      targetUrl: `/dashboard/tenant/applications/${updatedApplication.id}`,
      dedupe: true,
    });

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