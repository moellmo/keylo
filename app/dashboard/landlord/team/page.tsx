"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Company = {
  id: string;
  name: string;
};

type MembershipRole =
  | "owner"
  | "admin"
  | "manager"
  | "maintenance"
  | "accounting"
  | "viewer";

type MembershipStatus = "active" | "removed";

type CompanyMembership = {
  id: string;
  company_id: string;
  user_id: string;
  role: MembershipRole;
  status: MembershipStatus;
  created_at: string;
  profiles:
    | {
        email: string;
        full_name: string | null;
      }
    | {
        email: string;
        full_name: string | null;
      }[]
    | null;
};

type CurrentMembership = {
  id: string;
  company_id: string;
  user_id: string;
  role: MembershipRole;
  status: MembershipStatus;
  landlord_companies: Company | Company[] | null;
};

type CompanyInvite = {
  id: string;
  company_id: string;
  email: string;
  role: Exclude<MembershipRole, "owner">;
  status: "pending" | "accepted" | "cancelled" | "expired";
  token: string;
  expires_at: string;
  created_at: string;
};

function getCompanyFromMembership(membership: CurrentMembership | null) {
  if (!membership) return null;

  if (Array.isArray(membership.landlord_companies)) {
    return membership.landlord_companies[0] || null;
  }

  return membership.landlord_companies;
}

function getProfileFromMembership(member: CompanyMembership) {
  if (Array.isArray(member.profiles)) {
    return member.profiles[0] || null;
  }

  return member.profiles;
}

function canManageTeam(role: MembershipRole | null) {
  return role === "owner" || role === "admin";
}

function canChangeRole(currentRole: MembershipRole | null, targetRole: MembershipRole) {
  if (targetRole === "owner") return false;
  return currentRole === "owner" || currentRole === "admin";
}

function roleLabel(role: string) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  if (role === "maintenance") return "Maintenance";
  if (role === "accounting") return "Accounting";
  if (role === "viewer") return "Viewer";
  return role;
}

function roleDescription(role: string) {
  if (role === "owner") return "Full company access and ownership.";
  if (role === "admin") return "Manage company, team, listings, leases, and operations.";
  if (role === "manager") return "Manage listings, applications, leases, and maintenance.";
  if (role === "maintenance") return "View and manage maintenance requests.";
  if (role === "accounting") return "View and manage payments and rent charges.";
  if (role === "viewer") return "Read-only access.";
  return "";
}

function makeInviteToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function LandlordTeamPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState("");
  const [membership, setMembership] = useState<CurrentMembership | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

  const [members, setMembers] = useState<CompanyMembership[]>([]);
  const [invites, setInvites] = useState<CompanyInvite[]>([]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] =
    useState<Exclude<MembershipRole, "owner">>("manager");

  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadTeam();
  }, []);

  async function loadTeam() {
    setLoading(true);
    setMessage("");
    setSuccessMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setAllowed(false);
      setMessage("Please log in as a landlord.");
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || (profile?.role !== "landlord" && profile?.role !== "admin")) {
      setAllowed(false);
      setMessage("You must be logged in as a landlord to manage a team.");
      setLoading(false);
      return;
    }

    const { data: membershipRows, error: membershipError } = await supabase
      .from("landlord_company_members")
      .select(
        `
        id,
        company_id,
        user_id,
        role,
        status,
        landlord_companies (
          id,
          name
        )
      `
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1);

    if (membershipError) {
      setAllowed(false);
      setMessage(membershipError.message);
      setLoading(false);
      return;
    }

    const firstMembership =
      ((membershipRows || [])[0] as unknown as CurrentMembership | undefined) ||
      null;

    const companyRow = getCompanyFromMembership(firstMembership);

    if (!firstMembership || !companyRow) {
      setAllowed(false);
      setMessage("Create your landlord company before managing team members.");
      setLoading(false);
      return;
    }

    setMembership(firstMembership);
    setCompany(companyRow);

    const { data: memberRows, error: membersError } = await supabase
      .from("landlord_company_members")
      .select(
        `
        id,
        company_id,
        user_id,
        role,
        status,
        created_at,
        profiles (
          email,
          full_name
        )
      `
      )
      .eq("company_id", companyRow.id)
      .order("created_at", { ascending: true });

    if (membersError) {
      setAllowed(false);
      setMessage(membersError.message);
      setLoading(false);
      return;
    }

    const { data: inviteRows, error: invitesError } = await supabase
      .from("landlord_company_invites")
      .select("id, company_id, email, role, status, token, expires_at, created_at")
      .eq("company_id", companyRow.id)
      .order("created_at", { ascending: false });

    if (invitesError) {
      setAllowed(false);
      setMessage(invitesError.message);
      setLoading(false);
      return;
    }

    setMembers((memberRows || []) as unknown as CompanyMembership[]);
    setInvites((inviteRows || []) as CompanyInvite[]);
    setAllowed(true);
    setLoading(false);
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!company || !membership) return;

    setSaving(true);
    setMessage("");
    setSuccessMessage("");

    if (!canManageTeam(membership.role)) {
      setMessage("Only company owners and admins can invite team members.");
      setSaving(false);
      return;
    }

    const cleanEmail = inviteEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setMessage("Email is required.");
      setSaving(false);
      return;
    }

    const existingMember = members.find((member) => {
      const profile = getProfileFromMembership(member);
      return profile?.email?.toLowerCase() === cleanEmail && member.status === "active";
    });

    if (existingMember) {
      setMessage("That user is already an active company member.");
      setSaving(false);
      return;
    }

    const existingPendingInvite = invites.find(
      (invite) =>
        invite.email.toLowerCase() === cleanEmail && invite.status === "pending"
    );

    if (existingPendingInvite) {
      setMessage("That email already has a pending invite.");
      setSaving(false);
      return;
    }

    const { data: inviteRow, error } = await supabase
  .from("landlord_company_invites")
  .insert({
    company_id: company.id,
    email: cleanEmail,
    role: inviteRole,
    invited_by: userId,
    status: "pending",
    token: makeInviteToken(),
  })
  .select("id")
  .single();

if (error) {
  setMessage(error.message);
  setSaving(false);
  return;
}

const {
  data: { session },
} = await supabase.auth.getSession();

