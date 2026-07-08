"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Lease = {
  id: string;
  application_id: string | null;
  property_id: string | null;
  tenant_id: string;
  landlord_id: string;
  landlord_company_id: string | null;
  lease_status: string;
  renewal_status: string | null;
  renewal_parent_lease_id: string | null;
  tenant_name: string | null;
  landlord_name: string | null;
  property_address: string | null;
  monthly_rent: number | null;
  security_deposit: number | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  sent_to_tenant_at: string | null;
  tenant_signed_at: string | null;
  landlord_signed_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type CompanyRole =
  | "owner"
  | "admin"
  | "manager"
  | "maintenance"
  | "accounting"
  | "viewer"
  | "";

type CompanyMembership = {
  company_id: string;
  role: CompanyRole;
  landlord_companies:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};

function getCompanyFromMembership(membership: CompanyMembership | null) {
  if (!membership) return null;

  if (Array.isArray(membership.landlord_companies)) {
    return membership.landlord_companies[0] || null;
  }

  return membership.landlord_companies;
}

function canManageLeases(role: CompanyRole) {
  return role === "owner" || role === "admin" || role === "manager";
}

function canViewLeases(role: CompanyRole) {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "manager" ||
    role === "accounting" ||
    role === "viewer"
  );
}

function formatStatus(status: string) {
  if (status === "draft") return "Draft";
  if (status === "sent_to_tenant") return "Sent to Tenant";
  if (status === "tenant_signed") return "Needs Landlord Signature";
  if (status === "landlord_signed") return "Landlord Signed";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";

  return status;
}

function statusClass(status: string) {
  if (status === "completed") return "bg-green-50 text-green-700";
  if (status === "tenant_signed") return "bg-yellow-50 text-yellow-700";
  if (status === "sent_to_tenant") return "bg-blue-50 text-blue-700";
  if (status === "cancelled") return "bg-red-50 text-red-700";
  return "bg-slate-100 text-slate-600";
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "Not provided";
  return `$${value.toLocaleString()}`;
}

