"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ArchiveListingButton from "./ArchiveListingButton";
import ResubmitListingButton from "./ResubmitListingButton";

type PropertyWithApplications = {
  id: string;
  title: string;
  monthly_rent: number;
  city: string;
  state: string;
  status: string;
  rejection_note: string | null;
  created_at: string;
  applications: {
    id: string;
    status?: string | null;
    screening_status?: string | null;
  }[];
};

type LandlordLease = {
  id: string;
  lease_status: string;
  tenant_name: string | null;
  property_address: string | null;
  monthly_rent: number | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  tenant_signed_at: string | null;
  landlord_signed_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type RentCharge = {
  id: string;
  amount_cents: number;
  status: "unpaid" | "paid" | "overdue" | "waived" | "cancelled";
  due_date: string;
};

type MaintenanceRequest = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "resolved" | "closed" | "cancelled";
  priority: "low" | "normal" | "urgent" | "emergency";
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

type DashboardTab =
  | "overview"
  | "listings"
  | "leases"
  | "payments"
  | "maintenance";

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

function formatMoneyFromCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getApplications(listing: PropertyWithApplications) {
  return listing.applications || [];
}

function getDaysUntilLeaseEnds(leaseEndDate: string | null) {
  if (!leaseEndDate) return null;

  const today = new Date();
  const endDate = new Date(`${leaseEndDate}T00:00:00`);

  return Math.ceil(
    (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function isFullCompanyManager(role: CompanyRole) {
  return role === "owner" || role === "admin" || role === "manager";
}

function canUsePayments(role: CompanyRole) {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "manager" ||
    role === "accounting"
  );
}

function canUseMaintenance(role: CompanyRole) {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "manager" ||
    role === "maintenance"
  );
}

function canReadCompanyData(role: CompanyRole) {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "manager" ||
    role === "accounting" ||
    role === "maintenance" ||
    role === "viewer"
  );
}

export default function LandlordDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [listings, setListings] = useState<PropertyWithApplications[]>([]);
  const [leases, setLeases] = useState<LandlordLease[]>([]);
  const [rentCharges, setRentCharges] = useState<RentCharge[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<
    MaintenanceRequest[]
  >([]);
  const [companyName, setCompanyName] = useState("");
  const [companyRole, setCompanyRole] = useState<CompanyRole>("");
  const [hasCompany, setHasCompany] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoggedIn(false);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "landlord" && profile?.role !== "admin") {
        setLoggedIn(false);
        setErrorMessage(
          "You must be logged in as a landlord to view this dashboard."
        );
        setLoading(false);
        return;
      }

      setLoggedIn(true);

      let companyId: string | null = null;

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
        setErrorMessage(membershipError.message);
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
        setCompanyName(company.name);
        setCompanyRole(firstMembership.role);
        setHasCompany(true);
      } else {
        setCompanyName("");
        setCompanyRole("");
        setHasCompany(false);
      }

      let propertiesQuery = supabase
        .from("properties")
        .select(
          `
          id,
          title,
          monthly_rent,
          city,
          state,
          status,
          rejection_note,
          created_at,
          applications (
            id,
            status,
            screening_status
          )
        `
        )
        .order("created_at", { ascending: false });

      if (companyId) {
        propertiesQuery = propertiesQuery.or(
          `landlord_company_id.eq.${companyId},landlord_id.eq.${user.id}`
        );
      } else {
        propertiesQuery = propertiesQuery.eq("landlord_id", user.id);
      }

      const { data, error } = await propertiesQuery;

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      let leasesQuery = supabase
        .from("leases")
        .select(
          `
          id,
          lease_status,
          tenant_name,
          property_address,
          monthly_rent,
          lease_start_date,
          lease_end_date,
          tenant_signed_at,
          landlord_signed_at,
          completed_at,
          created_at
        `
        )
        .order("created_at", { ascending: false });

      if (companyId) {
        leasesQuery = leasesQuery.or(
          `landlord_company_id.eq.${companyId},landlord_id.eq.${user.id}`
        );
      } else {
        leasesQuery = leasesQuery.eq("landlord_id", user.id);
      }

      const { data: leaseRows, error: leasesError } = await leasesQuery;

      if (leasesError) {
        setErrorMessage(leasesError.message);
        setLoading(false);
        return;
      }

      let chargesQuery = supabase
        .from("rent_charges")
        .select("id, amount_cents, status, due_date")
        .order("due_date", { ascending: true });

      if (companyId) {
        chargesQuery = chargesQuery.or(
          `landlord_company_id.eq.${companyId},landlord_id.eq.${user.id}`
        );
      } else {
        chargesQuery = chargesQuery.eq("landlord_id", user.id);
      }

      const { data: chargeRows, error: chargesError } = await chargesQuery;

      if (chargesError) {
        setErrorMessage(chargesError.message);
        setLoading(false);
        return;
      }

      let maintenanceQuery = supabase
        .from("maintenance_requests")
        .select("id, title, status, priority, created_at")
        .order("created_at", { ascending: false });

      if (companyId) {
        maintenanceQuery = maintenanceQuery.or(
          `landlord_company_id.eq.${companyId},landlord_id.eq.${user.id}`
        );
      } else {
        maintenanceQuery = maintenanceQuery.eq("landlord_id", user.id);
      }

      const { data: maintenanceRows, error: maintenanceError } =
        await maintenanceQuery;

      if (maintenanceError) {
        setErrorMessage(maintenanceError.message);
        setLoading(false);
        return;
      }

      setListings((data || []) as unknown as PropertyWithApplications[]);
      setLeases((leaseRows || []) as LandlordLease[]);
      setRentCharges((chargeRows || []) as RentCharge[]);
      setMaintenanceRequests((maintenanceRows || []) as MaintenanceRequest[]);
      setLoading(false);
    }

    loadDashboard();
  }, []);

  function statusLabel(status: string) {
    if (status === "pending") return "Pending Review";
    if (status === "published") return "Published";
    if (status === "draft") return "Draft";
    if (status === "paused") return "Paused";
    if (status === "archived") return "Archived";
    if (status === "rejected") return "Rejected";
    return status;
  }

  function leaseStatusLabel(status: string) {
    if (status === "draft") return "Draft";
    if (status === "sent_to_tenant") return "Sent to Tenant";
    if (status === "tenant_signed") return "Needs Your Signature";
    if (status === "completed") return "Completed";
    if (status === "cancelled") return "Cancelled";
    return status;
  }

  function statusClass(status: string) {
    if (status === "published") return "bg-green-50 text-green-700";
    if (status === "pending") return "bg-yellow-50 text-yellow-700";
    if (status === "rejected") return "bg-red-50 text-red-700";
    return "bg-slate-100 text-slate-600";
  }

  function leaseStatusClass(status: string) {
    if (status === "completed") return "bg-green-50 text-green-700";
    if (status === "tenant_signed") return "bg-yellow-50 text-yellow-700";
    if (status === "sent_to_tenant") return "bg-blue-50 text-blue-700";
    return "bg-slate-100 text-slate-600";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-black sm:text-3xl">
            Loading dashboard...
          </h1>
        </div>
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <div className="rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <h1 className="text-3xl font-black">Please log in</h1>
            <p className="mt-3 text-slate-600">
              {errorMessage ||
                "You need to log in as a landlord to view this dashboard."}
            </p>
            <Link
              href="/auth/login"
              className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
            >
              Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isPersonalLandlord = !hasCompany;

  const canManageListings =
    isPersonalLandlord || isFullCompanyManager(companyRole);
  const canManageApplications =
    isPersonalLandlord || isFullCompanyManager(companyRole);
  const canManageLeases =
    isPersonalLandlord || isFullCompanyManager(companyRole);

  const canViewLeases =
    isPersonalLandlord ||
    isFullCompanyManager(companyRole) ||
    companyRole === "accounting" ||
    companyRole === "viewer";

  const canManagePayments = isPersonalLandlord || canUsePayments(companyRole);

  const canManageMaintenance =
    isPersonalLandlord || canUseMaintenance(companyRole);

  const canViewListings =
    isPersonalLandlord ||
    isFullCompanyManager(companyRole) ||
    companyRole === "viewer";

  const canViewMaintenance =
    isPersonalLandlord ||
    canUseMaintenance(companyRole) ||
    companyRole === "viewer";

  const canViewDashboardData =
    isPersonalLandlord || canReadCompanyData(companyRole);

  const totalApplications = listings.reduce(
    (total, listing) => total + getApplications(listing).length,
    0
  );

  const screeningApprovedApplications = listings.flatMap((listing) =>
    getApplications(listing).filter(
      (application) => application.screening_status === "tenant_approved"
    )
  );

  const screeningRequestedApplications = listings.flatMap((listing) =>
    getApplications(listing).filter(
      (application) =>
        application.screening_status === "requested" ||
        application.screening_status === "in_progress"
    )
  );

  const publishedListings = listings.filter(
    (listing) => listing.status === "published"
  ).length;

  const pendingListings = listings.filter(
    (listing) => listing.status === "pending"
  ).length;

  const rejectedListings = listings.filter(
    (listing) => listing.status === "rejected"
  ).length;

  const leasesNeedingSignature = leases.filter(
    (lease) => lease.lease_status === "tenant_signed"
  );

  const sentLeases = leases.filter(
    (lease) => lease.lease_status === "sent_to_tenant"
  );

  const completedLeases = leases.filter(
    (lease) => lease.lease_status === "completed"
  );

  const leasesEndingSoon = leases.filter((lease) => {
    if (!lease.lease_end_date) return false;
    if (lease.lease_status === "cancelled") return false;

    const daysUntilEnd = getDaysUntilLeaseEnds(lease.lease_end_date);

    return daysUntilEnd !== null && daysUntilEnd >= 0 && daysUntilEnd <= 90;
  });

  const leaseEndingSoon = leasesEndingSoon[0];

  const unpaidCharges = rentCharges.filter(
    (charge) => charge.status === "unpaid" || charge.status === "overdue"
  );

  const unpaidBalance = unpaidCharges.reduce(
    (sum, charge) => sum + charge.amount_cents,
    0
  );

  const paidCharges = rentCharges.filter((charge) => charge.status === "paid");

  const paidTotal = paidCharges.reduce(
    (sum, charge) => sum + charge.amount_cents,
    0
  );

  const activeMaintenance = maintenanceRequests.filter(
    (request) => request.status === "open" || request.status === "in_progress"
  );

  const urgentMaintenance = maintenanceRequests.filter(
    (request) =>
      (request.priority === "urgent" || request.priority === "emergency") &&
      (request.status === "open" || request.status === "in_progress")
  );

  const recentLeases = leases.slice(0, 4);
  const recentMaintenance = maintenanceRequests.slice(0, 3);
  const recentListings = listings.slice(0, 6);

  const allowedTabs: DashboardTab[] = ["overview"];

  if (canViewListings) allowedTabs.push("listings");
  if (canViewLeases) allowedTabs.push("leases");
  if (canManagePayments) allowedTabs.push("payments");
  if (canViewMaintenance) allowedTabs.push("maintenance");

  const safeActiveTab = allowedTabs.includes(activeTab)
    ? activeTab
    : "overview";

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <Link href="/" className="text-sm font-bold text-slate-600">
            ← Back to Home
          </Link>

          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Landlord
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
                Dashboard
              </h1>

              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                Manage company listings, applications, leases, rent payments,
                and maintenance in one place.
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

            {canManageListings && (
              <Link
                href="/dashboard/landlord/properties/new"
                className="rounded-full bg-slate-950 px-6 py-4 text-center text-base font-black text-white shadow-sm"
              >
                Post New Listing
              </Link>
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {isPersonalLandlord || isFullCompanyManager(companyRole) ? (
              <>
                <QuickLink href="/dashboard/landlord/company" label="Company" />
                <QuickLink href="/dashboard/landlord/team" label="Team" />
                <QuickLink
                  href="/dashboard/landlord/lease-builder"
                  label="Lease Builder"
                />
                <QuickLink
                  href="/dashboard/landlord/verification"
                  label="Verification"
                />
              </>
            ) : null}

            {canManagePayments && (
              <QuickLink href="/dashboard/landlord/payments" label="Payments" />
            )}

            {canManageMaintenance && (
              <QuickLink
                href="/dashboard/landlord/maintenance"
                label="Maintenance"
              />
            )}

            <QuickLink href="/dashboard/notifications" label="Notifications" />
          </div>

          {canViewDashboardData && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <TabButton
                active={safeActiveTab === "overview"}
                label="Overview"
                onClick={() => setActiveTab("overview")}
              />

              {canViewListings && (
                <TabButton
                  active={safeActiveTab === "listings"}
                  label={`Listings (${listings.length})`}
                  onClick={() => setActiveTab("listings")}
                />
              )}

              {canViewLeases && (
                <TabButton
                  active={safeActiveTab === "leases"}
                  label={`Leases (${leases.length})`}
                  onClick={() => setActiveTab("leases")}
                />
              )}

              {canManagePayments && (
                <TabButton
                  active={safeActiveTab === "payments"}
                  label={`Payments (${unpaidCharges.length})`}
                  onClick={() => setActiveTab("payments")}
                />
              )}

              {canViewMaintenance && (
                <TabButton
                  active={safeActiveTab === "maintenance"}
                  label={`Maintenance (${activeMaintenance.length})`}
                  onClick={() => setActiveTab("maintenance")}
                />
              )}
            </div>
          )}
        </div>

        {!hasCompany && (
          <div className="mt-6 rounded-[2rem] bg-blue-50 p-5 shadow-sm ring-1 ring-blue-200 sm:p-6">
            <h2 className="text-2xl font-black text-blue-950">
              Create your landlord company
            </h2>

            <p className="mt-2 max-w-3xl font-bold leading-7 text-blue-800">
              Company setup lets you invite team members and manage listings,
              applications, payments, leases, and maintenance under one landlord
              organization.
            </p>

            <Link
              href="/dashboard/landlord/company"
              className="mt-5 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
            >
              Create Company
            </Link>
          </div>
        )}

        {hasCompany && companyRole === "viewer" && (
          <div className="mt-6 rounded-[2rem] bg-slate-50 p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <h2 className="text-2xl font-black text-slate-950">
              Read-only access
            </h2>

            <p className="mt-2 max-w-3xl font-bold leading-7 text-slate-600">
              Your company role can view dashboard information but cannot create,
              edit, approve, sign, pay, or delete company records.
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-2xl bg-white px-5 py-4 font-bold text-red-700 shadow-sm ring-1 ring-red-200">
            {errorMessage}
          </div>
        )}

        {!canViewDashboardData && (
          <div className="mt-6 rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <h2 className="text-2xl font-black">No dashboard access</h2>
            <p className="mt-3 text-slate-600">
              Your company role does not have permission to view this dashboard.
            </p>
          </div>
        )}

        {canViewDashboardData && safeActiveTab === "overview" && (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {canManagePayments && (
                <DashboardCard
                  title="Unpaid"
                  value={formatMoneyFromCents(unpaidBalance)}
                  text={`${unpaidCharges.length} unpaid charge${
                    unpaidCharges.length === 1 ? "" : "s"
                  }`}
                  href="/dashboard/landlord/payments"
                  urgent={unpaidBalance > 0}
                />
              )}

              {canViewMaintenance && (
                <DashboardCard
                  title="Maintenance"
                  value={String(activeMaintenance.length)}
                  text={`${urgentMaintenance.length} urgent · ${maintenanceRequests.length} total`}
                  href={
                    canManageMaintenance
                      ? "/dashboard/landlord/maintenance"
                      : undefined
                  }
                  urgent={urgentMaintenance.length > 0}
                />
              )}

              {canViewListings && (
                <DashboardCard
                  title="Applications"
                  value={String(totalApplications)}
                  text={`${publishedListings} published listing${
                    publishedListings === 1 ? "" : "s"
                  }`}
                  href="#listings"
                />
              )}

              {canViewLeases && (
                <DashboardCard
                  title="Leases"
                  value={String(leases.length)}
                  text={`${leasesNeedingSignature.length} sign · ${completedLeases.length} done`}
                  href="#leases"
                  urgent={
                    canManageLeases &&
                    (leasesNeedingSignature.length > 0 ||
                      leasesEndingSoon.length > 0)
                  }
                />
              )}
            </section>

            <section className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                    Overview
                  </p>

                  <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                    Needs attention
                  </h2>
                </div>

                {isPersonalLandlord || isFullCompanyManager(companyRole) ? (
                  <Link
                    href="/dashboard/landlord/profile"
                    className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black"
                  >
                    Profile
                  </Link>
                ) : null}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {canManageLeases && leaseEndingSoon && (
                  <ActionCard
                    title="Lease ending soon"
                    text={`${
                      leaseEndingSoon.tenant_name || "A tenant"
                    } has a lease ending on ${leaseEndingSoon.lease_end_date}.`}
                    href={`/dashboard/landlord/leases/${leaseEndingSoon.id}/renewal`}
                    button="Renewal Plan"
                  />
                )}

                {canManageLeases && leasesNeedingSignature.length > 0 && (
                  <ActionCard
                    title="Sign lease"
                    text={`${leasesNeedingSignature.length} lease${
                      leasesNeedingSignature.length === 1 ? "" : "s"
                    } waiting for your signature.`}
                    href={`/dashboard/landlord/leases/${leasesNeedingSignature[0].id}`}
                    button="Open Lease"
                  />
                )}

                {canManagePayments && unpaidBalance > 0 && (
                  <ActionCard
                    title="Unpaid charges"
                    text={`${formatMoneyFromCents(
                      unpaidBalance
                    )} is currently unpaid.`}
                    href="/dashboard/landlord/payments"
                    button="Payments"
                  />
                )}

                {canManageMaintenance && urgentMaintenance.length > 0 && (
                  <ActionCard
                    title="Urgent maintenance"
                    text={`${urgentMaintenance.length} urgent or emergency request${
                      urgentMaintenance.length === 1 ? "" : "s"
                    }.`}
                    href="/dashboard/landlord/maintenance"
                    button="Open Requests"
                  />
                )}

                {canManageApplications &&
                  screeningApprovedApplications.length > 0 && (
                    <ActionCard
                      title="Screening approved"
                      text={`${screeningApprovedApplications.length} tenant${
                        screeningApprovedApplications.length === 1
                          ? " has"
                          : "s have"
                      } approved screening consent.`}
                      href="#listings"
                      button="Applicants"
                    />
                  )}

                {canManageApplications &&
                  screeningRequestedApplications.length > 0 && (
                    <ActionCard
                      title="Screening pending"
                      text={`${screeningRequestedApplications.length} request${
                        screeningRequestedApplications.length === 1 ? "" : "s"
                      } still pending.`}
                      href="#listings"
                      button="Applicants"
                    />
                  )}

                {canManageListings && pendingListings > 0 && (
                  <ActionCard
                    title="Listings pending"
                    text={`${pendingListings} listing${
                      pendingListings === 1 ? " is" : "s are"
                    } waiting for admin review.`}
                    href="#listings"
                    button="Listings"
                  />
                )}

                {canManageListings && rejectedListings > 0 && (
                  <ActionCard
                    title="Fix rejected listings"
                    text={`${rejectedListings} listing${
                      rejectedListings === 1 ? " needs" : "s need"
                    } changes before resubmitting.`}
                    href="#listings"
                    button="Review"
                  />
                )}

                {leasesEndingSoon.length === 0 &&
                  leasesNeedingSignature.length === 0 &&
                  unpaidBalance === 0 &&
                  urgentMaintenance.length === 0 &&
                  pendingListings === 0 &&
                  rejectedListings === 0 &&
                  screeningApprovedApplications.length === 0 &&
                  screeningRequestedApplications.length === 0 && (
                    <div className="rounded-3xl bg-[#f7f4ef] p-5 md:col-span-2 xl:col-span-4">
                      <h3 className="text-2xl font-black">All caught up</h3>
                      <p className="mt-2 text-slate-600">
                        No urgent maintenance, unpaid charges, lease signatures,
                        lease renewals, or listing issues need attention right
                        now.
                      </p>
                    </div>
                  )}
              </div>
            </section>
          </>
        )}

        {canViewListings && safeActiveTab === "listings" && (
          <section
            id="listings"
            className="mt-6 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200"
          >
            <SectionHeader
              title={hasCompany ? "Company Listings" : "Your Listings"}
              badge={`${listings.length} total`}
              href="/dashboard/landlord/properties"
              hrefLabel="View All Listings"
            />

            {recentListings.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {recentListings.map((listing) => (
                  <ListingRow
                    key={listing.id}
                    listing={listing}
                    statusClass={statusClass}
                    statusLabel={statusLabel}
                    canManageListings={canManageListings}
                    canManageApplications={canManageApplications}
                  />
                ))}
              </div>
            ) : (
              <EmptySection
                title="No listings yet"
                text="Post your first rental listing to start receiving applications."
                href={
                  canManageListings
                    ? "/dashboard/landlord/properties/new"
                    : undefined
                }
                button={canManageListings ? "Post First Listing" : undefined}
              />
            )}

            {listings.length > recentListings.length && (
              <div className="border-t border-slate-200 p-5 text-center">
                <Link
                  href="/dashboard/landlord/properties"
                  className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
                >
                  View All {listings.length} Listings
                </Link>
              </div>
            )}
          </section>
        )}

        {canViewLeases && safeActiveTab === "leases" && (
          <div className="mt-6 grid gap-6">
            {canManageLeases && (
              <section className="rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
                <SectionHeader title="Leases Needing Signature" />

                {leasesNeedingSignature.length > 0 ? (
                  <div className="divide-y divide-slate-200">
                    {leasesNeedingSignature.map((lease) => (
                      <LeaseSignatureRow key={lease.id} lease={lease} />
                    ))}
                  </div>
                ) : (
                  <EmptySection
                    title="No signatures needed"
                    text="When a tenant signs a lease, it will appear here for your final signature."
                  />
                )}
              </section>
            )}

            <section
              id="leases"
              className="rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200"
            >
              <SectionHeader
                title="Recent Leases"
                badge={`${sentLeases.length} sent`}
                href="/dashboard/landlord/leases"
                hrefLabel="View All Leases"
              />

              {recentLeases.length > 0 ? (
                <div className="divide-y divide-slate-200">
                  {recentLeases.map((lease) => (
                    <LeaseRow
                      key={lease.id}
                      lease={lease}
                      leaseStatusClass={leaseStatusClass}
                      leaseStatusLabel={leaseStatusLabel}
                      canManageLeases={canManageLeases}
                    />
                  ))}
                </div>
              ) : (
                <EmptySection
                  title="No leases yet"
                  text="Leases will appear here after they are created from approved applications."
                />
              )}

              {leases.length > recentLeases.length && (
                <div className="border-t border-slate-200 p-5 text-center">
                  <Link
                    href="/dashboard/landlord/leases"
                    className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
                  >
                    View All {leases.length} Leases
                  </Link>
                </div>
              )}
            </section>
          </div>
        )}

        {canManagePayments && safeActiveTab === "payments" && (
          <section className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                  Payments
                </p>

                <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                  Rent & Deposit Tracking
                </h2>

                <p className="mt-2 text-slate-600">
                  Review unpaid balances, collected payments, and lease charges.
                </p>
              </div>

              <Link
                href="/dashboard/landlord/payments"
                className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-black text-white"
              >
                View All Payments
              </Link>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-3">
              <MiniStat
                title="Unpaid Balance"
                value={formatMoneyFromCents(unpaidBalance)}
                text={`${unpaidCharges.length} unpaid charge${
                  unpaidCharges.length === 1 ? "" : "s"
                }`}
                urgent={unpaidBalance > 0}
              />

              <MiniStat
                title="Collected"
                value={formatMoneyFromCents(paidTotal)}
                text={`${paidCharges.length} paid charge${
                  paidCharges.length === 1 ? "" : "s"
                }`}
              />

              <MiniStat
                title="Total Charges"
                value={String(rentCharges.length)}
                text="Across company leases"
              />
            </div>
          </section>
        )}

        {canViewMaintenance && safeActiveTab === "maintenance" && (
          <section className="mt-6 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
            <SectionHeader
              title="Recent Maintenance"
              badge={`${activeMaintenance.length} active`}
              href={
                canManageMaintenance
                  ? "/dashboard/landlord/maintenance"
                  : undefined
              }
              hrefLabel="View All Maintenance"
            />

            {recentMaintenance.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {recentMaintenance.map((request) => (
                  <MaintenanceRow
                    key={request.id}
                    request={request}
                    canManageMaintenance={canManageMaintenance}
                  />
                ))}
              </div>
            ) : (
              <EmptySection
                title="No maintenance requests"
                text="Tenant repair requests will appear here."
              />
            )}

            {maintenanceRequests.length > recentMaintenance.length &&
              canManageMaintenance && (
                <div className="border-t border-slate-200 p-5 text-center">
                  <Link
                    href="/dashboard/landlord/maintenance"
                    className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
                  >
                    View All {maintenanceRequests.length} Maintenance Requests
                  </Link>
                </div>
              )}
          </section>
        )}
      </div>
    </main>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-300 bg-white px-4 py-4 text-center text-sm font-black text-slate-950 shadow-sm"
    >
      {label}
    </Link>
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

