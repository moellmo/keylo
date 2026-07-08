"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type UserRole = "tenant" | "landlord" | "admin";

type EmailPreferences = {
  id: string;
  user_id: string;
  role: UserRole;

  application_submitted: boolean;
  application_status_updated: boolean;

  listing_approved: boolean;
  listing_rejected: boolean;
  listing_needs_changes: boolean;

  message_received: boolean;

  lease_sent: boolean;
  lease_signed: boolean;
  lease_ending_soon: boolean;
  lease_renewal_requested: boolean;
  lease_move_out_requested: boolean;

  screening_requested: boolean;
  screening_updated: boolean;

  maintenance_created: boolean;
  maintenance_updated: boolean;

  payment_due: boolean;
  payment_updated: boolean;

  marketing_updates: boolean;

  created_at: string;
  updated_at: string;
};

type PreferenceKey =
  | "application_submitted"
  | "application_status_updated"
  | "listing_approved"
  | "listing_rejected"
  | "listing_needs_changes"
  | "message_received"
  | "lease_sent"
  | "lease_signed"
  | "lease_ending_soon"
  | "lease_renewal_requested"
  | "lease_move_out_requested"
  | "screening_requested"
  | "screening_updated"
  | "maintenance_created"
  | "maintenance_updated"
  | "payment_due"
  | "payment_updated"
  | "marketing_updates";

type PreferenceGroup = {
  roles: UserRole[];
  title: string;
  text: string;
  items: { key: PreferenceKey; label: string; description: string }[];
};

const preferenceGroups: PreferenceGroup[] = [
  {
    roles: ["landlord", "admin"],
    title: "Listings",
    text: "Emails about listing review and approval.",
    items: [
      {
        key: "listing_approved",
        label: "Listing approved",
        description: "Get emailed when an admin approves and publishes your listing.",
      },
      {
        key: "listing_rejected",
        label: "Listing rejected",
        description: "Get emailed when a listing is rejected.",
      },
      {
        key: "listing_needs_changes",
        label: "Listing needs changes",
        description: "Get emailed when a listing needs edits before approval.",
      },
    ],
  },
  {
    roles: ["landlord", "admin"],
    title: "Applications",
    text: "Emails when tenants apply or application activity changes.",
    items: [
      {
        key: "application_submitted",
        label: "New application submitted",
        description: "Get emailed when a tenant submits an application to one of your listings.",
      },
    ],
  },
  {
    roles: ["tenant", "admin"],
    title: "Applications",
    text: "Emails about your rental application status.",
    items: [
      {
        key: "application_status_updated",
        label: "Application status updated",
        description: "Get emailed when your application is approved, declined, or marked under review.",
      },
    ],
  },
  {
    roles: ["tenant", "landlord", "admin"],
    title: "Messages",
    text: "Emails when someone sends you a message inside Keylo.",
    items: [
      {
        key: "message_received",
        label: "Message received",
        description: "Get emailed when a tenant or landlord sends you a message.",
      },
    ],
  },
  {
    roles: ["tenant", "admin"],
    title: "Tenant Lease Emails",
    text: "Emails about leases you need to review, sign, renew, or end.",
    items: [
      {
        key: "lease_sent",
        label: "Lease sent to you",
        description: "Get emailed when a landlord sends you a lease for review or signature.",
      },
      {
        key: "lease_signed",
        label: "Lease signed",
        description: "Get emailed when your lease is fully signed or updated.",
      },
      {
        key: "lease_ending_soon",
        label: "Lease ending soon",
        description: "Get reminders when your lease is getting close to its end date.",
      },
      {
        key: "lease_renewal_requested",
        label: "Renewal updates",
        description: "Get emailed about lease renewal questions, offers, and renewal documents.",
      },
      {
        key: "lease_move_out_requested",
        label: "Move-out planning",
        description: "Get emailed about move-out planning and end-of-lease next steps.",
      },
    ],
  },
  {
    roles: ["landlord", "admin"],
    title: "Landlord Lease Emails",
    text: "Emails about tenant signatures, lease endings, renewals, and move-out planning.",
    items: [
      {
        key: "lease_signed",
        label: "Tenant signed lease",
        description: "Get emailed when a tenant signs a lease and it needs your next step.",
      },
      {
        key: "lease_ending_soon",
        label: "Lease ending soon",
        description: "Get reminders when one of your leases is getting close to its end date.",
      },
      {
        key: "lease_renewal_requested",
        label: "Tenant renewal request",
        description: "Get emailed when a tenant asks to renew or responds to a renewal offer.",
      },
      {
        key: "lease_move_out_requested",
        label: "Tenant plans to move out",
        description: "Get emailed when a tenant says they do not plan to renew.",
      },
    ],
  },
  {
    roles: ["tenant", "admin"],
    title: "Tenant Screening",
    text: "Emails about screening consent requests and updates.",
    items: [
      {
        key: "screening_requested",
        label: "Screening requested",
        description: "Get emailed when a landlord requests screening consent.",
      },
      {
        key: "screening_updated",
        label: "Screening updated",
        description: "Get emailed when screening status changes.",
      },
    ],
  },
  {
    roles: ["landlord", "admin"],
    title: "Landlord Screening",
    text: "Emails when tenants approve, decline, or update screening consent.",
    items: [
      {
        key: "screening_updated",
        label: "Screening approved or declined",
        description: "Get emailed when a tenant approves or declines screening consent.",
      },
    ],
  },
  {
    roles: ["tenant", "admin"],
    title: "Tenant Maintenance",
    text: "Emails about your repair requests.",
    items: [
      {
        key: "maintenance_updated",
        label: "Maintenance request updated",
        description: "Get emailed when your landlord adds a note, photo, or status update.",
      },
    ],
  },
  {
    roles: ["landlord", "admin"],
    title: "Landlord Maintenance",
    text: "Emails about tenant repair requests.",
    items: [
      {
        key: "maintenance_created",
        label: "New maintenance request",
        description: "Get emailed when a tenant creates a maintenance request.",
      },
      {
        key: "maintenance_updated",
        label: "Maintenance request updated",
        description: "Get emailed when a tenant adds a note or photo.",
      },
    ],
  },
  {
    roles: ["tenant", "admin"],
    title: "Tenant Payments",
    text: "Emails about rent, deposits, and fees.",
    items: [
      {
        key: "payment_due",
        label: "Payment due",
        description: "Get emailed when rent, deposit, or fees are due.",
      },
      {
        key: "payment_updated",
        label: "Payment updated",
        description: "Get emailed when a payment is marked paid, waived, or changed.",
      },
    ],
  },
  {
    roles: ["landlord", "admin"],
    title: "Landlord Payments",
    text: "Emails when tenant payment records change.",
    items: [
      {
        key: "payment_updated",
        label: "Payment updated",
        description: "Get emailed when a tenant payment is marked paid, waived, overdue, or changed.",
      },
    ],
  },
  {
    roles: ["tenant", "landlord", "admin"],
    title: "Marketing",
    text: "Optional Keylo product updates.",
    items: [
      {
        key: "marketing_updates",
        label: "Keylo updates",
        description: "Receive occasional Keylo product and platform updates.",
      },
    ],
  },
];