const emailResponse = await fetch("/api/company-invites/send", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token || ""}`,
  },
  body: JSON.stringify({
    invite_id: inviteRow.id,
  }),
});

const emailResult = await emailResponse.json();

if (!emailResponse.ok) {
  setMessage(
    emailResult.error ||
      "Invite was created, but the email could not be sent."
  );
  await loadTeam();
  setSaving(false);
  return;
}

setInviteEmail("");
setInviteRole("manager");
setSuccessMessage("Invite created and email sent.");
await loadTeam();
setSaving(false);
  }

  async function updateMemberRole(memberId: string, nextRole: MembershipRole) {
    if (!membership) return;

    setSaving(true);
    setMessage("");
    setSuccessMessage("");

    if (!canChangeRole(membership.role, nextRole)) {
      setMessage("You do not have permission to change this role.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("landlord_company_members")
      .update({
        role: nextRole,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setSuccessMessage("Team member role updated.");
    await loadTeam();
    setSaving(false);
  }

  async function removeMember(member: CompanyMembership) {
    if (!membership) return;

    setSaving(true);
    setMessage("");
    setSuccessMessage("");

    if (!canManageTeam(membership.role)) {
      setMessage("Only company owners and admins can remove team members.");
      setSaving(false);
      return;
    }

    if (member.role === "owner") {
      setMessage("The company owner cannot be removed here.");
      setSaving(false);
      return;
    }

    if (member.user_id === userId) {
      setMessage("You cannot remove yourself from the company here.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("landlord_company_members")
      .update({
        status: "removed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setSuccessMessage("Team member removed.");
    await loadTeam();
    setSaving(false);
  }

  async function cancelInvite(inviteId: string) {
    if (!membership) return;

    setSaving(true);
    setMessage("");
    setSuccessMessage("");

    if (!canManageTeam(membership.role)) {
      setMessage("Only company owners and admins can cancel invites.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("landlord_company_invites")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", inviteId);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setSuccessMessage("Invite cancelled.");
    await loadTeam();
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-black sm:text-3xl">Loading team...</h1>
        </div>
      </main>
    );
  }

  if (!allowed || !company || !membership) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <div className="rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <h1 className="text-3xl font-black">Company setup required</h1>
            <p className="mt-3 text-slate-600">{message}</p>

            <Link
              href="/dashboard/landlord/company"
              className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
            >
              Create Company
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const activeMembers = members.filter((member) => member.status === "active");
  const removedMembers = members.filter((member) => member.status === "removed");
  const pendingInvites = invites.filter((invite) => invite.status === "pending");
  const editable = canManageTeam(membership.role);

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <Link
            href="/dashboard/landlord/company"
            className="text-sm font-bold text-slate-600"
          >
            ← Back to Company
          </Link>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Landlord Team
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
                Team Members
              </h1>

              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                Manage users under {company.name}. Owners and admins can invite
                team members and assign roles.
              </p>
            </div>

            <Link
              href="/dashboard/landlord"
              className="rounded-full bg-slate-950 px-6 py-4 text-center font-black text-white"
            >
              Dashboard
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <InfoCard title="Company" value={company.name} />
            <InfoCard title="Your Role" value={roleLabel(membership.role)} />
            <InfoCard title="Active Members" value={activeMembers.length} />
            <InfoCard title="Pending Invites" value={pendingInvites.length} />
          </div>

          {!editable && (
            <div className="mt-6 rounded-2xl bg-yellow-50 px-5 py-4 font-bold text-yellow-800 ring-1 ring-yellow-200">
              You can view the team, but only company owners and admins can
              invite or manage users.
            </div>
          )}

          {successMessage && (
            <div className="mt-6 rounded-2xl bg-green-50 px-5 py-4 font-bold text-green-700 ring-1 ring-green-200">
              {successMessage}
            </div>
          )}

          {message && (
            <div className="mt-6 rounded-2xl bg-red-50 px-5 py-4 font-bold text-red-700 ring-1 ring-red-200">
              {message}
            </div>
          )}
        </div>

        {editable && (
          <section className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Invite
            </p>

            <h2 className="mt-2 text-2xl font-black sm:text-3xl">
              Invite team member
            </h2>

            <form onSubmit={handleInvite} className="mt-6 grid gap-5 md:grid-cols-[1fr_220px_auto] md:items-end">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">
                  Email *
                </span>

                <input
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  type="email"
                  required
                  placeholder="team@example.com"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-slate-500"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">
                  Role
                </span>

                <select
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(
                      event.target.value as Exclude<MembershipRole, "owner">
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-slate-500"
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="accounting">Accounting</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-slate-950 px-6 py-4 text-center font-black text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Create Invite"}
              </button>
            </form>

            <div className="mt-5 rounded-2xl bg-[#f7f4ef] p-4 text-sm leading-6 text-slate-600">
              <strong>Note:</strong> This creates the invite record. Next we’ll
              build the invite acceptance page and email notification.
            </div>
          </section>
        )}

        <section className="mt-6 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <SectionHeader title="Active Members" badge={`${activeMembers.length}`} />

          {activeMembers.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {activeMembers.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  currentRole={membership.role}
                  saving={saving}
                  currentUserId={userId}
                  onRoleChange={(nextRole) => updateMemberRole(member.id, nextRole)}
                  onRemove={() => removeMember(member)}
                />
              ))}
            </div>
          ) : (
            <EmptySection
              title="No active members"
              text="Active company users will appear here."
            />
          )}
        </section>

        <section className="mt-6 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <SectionHeader title="Pending Invites" badge={`${pendingInvites.length}`} />

          {pendingInvites.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {pendingInvites.map((invite) => (
                <InviteRow
                  key={invite.id}
                  invite={invite}
                  editable={editable}
                  saving={saving}
                  onCancel={() => cancelInvite(invite.id)}
                />
              ))}
            </div>
          ) : (
            <EmptySection
              title="No pending invites"
              text="Invite users to help manage your landlord company."
            />
          )}
        </section>

        {removedMembers.length > 0 && (
          <section className="mt-6 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
            <SectionHeader
              title="Removed Members"
              badge={`${removedMembers.length}`}
            />

            <div className="divide-y divide-slate-200">
              {removedMembers.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  currentRole={membership.role}
                  saving={saving}
                  currentUserId={userId}
                  readonly
                  onRoleChange={() => undefined}
                  onRemove={() => undefined}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function MemberRow({
  member,
  currentRole,
  saving,
  currentUserId,
  readonly = false,
  onRoleChange,
  onRemove,
}: {
  member: CompanyMembership;
  currentRole: MembershipRole;
  saving: boolean;
  currentUserId: string;
  readonly?: boolean;
  onRoleChange: (role: MembershipRole) => void;
  onRemove: () => void;
}) {
  const profile = getProfileFromMembership(member);
  const editable = !readonly && canManageTeam(currentRole) && member.role !== "owner";
  const isSelf = member.user_id === currentUserId;

  return (
    <div className="grid gap-5 p-5 lg:grid-cols-[1fr_260px] sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-black sm:text-xl">
            {profile?.full_name || "Unnamed User"}
          </h3>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
            {roleLabel(member.role)}
          </span>

          {isSelf && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
              You
            </span>
          )}

          {member.status === "removed" && (
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
              Removed
            </span>
          )}
        </div>

        <p className="mt-2 font-bold text-slate-500">
          {profile?.email || "Email unavailable"}
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          {roleDescription(member.role)}
        </p>

        <p className="mt-2 text-xs font-bold text-slate-400">
          Added {new Date(member.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="grid gap-3">
        <select
          value={member.role}
          onChange={(event) => onRoleChange(event.target.value as MembershipRole)}
          disabled={!editable || saving}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none disabled:bg-slate-100 disabled:text-slate-500"
        >
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="maintenance">Maintenance</option>
          <option value="accounting">Accounting</option>
          <option value="viewer">Viewer</option>
        </select>

        {!readonly && member.role !== "owner" && !isSelf && (
          <button
            type="button"
            onClick={onRemove}
            disabled={!editable || saving}
            className="rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 disabled:opacity-60"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function InviteRow({
  invite,
  editable,
  saving,
  onCancel,
}: {
  invite: CompanyInvite;
  editable: boolean;
  saving: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="grid gap-5 p-5 lg:grid-cols-[1fr_220px] sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-black sm:text-xl">{invite.email}</h3>

          <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-black text-yellow-700">
            Pending
          </span>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
            {roleLabel(invite.role)}
          </span>
        </div>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Expires {new Date(invite.expires_at).toLocaleDateString()}
        </p>

        <p className="mt-2 break-all rounded-2xl bg-[#f7f4ef] px-4 py-3 text-xs font-bold text-slate-500">
  Invite link: {`${window.location.origin}/company-invites/${invite.token}`}
</p>
      </div>

      {editable && (
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-fit rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 disabled:opacity-60"
        >
          Cancel Invite
        </button>
      )}
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-3xl bg-[#f7f4ef] p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <p className="mt-2 break-words text-2xl font-black">{value}</p>
    </div>
  );
}

function SectionHeader({ title, badge }: { title: string; badge: string }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <h2 className="text-2xl font-black">{title}</h2>

      <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
        {badge}
      </span>
    </div>
  );
}

function EmptySection({ title, text }: { title: string; text: string }) {
  return (
    <div className="p-8 text-center">
      <h3 className="text-2xl font-black">{title}</h3>
      <p className="mt-3 text-slate-600">{text}</p>
    </div>
  );
}