function DashboardCard({
  title,
  value,
  text,
  href,
  urgent = false,
}: {
  title: string;
  value: string;
  text: string;
  href?: string;
  urgent?: boolean;
}) {
  const card = (
    <div
      className={`h-full rounded-3xl p-5 shadow-sm ring-1 transition sm:p-6 ${
        urgent ? "bg-yellow-50 ring-yellow-200" : "bg-white ring-slate-200"
      } ${href ? "hover:-translate-y-0.5 hover:shadow-md" : ""}`}
    >
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 sm:text-sm">
        {title}
      </p>
      <p className="mt-3 text-3xl font-black sm:text-4xl">{value}</p>
      <p className="mt-2 text-sm font-bold text-slate-500">{text}</p>
    </div>
  );

  if (!href) return card;

  return <Link href={href}>{card}</Link>;
}

function MiniStat({
  title,
  value,
  text,
  urgent = false,
}: {
  title: string;
  value: string;
  text: string;
  urgent?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-5 ring-1 ${
        urgent ? "bg-yellow-50 ring-yellow-200" : "bg-[#f7f4ef] ring-slate-200"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>

      <p className="mt-3 text-3xl font-black">{value}</p>

      <p className="mt-2 text-sm font-bold text-slate-500">{text}</p>
    </div>
  );
}

function ActionCard({
  title,
  text,
  href,
  button,
}: {
  title: string;
  text: string;
  href: string;
  button: string;
}) {
  return (
    <div className="rounded-3xl bg-[#f7f4ef] p-5">
      <h3 className="text-lg font-black sm:text-xl">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>

      <Link
        href={href}
        className="mt-4 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
      >
        {button}
      </Link>
    </div>
  );
}

function SectionHeader({
  title,
  badge,
  href,
  hrefLabel = "View All",
}: {
  title: string;
  badge?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <h2 className="text-2xl font-black">{title}</h2>

      <div className="flex flex-wrap gap-3">
        {badge && (
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
            {badge}
          </span>
        )}

        {href && (
          <Link
            href={href}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white"
          >
            {hrefLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

function LeaseSignatureRow({ lease }: { lease: LandlordLease }) {
  return (
    <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-black sm:text-xl">
            Lease for {lease.tenant_name || "Tenant"}
          </h3>

          <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-black text-yellow-700">
            Needs Your Signature
          </span>
        </div>

        <p className="mt-2 font-bold text-slate-500">
          {lease.property_address || "No property address provided"}
        </p>

        <p className="mt-2 text-sm font-bold text-slate-500">
          {lease.monthly_rent
            ? `$${lease.monthly_rent.toLocaleString()}/mo`
            : "Rent not provided"}
          {lease.tenant_signed_at
            ? ` · Tenant signed ${new Date(
                lease.tenant_signed_at
              ).toLocaleString()}`
            : ""}
        </p>
      </div>

      <Link
        href={`/dashboard/landlord/leases/${lease.id}`}
        className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
      >
        Open & Sign
      </Link>
    </div>
  );
}

function LeaseRow({
  lease,
  leaseStatusClass,
  leaseStatusLabel,
  canManageLeases,
}: {
  lease: LandlordLease;
  leaseStatusClass: (status: string) => string;
  leaseStatusLabel: (status: string) => string;
  canManageLeases: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-black sm:text-xl">
            Lease for {lease.tenant_name || "Tenant"}
          </h3>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${leaseStatusClass(
              lease.lease_status
            )}`}
          >
            {leaseStatusLabel(lease.lease_status)}
          </span>
        </div>

        <p className="mt-2 font-bold text-slate-500">
          {lease.property_address || "No property address provided"}
        </p>

        <p className="mt-2 text-sm font-bold text-slate-500">
          {lease.monthly_rent
            ? `$${lease.monthly_rent.toLocaleString()}/mo`
            : "Rent not provided"}
          {lease.lease_start_date && lease.lease_end_date
            ? ` · ${lease.lease_start_date} to ${lease.lease_end_date}`
            : ""}
        </p>
      </div>

      {canManageLeases && (
        <div className="grid gap-3 sm:flex sm:flex-row">
          <Link
            href={`/dashboard/landlord/leases/${lease.id}/renewal`}
            className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
          >
            Renewal
          </Link>

          <Link
            href={`/dashboard/landlord/leases/${lease.id}`}
            className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
          >
            View
          </Link>
        </div>
      )}
    </div>
  );
}

function MaintenanceRow({
  request,
  canManageMaintenance,
}: {
  request: MaintenanceRequest;
  canManageMaintenance: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-black sm:text-xl">{request.title}</h3>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${
              request.priority === "urgent" || request.priority === "emergency"
                ? "bg-red-50 text-red-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {request.priority}
          </span>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
            {request.status}
          </span>
        </div>

        <p className="mt-2 text-sm font-bold text-slate-500">
          Submitted {new Date(request.created_at).toLocaleDateString()}
        </p>
      </div>

      {canManageMaintenance && (
        <Link
          href="/dashboard/landlord/maintenance"
          className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
        >
          Open
        </Link>
      )}
    </div>
  );
}

function ListingRow({
  listing,
  statusClass,
  statusLabel,
  canManageListings,
  canManageApplications,
}: {
  listing: PropertyWithApplications;
  statusClass: (status: string) => string;
  statusLabel: (status: string) => string;
  canManageListings: boolean;
  canManageApplications: boolean;
}) {
  return (
    <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-black sm:text-xl">{listing.title}</h3>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
              listing.status
            )}`}
          >
            {statusLabel(listing.status)}
          </span>
        </div>

        <p className="mt-2 font-bold text-slate-500">
          {listing.city}, {listing.state} · $
          {listing.monthly_rent.toLocaleString()}/mo
        </p>

        <p className="mt-2 text-sm font-bold text-slate-500">
          {getApplications(listing).length} application
          {getApplications(listing).length === 1 ? "" : "s"}
        </p>

        {listing.status === "pending" && (
          <div className="mt-3 rounded-2xl bg-yellow-50 px-4 py-3 text-sm font-bold text-yellow-700">
            This listing is waiting for admin approval before it appears
            publicly.
          </div>
        )}

        {listing.status === "rejected" && listing.rejection_note && (
          <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            Rejection reason: {listing.rejection_note}
          </div>
        )}

        {listing.status === "rejected" && !listing.rejection_note && (
          <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            This listing was rejected. Please edit and resubmit.
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:flex sm:flex-row sm:flex-wrap">
        <Link
          href={`/dashboard/landlord/properties/${listing.id}/preview`}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
        >
          Preview
        </Link>

        {listing.status === "published" && (
          <Link
            href={`/listings/${listing.id}`}
            className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
          >
            Public
          </Link>
        )}

        {canManageListings && (
          <Link
            href={`/dashboard/landlord/properties/${listing.id}/edit`}
            className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
          >
            Edit
          </Link>
        )}

        {canManageListings && listing.status === "rejected" && (
          <ResubmitListingButton propertyId={listing.id} />
        )}

        {canManageListings && <ArchiveListingButton propertyId={listing.id} />}

        {canManageApplications && (
          <Link
            href={`/dashboard/landlord/properties/${listing.id}/applications`}
            className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
          >
            Applicants
          </Link>
        )}
      </div>
    </div>
  );
}

function EmptySection({
  title,
  text,
  href,
  button,
}: {
  title: string;
  text: string;
  href?: string;
  button?: string;
}) {
  return (
    <div className="p-8 text-center">
      <h3 className="text-2xl font-black">{title}</h3>

      <p className="mt-3 text-slate-600">{text}</p>

      {href && button && (
        <Link
          href={href}
          className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
        >
          {button}
        </Link>
      )}
    </div>
  );
}