function defaultPreferences(userId: string, role: UserRole) {
  return {
    user_id: userId,
    role,

    application_submitted: true,
    application_status_updated: true,

    listing_approved: true,
    listing_rejected: true,
    listing_needs_changes: true,

    message_received: true,

    lease_sent: true,
    lease_signed: true,
    lease_ending_soon: true,
    lease_renewal_requested: true,
    lease_move_out_requested: true,

    screening_requested: true,
    screening_updated: true,

    maintenance_created: true,
    maintenance_updated: true,

    payment_due: true,
    payment_updated: true,

    marketing_updates: false,
  };
}

export default function NotificationPreferencesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [preferences, setPreferences] = useState<EmailPreferences | null>(null);
  const [role, setRole] = useState<UserRole>("tenant");

  const visibleGroups = useMemo(() => {
    return preferenceGroups.filter((group) => group.roles.includes(role));
  }, [role]);

  useEffect(() => {
    loadPreferences();
  }, []);

  async function loadPreferences() {
    setLoading(true);
    setMessage("");
    setSuccessMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please log in to manage notification preferences.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      setMessage(profileError.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    const userRole = (profile?.role || "tenant") as UserRole;
    setRole(userRole);

    const { data: existingPreference, error: preferenceError } = await supabase
      .from("email_notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (preferenceError) {
      setMessage(preferenceError.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    if (existingPreference) {
      setPreferences(existingPreference as EmailPreferences);
      setAllowed(true);
      setLoading(false);
      return;
    }

    const { data: createdPreference, error: createError } = await supabase
      .from("email_notification_preferences")
      .insert(defaultPreferences(user.id, userRole))
      .select("*")
      .single();

    if (createError) {
      setMessage(createError.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    setPreferences(createdPreference as EmailPreferences);
    setAllowed(true);
    setLoading(false);
  }

  function togglePreference(key: PreferenceKey) {
    if (!preferences) return;

    setPreferences({
      ...preferences,
      [key]: !preferences[key],
    });
  }

  async function savePreferences() {
    if (!preferences) return;

    setSaving(true);
    setMessage("");
    setSuccessMessage("");

    const updatePayload = {
      role,
      application_submitted: preferences.application_submitted,
      application_status_updated: preferences.application_status_updated,

      listing_approved: preferences.listing_approved,
      listing_rejected: preferences.listing_rejected,
      listing_needs_changes: preferences.listing_needs_changes,

      message_received: preferences.message_received,

      lease_sent: preferences.lease_sent,
      lease_signed: preferences.lease_signed,
      lease_ending_soon: preferences.lease_ending_soon,
      lease_renewal_requested: preferences.lease_renewal_requested,
      lease_move_out_requested: preferences.lease_move_out_requested,

      screening_requested: preferences.screening_requested,
      screening_updated: preferences.screening_updated,

      maintenance_created: preferences.maintenance_created,
      maintenance_updated: preferences.maintenance_updated,

      payment_due: preferences.payment_due,
      payment_updated: preferences.payment_updated,

      marketing_updates: preferences.marketing_updates,

      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("email_notification_preferences")
      .update(updatePayload)
      .eq("id", preferences.id)
      .select("*")
      .single();

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setPreferences(data as EmailPreferences);
    setSuccessMessage("Notification preferences saved.");
    setSaving(false);
  }

  function turnVisibleOn() {
    if (!preferences) return;

    const nextPreferences = { ...preferences };

    visibleGroups.forEach((group) => {
      group.items.forEach((item) => {
        nextPreferences[item.key] = true;
      });
    });

    setPreferences(nextPreferences);
  }

  function turnVisibleOffExceptCritical() {
    if (!preferences) return;

    const criticalKeys: PreferenceKey[] = [
      "message_received",
      "lease_sent",
      "lease_signed",
      "lease_ending_soon",
      "screening_requested",
      "screening_updated",
      "payment_due",
      "maintenance_created",
      "maintenance_updated",
    ];

    const nextPreferences = { ...preferences };

    visibleGroups.forEach((group) => {
      group.items.forEach((item) => {
        nextPreferences[item.key] = criticalKeys.includes(item.key);
      });
    });

    nextPreferences.marketing_updates = false;

    setPreferences(nextPreferences);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading preferences...</h1>
        </div>
      </main>
    );
  }

  if (!allowed || !preferences) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Preferences unavailable</h1>

          <p className="mt-3 text-slate-600">{message}</p>

          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/dashboard" className="text-sm font-bold text-slate-600">
          ← Back to Dashboard
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Email Preferences
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                Notifications
              </h1>

              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
                Choose which Keylo emails you want to receive. These options are
                customized for your account type.
              </p>
            </div>

            <span className="w-fit rounded-full bg-[#f7f4ef] px-4 py-2 text-sm font-black capitalize text-slate-700">
              {role}
            </span>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl bg-red-50 px-5 py-4 font-bold text-red-700 ring-1 ring-red-200">
              {message}
            </div>
          )}

          {successMessage && (
            <div className="mt-6 rounded-2xl bg-green-50 px-5 py-4 font-bold text-green-700 ring-1 ring-green-200">
              {successMessage}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={turnVisibleOn}
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black"
            >
              Turn These On
            </button>

            <button
              type="button"
              onClick={turnVisibleOffExceptCritical}
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black"
            >
              Keep Only Important
            </button>

            <button
              type="button"
              onClick={savePreferences}
              disabled={saving}
              className="rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Preferences"}
            </button>
          </div>

          <div className="mt-8 grid gap-6">
            {visibleGroups.map((group) => (
              <section
                key={group.title}
                className="rounded-3xl bg-[#f7f4ef] p-6"
              >
                <h2 className="text-2xl font-black">{group.title}</h2>
                <p className="mt-2 leading-7 text-slate-600">{group.text}</p>

                <div className="mt-5 grid gap-3">
                  {group.items.map((item) => {
                    const enabled = preferences[item.key];

                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => togglePreference(item.key)}
                        className="flex flex-col gap-4 rounded-2xl bg-white p-5 text-left ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <h3 className="text-lg font-black">{item.label}</h3>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {item.description}
                          </p>
                        </div>

                        <span
                          className={`w-fit rounded-full px-4 py-2 text-sm font-black ${
                            enabled
                              ? "bg-green-50 text-green-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {enabled ? "On" : "Off"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row">
            <button
              type="button"
              onClick={savePreferences}
              disabled={saving}
              className="rounded-full bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Preferences"}
            </button>

            <Link
              href="/dashboard"
              className="rounded-full border border-slate-300 bg-white px-6 py-3 text-center font-black"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}