function getDaysUntilLeaseEnds(leaseEndDate: string | null) {
  if (!leaseEndDate) return null;

  const today = new Date();
  const endDate = new Date(`${leaseEndDate}T00:00:00`);

  return Math.ceil(
    (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export default function LandlordLeasesPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [leases, setLeases] = useState<Lease[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [companyRole, setCompanyRole] = useState<CompanyRole>("");
  const [hasCompany, setHasCompany] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    loadLeases();
  }, []);

  async function loadLeases() {
    setLoading(true);
    setAllowed(false);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please log in as a landlord.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      setMessage("Could not load your account.");
      setLoading(false);
      return;
    }

    if (profile.role !== "landlord" && profile.role !== "admin") {
      setMessage("Only landlord accounts can view leases.");
      setLoading(false);
      return;
    }

    let companyId: string | null = null;
    let role: CompanyRole = "";

    const { data: membershipRows, error: membershipError } = await supabase
      .from("landlord_company_members")
      .select(
        `
        company_id,
        role,
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
      setMessage(membershipError.message);
      setLoading(false);
      return;
    }

    const firstMembership =
      ((membershipRows || [])[0] as unknown as
        | CompanyMembership
        | undefined) || null;

    const company = getCompanyFromMembership(firstMembership);

    if (firstMembership && company) {
      companyId = company.id;
      role = firstMembership.role;
      setCompanyName(company.name);
      setCompanyRole(role);
      setHasCompany(true);
    } else {
      setCompanyName("");
      setCompanyRole("");
      setHasCompany(false);
    }

    const isAdmin = profile.role === "admin";
    const isPersonalLandlord = !companyId;

    if (!isAdmin && companyId && !canViewLeases(role)) {
      setMessage("Your company role does not have permission to view leases.");
      setLoading(false);
      return;
    }

    let query = supabase
      .from("leases")
      .select(
        `
        id,
        application_id,
        property_id,
        tenant_id,
        landlord_id,
        landlord_company_id,
        lease_status,
        renewal_status,
        renewal_parent_lease_id,
        tenant_name,
        landlord_name,
        property_address,
        monthly_rent,
        security_deposit,
        lease_start_date,
        lease_end_date,
        sent_to_tenant_at,
        tenant_signed_at,
        landlord_signed_at,
        completed_at,
        created_at
      `
      )
      .order("created_at", { ascending: false });

    if (companyId) {
      query = query.or(
        `landlord_company_id.eq.${companyId},landlord_id.eq.${user.id}`
      );
    } else if (isPersonalLandlord) {
      query = query.eq("landlord_id", user.id);
    }

    const { data, error } = await query;

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setLeases((data || []) as Lease[]);
    setAllowed(true);
    setLoading(false);
  }

  const filteredLeases = useMemo(() => {
    if (activeTab === "all") return leases;
    if (activeTab === "needs_signature") {
      return leases.filter((lease) => lease.lease_status === "tenant_signed");
    }
    if (activeTab === "ending_soon") {
      return leases.filter((lease) => {
        const days = getDaysUntilLeaseEnds(lease.lease_end_date);
        return days !== null && days >= 0 && days <= 90;
      });
    }

    return leases.filter((lease) => lease.lease_status === activeTab);
  }, [activeTab, leases]);

  const counts = {
    all: leases.length,
    draft: leases.filter((lease) => lease.lease_status === "draft").length,
    sent_to_tenant: leases.filter(
      (lease) => lease.lease_status === "sent_to_tenant"
    ).length,
    needs_signature: leases.filter(
      (lease) => lease.lease_status === "tenant_signed"
    ).length,
    completed: leases.filter((lease) => lease.lease_status === "completed")
      .length,
    ending_soon: leases.filter((lease) => {
      const days = getDaysUntilLeaseEnds(lease.lease_end_date);
      return days !== null && days >= 0 && days <= 90;
    }).length,
    cancelled: leases.filter((lease) => lease.lease_status === "cancelled")
      .length,
  };

  const userCanManageLeases = !hasCompany || canManageLeases(companyRole);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-black sm:text-3xl">
            Loading leases...
          </h1>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <div className="rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <h1 className="text-3xl font-black">Leases unavailable</h1>

            <p className="mt-3 text-slate-600">{message}</p>

            <Link
              href="/dashboard/landlord"
              className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/dashboard/landlord"
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Landlord Dashboard
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Leases
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
                {hasCompany ? "Company Leases" : "Your Leases"}
              </h1>

              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                View all leases, signature status, renewal timing, and payment
                links in one place.
              </p>

              {hasCompany && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">
                    Company: {companyName}
                  </span>

                  <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black capitalize text-slate-700">
                    Role: {companyRole}
                  </span>
                </div>
              )}
            </div>

            <Link
              href="/dashboard/landlord"
              className="rounded-full border border-slate-300 bg-white px-6 py-4 text-center font-black"
            >
              Dashboard
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            <TabButton
              active={activeTab === "all"}
              label={`All (${counts.all})`}
              onClick={() => setActiveTab("all")}
            />

            <TabButton
              active={activeTab === "draft"}
              label={`Draft (${counts.draft})`}
              onClick={() => setActiveTab("draft")}
            />

            <TabButton
              active={activeTab === "sent_to_tenant"}
              label={`Sent (${counts.sent_to_tenant})`}
              onClick={() => setActiveTab("sent_to_tenant")}
            />

            <TabButton
              active={activeTab === "needs_signature"}
              label={`Needs Signature (${counts.needs_signature})`}
              onClick={() => setActiveTab("needs_signature")}
            />

            <TabButton
              active={activeTab === "completed"}
              label={`Completed (${counts.completed})`}
              onClick={() => setActiveTab("completed")}
            />

            <TabButton
              active={activeTab === "ending_soon"}
              label={`Ending Soon (${counts.ending_soon})`}
              onClick={() => setActiveTab("ending_soon")}
            />

            <TabButton
              active={activeTab === "cancelled"}
              label={`Cancelled (${counts.cancelled})`}
              onClick={() => setActiveTab("cancelled")}
            />
          </div>
        </div>

        {message && (
          <div className="mt-6 rounded-2xl bg-white px-5 py-4 font-bold text-red-700 shadow-sm ring-1 ring-red-200">
            {message}
          </div>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Total Leases"
            value={String(leases.length)}
            text="All visible leases"
          />

          <SummaryCard
            label="Needs Signature"
            value={String(counts.needs_signature)}
            text="Tenant signed, landlord pending"
            urgent={counts.needs_signature > 0}
          />

          <SummaryCard
            label="Completed"
            value={String(counts.completed)}
            text="Fully signed leases"
          />

          <SummaryCard
            label="Ending Soon"
            value={String(counts.ending_soon)}
            text="Ending within 90 days"
            urgent={counts.ending_soon > 0}
          />
        </section>

        <section className="mt-6 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <h2 className="text-2xl font-black">
              {activeTab === "all"
                ? "All Leases"
                : activeTab === "needs_signature"
                  ? "Leases Needing Signature"
                  : activeTab === "ending_soon"
                    ? "Leases Ending Soon"
                    : `${formatStatus(activeTab)} Leases`}
            </h2>

            <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
              {filteredLeases.length} lease
              {filteredLeases.length === 1 ? "" : "s"}
            </span>
          </div>

          {filteredLeases.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {filteredLeases.map((lease) => (
                <LeaseRow
                  key={lease.id}
                  lease={lease}
                  userCanManageLeases={userCanManageLeases}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No leases found</h3>
              <p className="mt-3 text-slate-600">
                There are no leases in this section yet.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function TabButton({
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
      className={`rounded-2xl px-4 py-3 text-sm font-black ring-1 ${
        active
          ? "bg-slate-950 text-white ring-slate-950"
          : "bg-white text-slate-700 ring-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

function SummaryCard({
  label,
  value,
  text,
  urgent = false,
}: {
  label: string;
  value: string;
  text: string;
  urgent?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-5 shadow-sm ring-1 ${
        urgent ? "bg-yellow-50 ring-yellow-200" : "bg-white ring-slate-200"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>

      <p className="mt-3 text-3xl font-black sm:text-4xl">{value}</p>

      <p className="mt-2 text-sm font-bold text-slate-500">{text}</p>
    </div>
  );
}

function LeaseRow({
  lease,
  userCanManageLeases,
}: {
  lease: Lease;
  userCanManageLeases: boolean;
}) {
  const daysUntilEnd = getDaysUntilLeaseEnds(lease.lease_end_date);

  return (
    <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-black sm:text-xl">
            Lease for {lease.tenant_name || "Tenant"}
          </h3>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
              lease.lease_status
            )}`}
          >
            {formatStatus(lease.lease_status)}
          </span>

          {lease.renewal_parent_lease_id && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
              Renewal Lease
            </span>
          )}

          {daysUntilEnd !== null && daysUntilEnd >= 0 && daysUntilEnd <= 90 && (
            <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-black text-yellow-700">
              Ends in {daysUntilEnd} day{daysUntilEnd === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <p className="mt-2 font-bold text-slate-500">
          {lease.property_address || "No property address provided"}
        </p>

        <p className="mt-2 text-sm font-bold text-slate-500">
          {formatMoney(lease.monthly_rent)}/mo
          {lease.lease_start_date && lease.lease_end_date
            ? ` · ${lease.lease_start_date} to ${lease.lease_end_date}`
            : ""}
        </p>

        <p className="mt-2 text-sm font-bold text-slate-500">
          Created {new Date(lease.created_at).toLocaleDateString()}
          {lease.completed_at
            ? ` · Completed ${new Date(
                lease.completed_at
              ).toLocaleDateString()}`
            : ""}
        </p>
      </div>

      <div className="grid gap-3 sm:flex sm:flex-row sm:flex-wrap">
        <Link
          href={`/dashboard/landlord/leases/${lease.id}`}
          className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
        >
          View
        </Link>

        <Link
          href={`/dashboard/landlord/leases/${lease.id}/print`}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
        >
          PDF
        </Link>

        <Link
          href={`/dashboard/landlord/leases/${lease.id}/payments`}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
        >
          Payments
        </Link>

        {userCanManageLeases && (
          <Link
            href={`/dashboard/landlord/leases/${lease.id}/renewal`}
            className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
          >
            Renewal
          </Link>
        )}
      </div>
    </div>
  );
}