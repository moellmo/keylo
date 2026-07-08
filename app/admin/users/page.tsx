"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import UserRoleSelect from "../UserRoleSelect";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
};

type RoleFilter = "all" | "tenant" | "landlord" | "admin";

const PAGE_SIZE = 25;

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please log in as an admin.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: currentProfile, error: currentProfileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (currentProfileError || currentProfile?.role !== "admin") {
      setMessage("You do not have permission to view users.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      setMessage(error.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    setProfiles((data || []) as Profile[]);
    setAllowed(true);
    setLoading(false);
  }

  const filteredUsers = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return profiles.filter((profile) => {
      const matchesRole =
        roleFilter === "all" ? true : profile.role === roleFilter;

      const matchesSearch =
        !cleanSearch ||
        profile.email.toLowerCase().includes(cleanSearch) ||
        (profile.full_name || "").toLowerCase().includes(cleanSearch);

      return matchesRole && matchesSearch;
    });
  }, [profiles, roleFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));

  const visibleUsers = filteredUsers.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function updateRoleFilter(value: RoleFilter) {
    setRoleFilter(value);
    setPage(1);
  }

  const tenantCount = profiles.filter((profile) => profile.role === "tenant")
    .length;
  const landlordCount = profiles.filter(
    (profile) => profile.role === "landlord"
  ).length;
  const adminCount = profiles.filter((profile) => profile.role === "admin")
    .length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading users...</h1>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Admin access required</h1>
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
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/admin" className="text-sm font-bold text-slate-600">
              ← Back to Admin
            </Link>

            <h1 className="mt-4 text-5xl font-black tracking-tight">
              Users
            </h1>

            <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
              Search users, filter by role, and manage account roles.
            </p>
          </div>

          <button
            type="button"
            onClick={loadUsers}
            className="rounded-full bg-slate-950 px-6 py-3 font-black text-white"
          >
            Refresh
          </button>
        </div>

        {message && (
          <div className="mt-6 rounded-2xl bg-white px-5 py-4 font-bold text-red-700 shadow-sm ring-1 ring-red-200">
            {message}
          </div>
        )}

        <section className="mt-8 grid gap-5 md:grid-cols-4">
          <StatCard title="Total Users" value={profiles.length} />
          <StatCard title="Tenants" value={tenantCount} />
          <StatCard title="Landlords" value={landlordCount} />
          <StatCard title="Admins" value={adminCount} />
        </section>

        <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">
                Search by name or email
              </span>

              <input
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Example: moshe@email.com"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-slate-500"
              />
            </label>

            <div>
              <p className="mb-2 text-sm font-black text-slate-700">Role</p>

              <div className="flex flex-wrap gap-2">
                <FilterButton
                  active={roleFilter === "all"}
                  label="All"
                  onClick={() => updateRoleFilter("all")}
                />
                <FilterButton
                  active={roleFilter === "tenant"}
                  label="Tenants"
                  onClick={() => updateRoleFilter("tenant")}
                />
                <FilterButton
                  active={roleFilter === "landlord"}
                  label="Landlords"
                  onClick={() => updateRoleFilter("landlord")}
                />
                <FilterButton
                  active={roleFilter === "admin"}
                  label="Admins"
                  onClick={() => updateRoleFilter("admin")}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black">User Results</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Showing {visibleUsers.length} of {filteredUsers.length} users.
                </p>
              </div>

              <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
                Page {page} of {totalPages}
              </span>
            </div>
          </div>

          {visibleUsers.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {visibleUsers.map((profile) => (
                <div
                  key={profile.id}
                  className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-black">
                        {profile.full_name || "Unnamed User"}
                      </h3>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                        {profile.role}
                      </span>
                    </div>

                    <p className="mt-1 font-bold text-slate-500">
                      {profile.email}
                    </p>

                    <p className="mt-2 text-xs font-bold text-slate-400">
                      Joined {new Date(profile.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:items-end">
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                      Role
                    </p>

                    <UserRoleSelect
                      userId={profile.id}
                      currentRole={profile.role}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No users found</h3>
              <p className="mt-3 text-slate-600">
                Try a different search or role filter.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-200 p-6 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black disabled:opacity-50"
            >
              Previous
            </button>

            <p className="text-center text-sm font-bold text-slate-500">
              Page {page} of {totalPages}
            </p>

            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page === totalPages}
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <p className="mt-3 text-4xl font-black">{value}</p>
    </div>
  );
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-5 py-3 text-sm font-black ${
        active
          ? "bg-slate-950 text-white"
          : "border border-slate-300 bg-white text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}