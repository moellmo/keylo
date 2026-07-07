"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type SaveListingButtonProps = {
  propertyId: string;
};

export default function SaveListingButton({
  propertyId,
}: SaveListingButtonProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function saveListing() {
    setSaving(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please log in as a tenant to save listings.");
      setSaving(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "tenant" && profile?.role !== "admin") {
      setMessage("Only tenant accounts can save listings.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("saved_listings").insert({
      tenant_id: user.id,
      property_id: propertyId,
    });

    if (error) {
      if (
        error.message.includes("duplicate") ||
        error.message.includes("unique")
      ) {
        setMessage("This listing is already saved.");
      } else {
        setMessage(`Could not save listing: ${error.message}`);
      }

      setSaving(false);
      return;
    }

    setMessage("Listing saved.");
    setSaving(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={saveListing}
        disabled={saving}
        className="w-full rounded-full border border-slate-300 bg-white px-6 py-4 font-black text-slate-950 disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save Listing"}
      </button>

      {message && (
        <p className="mt-3 text-center text-sm font-bold text-slate-600">
          {message}
        </p>
      )}
    </div>
  );
}