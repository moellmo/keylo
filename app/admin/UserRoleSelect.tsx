"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type UserRoleSelectProps = {
  userId: string;
  currentRole: string;
};

export default function UserRoleSelect({
  userId,
  currentRole,
}: UserRoleSelectProps) {
  const [role, setRole] = useState(currentRole || "tenant");
  const [saving, setSaving] = useState(false);

  async function updateRole(newRole: string) {
    const confirmed = window.confirm(`Change this user to ${newRole}?`);
    if (!confirmed) return;

    setSaving(true);
    setRole(newRole);

    const { error } = await supabase
      .from("profiles")
      .update({
        role: newRole,
      })
      .eq("id", userId);

    if (error) {
      alert(`Could not update role: ${error.message}`);
      setRole(currentRole || "tenant");
      setSaving(false);
      return;
    }

    setSaving(false);
    window.location.reload();
  }

  return (
    <select
      value={role}
      onChange={(e) => updateRole(e.target.value)}
      disabled={saving}
      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black disabled:opacity-60"
    >
      <option value="tenant">Tenant</option>
      <option value="landlord">Landlord</option>
      <option value="admin">Admin</option>
    </select>
  );
}