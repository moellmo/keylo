"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminListingStatusButton from "./AdminListingStatusButton";
import UserRoleSelect from "./UserRoleSelect";
import RejectListingButton from "./RejectListingButton";

type AdminTab =
  | "overview"
  | "renewals"
  | "listings"
  | "applications"
  | "operations"
  | "leases"
  | "users";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
};

type Property = {
  id: string;
  landlord_id: string | null;
  title: string;
  monthly_rent: number;
  city: string;
  state: string;
  status: string;
  created_at: string;
  rejection_note: string | null;
};

type Application = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  screening_status: string | null;
  created_at: string;
  properties:
    | {
        title: string;
        city: string;
        state: string;
      }
    | {
        title: string;
        city: string;
        state: string;
      }[]
    | null;
};

type Lease = {
  id: string;
  lease_status: string;
  renewal_status: string | null;
  tenant_name: string | null;
  landlord_name: string | null;
  property_address: string | null;
  monthly_rent: number | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  created_at: string;
};

type RentCharge = {
  id: string;
  amount_cents: number;
  status: "unpaid" | "paid" | "overdue" | "waived" | "cancelled";
  due_date: string;
  created_at: string;
};

type MaintenanceRequest = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "resolved" | "closed" | "cancelled";
  priority: "low" | "normal" | "urgent" | "emergency";
  created_at: string;
};

type ScreeningRequest = {
  id: string;
  application_id: string;
  status:
    | "requested"
    | "tenant_approved"
    | "tenant_declined"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "failed";
  screening_type: string;
  provider: string | null;
  requested_at: string;
};

type LandlordVerification = {
  id: string;
  landlord_id: string;
  created_at: string;
};

type LeaseRenewalRequest = {
  id: string;
  lease_id: string;
  renewal_lease_id: string | null;
  request_type:
    | "tenant_requests_renewal"
    | "tenant_plans_to_move_out"
    | "landlord_asks_plan"
    | "landlord_offers_renewal"
    | "landlord_declines_renewal";
  status: string;
  current_lease_end_date: string | null;
  proposed_lease_start_date: string | null;
  proposed_lease_end_date: string | null;
  proposed_monthly_rent: number | null;
  tenant_message: string | null;
  landlord_message: string | null;
  created_at: string;
};

const PREVIEW_LIMIT = 6;

function formatMoneyFromCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "Not provided";
  return `$${value.toLocaleString()}`;
}

function getApplicationProperty(application: Application) {
  if (Array.isArray(application.properties)) {
    return application.properties[0] || null;
  }

  return application.properties;
}

function formatScreeningStatus(status: string | null) {
  if (!status || status === "not_requested") return "Not Requested";
  if (status === "requested") return "Requested";
  if (status === "tenant_approved") return "Tenant Approved";
  if (status === "tenant_declined") return "Tenant Declined";
  if (status === "in_progress") return "In Progress";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "failed") return "Failed";

  return status.replaceAll("_", " ");
}

function screeningStatusClass(status: string | null) {
  if (status === "tenant_approved") return "bg-green-50 text-green-700";

  if (status === "tenant_declined" || status === "failed") {
    return "bg-red-50 text-red-700";
  }

  if (status === "requested" || status === "in_progress") {
    return "bg-yellow-50 text-yellow-700";
  }

  return "bg-slate-100 text-slate-600";
}

function listingStatusClass(status: string) {
  if (status === "published") return "bg-green-50 text-green-700";
  if (status === "pending") return "bg-yellow-50 text-yellow-700";
  if (status === "rejected") return "bg-red-50 text-red-700";
  return "bg-slate-100 text-slate-600";
}

function maintenanceStatusClass(status: string, priority: string) {
  if (status === "resolved" || status === "closed") {
    return "bg-green-50 text-green-700";
  }

  if (priority === "urgent" || priority === "emergency") {
    return "bg-red-50 text-red-700";
  }

  return "bg-yellow-50 text-yellow-700";
}

function formatRenewalType(type: string) {
  if (type === "tenant_requests_renewal") return "Tenant Wants to Renew";
  if (type === "tenant_plans_to_move_out") return "Tenant Plans to Move Out";
  if (type === "landlord_asks_plan") return "Landlord Asked for Plan";
  if (type === "landlord_offers_renewal") return "Renewal Offered";
  if (type === "landlord_declines_renewal") return "Renewal Declined";

  return type.replaceAll("_", " ");
}

function formatRenewalStatus(status: string) {
  if (status === "open") return "Open";
  if (status === "tenant_responded") return "Tenant Responded";
  if (status === "landlord_responded") return "Landlord Responded";
  if (status === "renewal_sent") return "Renewal Lease Sent";
  if (status === "renewal_signed") return "Renewal Signed";
  if (status === "move_out_confirmed") return "Move-Out Confirmed";
  if (status === "closed") return "Closed";
  if (status === "cancelled") return "Cancelled";

  return status.replaceAll("_", " ");
}

function renewalStatusClass(status: string, requestType: string) {
  if (status === "renewal_signed") return "bg-green-50 text-green-700";

  if (
    requestType === "tenant_plans_to_move_out" ||
    requestType === "landlord_declines_renewal"
  ) {
    return "bg-red-50 text-red-700";
  }

  if (status === "renewal_sent" || requestType === "landlord_offers_renewal") {
    return "bg-blue-50 text-blue-700";
  }

  return "bg-yellow-50 text-yellow-700";
}

function formatLeaseStatus(status: string) {
  if (status === "draft") return "Draft";
  if (status === "sent_to_tenant") return "Sent to Tenant";
  if (status === "tenant_signed") return "Tenant Signed";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";

  return status.replaceAll("_", " ");
}

function getDaysUntilLeaseEnds(leaseEndDate: string | null) {
  if (!leaseEndDate) return null;

  const today = new Date();
  const endDate = new Date(`${leaseEndDate}T00:00:00`);

  return Math.ceil(
    (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [rentCharges, setRentCharges] = useState<RentCharge[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<
    MaintenanceRequest[]
  >([]);
  const [screeningRequests, setScreeningRequests] = useState<
    ScreeningRequest[]
  >([]);
  const [landlordVerifications, setLandlordVerifications] = useState<
    LandlordVerification[]
  >([]);
  const [leaseRenewalRequests, setLeaseRenewalRequests] = useState<
    LeaseRenewalRequest[]
  >([]);

  useEffect(() => {
    loadAdmin();
  }, []);

  async function loadAdmin() {
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
      setMessage("You do not have permission to view the admin dashboard.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    setAllowed(true);

    const { data: profileRows, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (profilesError) {
      setMessage(`Profiles error: ${profilesError.message}`);
      setLoading(false);
      return;
    }

    const { data: propertyRows, error: propertiesError } = await supabase
      .from("properties")
      .select(
        "id, landlord_id, title, monthly_rent, city, state, status, rejection_note, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (propertiesError) {
      setMessage(`Listings error: ${propertiesError.message}`);
      setLoading(false);
      return;
    }

    const { data: applicationRows, error: applicationsError } = await supabase
      .from("applications")
      .select(
        `
        id,
        first_name,
        last_name,
        email,
        status,
        screening_status,
        created_at,
        properties (
          title,
          city,
          state
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (applicationsError) {
      setMessage(`Applications error: ${applicationsError.message}`);
      setLoading(false);
      return;
    }

    const { data: leaseRows, error: leasesError } = await supabase
      .from("leases")
      .select(
        `
        id,
        lease_status,
        renewal_status,
        tenant_name,
        landlord_name,
        property_address,
        monthly_rent,
        lease_start_date,
        lease_end_date,
        created_at
      `
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (leasesError) {
      setMessage(`Leases error: ${leasesError.message}`);
      setLoading(false);
      return;
    }

    const { data: chargeRows, error: chargesError } = await supabase
      .from("rent_charges")
      .select("id, amount_cents, status, due_date, created_at")
      .order("due_date", { ascending: true })
      .limit(100);

    if (chargesError) {
      setMessage(`Rent charges error: ${chargesError.message}`);
      setLoading(false);
      return;
    }

    const { data: maintenanceRows, error: maintenanceError } = await supabase
      .from("maintenance_requests")
      .select("id, title, status, priority, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (maintenanceError) {
      setMessage(`Maintenance error: ${maintenanceError.message}`);
      setLoading(false);
      return;
    }

    const { data: screeningRows, error: screeningError } = await supabase
      .from("screening_requests")
      .select(
        `
        id,
        application_id,
        status,
        screening_type,
        provider,
        requested_at
      `
      )
      .order("requested_at", { ascending: false })
      .limit(100);

    if (screeningError) {
      setMessage(`Screening error: ${screeningError.message}`);
      setLoading(false);
      return;
    }

    const { data: verificationRows, error: verificationError } = await supabase
      .from("landlord_verifications")
      .select("id, landlord_id, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (verificationError) {
      setMessage(`Landlord verification error: ${verificationError.message}`);
      setLoading(false);
      return;
    }

    const { data: renewalRows, error: renewalError } = await supabase
      .from("lease_renewal_requests")
      .select(
        `
        id,
        lease_id,
        renewal_lease_id,
        request_type,
        status,
        current_lease_end_date,
        proposed_lease_start_date,
        proposed_lease_end_date,
        proposed_monthly_rent,
        tenant_message,
        landlord_message,
        created_at
      `
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (renewalError) {
      setMessage(`Renewals error: ${renewalError.message}`);
      setLoading(false);
      return;
    }

    setProfiles((profileRows || []) as Profile[]);
    setProperties((propertyRows || []) as Property[]);
    setApplications((applicationRows || []) as unknown as Application[]);
    setLeases((leaseRows || []) as Lease[]);
    setRentCharges((chargeRows || []) as RentCharge[]);
    setMaintenanceRequests((maintenanceRows || []) as MaintenanceRequest[]);
    setScreeningRequests((screeningRows || []) as ScreeningRequest[]);
    setLandlordVerifications(
      (verificationRows || []) as LandlordVerification[]
    );
    setLeaseRenewalRequests((renewalRows || []) as LeaseRenewalRequest[]);

    setLoading(false);
  }

  function getLandlordName(landlordId: string | null) {
    if (!landlordId) return "Unknown";

    const landlord = profiles.find((profile) => profile.id === landlordId);

    return landlord?.full_name || landlord?.email || "Unknown";
  }

  const dashboardData = useMemo(() => {
    const publishedListings = properties.filter(
      (property) => property.status === "published"
    ).length;

    const pendingListings = properties.filter(
      (property) => property.status === "pending"
    );

    const rejectedListings = properties.filter(
      (property) => property.status === "rejected"
    );

    const pendingApplications = applications.filter(
      (application) =>
        application.status === "submitted" || application.status === "reviewing"
    ).length;

    const activeLeases = leases.filter(
      (lease) =>
        lease.lease_status !== "completed" && lease.lease_status !== "cancelled"
    );

    const leasesEndingSoon = leases.filter((lease) => {
      if (!lease.lease_end_date) return false;
      if (lease.lease_status === "cancelled") return false;

      const daysUntilEnd = getDaysUntilLeaseEnds(lease.lease_end_date);

      return daysUntilEnd !== null && daysUntilEnd >= 0 && daysUntilEnd <= 90;
    });

    const unpaidCharges = rentCharges.filter(
      (charge) => charge.status === "unpaid" || charge.status === "overdue"
    );

    const unpaidBalance = unpaidCharges.reduce(
      (sum, charge) => sum + charge.amount_cents,
      0
    );

    const activeMaintenance = maintenanceRequests.filter(
      (request) =>
        request.status === "open" || request.status === "in_progress"
    );

    const urgentMaintenance = maintenanceRequests.filter(
      (request) =>
        (request.priority === "urgent" || request.priority === "emergency") &&
        (request.status === "open" || request.status === "in_progress")
    );

    const pendingScreenings = screeningRequests.filter(
      (request) =>
        request.status === "requested" || request.status === "in_progress"
    );

    const approvedScreenings = screeningRequests.filter(
      (request) => request.status === "tenant_approved"
    );

    const tenantsWantToRenew = leaseRenewalRequests.filter(
      (request) => request.request_type === "tenant_requests_renewal"
    );

    const tenantsMovingOut = leaseRenewalRequests.filter(
      (request) => request.request_type === "tenant_plans_to_move_out"
    );

    const renewalOffersSent = leaseRenewalRequests.filter(
      (request) => request.request_type === "landlord_offers_renewal"
    );

    const renewalLeasesSent = leaseRenewalRequests.filter(
      (request) => request.status === "renewal_sent"
    );

    const renewalCompleted = leaseRenewalRequests.filter(
      (request) => request.status === "renewal_signed"
    );

    return {
      publishedListings,
      pendingListings,
      rejectedListings,
      pendingApplications,
      activeLeases,
      leasesEndingSoon,
      unpaidCharges,
      unpaidBalance,
      activeMaintenance,
      urgentMaintenance,
      pendingScreenings,
      approvedScreenings,
      pendingVerifications: landlordVerifications,
      tenantsWantToRenew,
      tenantsMovingOut,
      renewalOffersSent,
      renewalLeasesSent,
      renewalCompleted,
    };
  }, [
    applications,
    landlordVerifications,
    leaseRenewalRequests,
    leases,
    maintenanceRequests,
    properties,
    rentCharges,
    screeningRequests,
  ]);

  const tabs: { key: AdminTab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    {
      key: "renewals",
      label: "Renewals",
      count: leaseRenewalRequests.length,
    },
    {
      key: "listings",
      label: "Listings",
      count: properties.length,
    },
    {
      key: "applications",
      label: "Applications",
      count: applications.length,
    },
    {
      key: "operations",
      label: "Ops",
      count:
        rentCharges.length +
        maintenanceRequests.length +
        screeningRequests.length,
    },
    {
      key: "leases",
      label: "Leases",
      count: leases.length,
    },
    {
      key: "users",
      label: "Users",
      count: profiles.length,
    },
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading admin dashboard...</h1>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <h1 className="text-3xl font-black">Admin access required</h1>
            <p className="mt-3 text-slate-600">{message}</p>
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

  const allCaughtUp =
    dashboardData.pendingListings.length === 0 &&
    dashboardData.rejectedListings.length === 0 &&
    dashboardData.pendingVerifications.length === 0 &&
    dashboardData.urgentMaintenance.length === 0 &&
    dashboardData.approvedScreenings.length === 0 &&
    dashboardData.pendingApplications === 0 &&
    dashboardData.leasesEndingSoon.length === 0 &&
    leaseRenewalRequests.length === 0 &&
    dashboardData.unpaidBalance === 0;

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/" className="text-sm font-bold text-slate-600">
              ← Back to Home
            </Link>

            <h1 className="mt-4 text-5xl font-black tracking-tight">
              Admin Dashboard
            </h1>

            <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
              Review users, listings, applications, leases, payments,
              maintenance, screenings, renewals, and verification across Keylo.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/admin/landlord-verifications"
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              Landlord Verifications
            </Link>

            <Link
              href="/admin/email-logs"
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              Email Logs
            </Link>

            <Link
              href="/dashboard"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
            >
              My Dashboard
            </Link>
          </div>
        </div>

        {message && (
          <div className="mt-6 rounded-2xl bg-white px-5 py-4 font-bold text-red-700 shadow-sm ring-1 ring-red-200">
            {message}
          </div>
        )}

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
  <StatCard title="Users" value={profiles.length} href="/admin/users" />
  <StatCard title="Listings" value={properties.length} href="/admin/listings" />
  <StatCard
    title="Applications"
    value={applications.length}
    href="/admin/applications"
  />
  <StatCard title="Leases" value={leases.length} href="/admin/leases" />
  <StatCard
    title="Renewals"
    value={leaseRenewalRequests.length}
    href="/admin/renewals"
  />
  <StatCard
    title="Maintenance"
    value={maintenanceRequests.length}
    href="/admin/maintenance"
  />
  <StatCard
    title="Screenings"
    value={screeningRequests.length}
    href="/admin/screenings"
  />
  <StatCard
    title="Rent Charges"
    value={rentCharges.length}
    href="/admin/payments"
  />
  <StatCard
    title="Pending Listings"
    value={dashboardData.pendingListings.length}
    href="/admin/listings"
  />
  <StatCard
    title="Unpaid"
    value={formatMoneyFromCents(dashboardData.unpaidBalance)}
    href="/admin/payments"
  />
</section>

        <section className="mt-8 rounded-[2rem] bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="flex gap-2 overflow-x-auto p-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap rounded-full px-5 py-3 text-sm font-black ${
                  activeTab === tab.key
                    ? "bg-slate-950 text-white"
                    : "bg-[#f7f4ef] text-slate-700 hover:bg-slate-100"
                }`}
              >
                {tab.label}
                {typeof tab.count === "number" && (
                  <span className="ml-2 opacity-70">({tab.count})</span>
                )}
              </button>
            ))}
          </div>
        </section>

        {activeTab === "overview" && (
          <>
            <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Admin Attention
              </p>

              <h2 className="mt-2 text-3xl font-black">What needs review</h2>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {dashboardData.pendingListings.length > 0 && (
                  <ActionCard
                    title="Pending listings"
                    text={`${dashboardData.pendingListings.length} listing${
                      dashboardData.pendingListings.length === 1
                        ? " needs"
                        : "s need"
                    } approval.`}
                    onClick={() => setActiveTab("listings")}
                    button="Review Listings"
                  />
                )}

                {dashboardData.pendingVerifications.length > 0 && (
                  <ActionCard
                    title="Landlord verification"
                    text={`${
                      dashboardData.pendingVerifications.length
                    } verification request${
                      dashboardData.pendingVerifications.length === 1 ? "" : "s"
                    } need review.`}
                    href="/admin/landlord-verifications"
                    button="Open"
                  />
                )}

                {dashboardData.urgentMaintenance.length > 0 && (
                  <ActionCard
                    title="Urgent maintenance"
                    text={`${
                      dashboardData.urgentMaintenance.length
                    } urgent or emergency maintenance request${
                      dashboardData.urgentMaintenance.length === 1 ? "" : "s"
                    }.`}
                    onClick={() => setActiveTab("operations")}
                    button="Review"
                  />
                )}

                {dashboardData.approvedScreenings.length > 0 && (
                  <ActionCard
                    title="Screening approved"
                    text={`${
                      dashboardData.approvedScreenings.length
                    } tenant${
                      dashboardData.approvedScreenings.length === 1
                        ? " has"
                        : "s have"
                    } approved screening consent.`}
                    onClick={() => setActiveTab("operations")}
                    button="Review"
                  />
                )}

                {dashboardData.pendingApplications > 0 && (
                  <ActionCard
                    title="Open applications"
                    text={`${dashboardData.pendingApplications} application${
                      dashboardData.pendingApplications === 1 ? " is" : "s are"
                    } open or under review.`}
                    onClick={() => setActiveTab("applications")}
                    button="View"
                  />
                )}

                {dashboardData.leasesEndingSoon.length > 0 && (
                  <ActionCard
                    title="Leases ending soon"
                    text={`${dashboardData.leasesEndingSoon.length} lease${
                      dashboardData.leasesEndingSoon.length === 1
                        ? " is"
                        : "s are"
                    } ending within 90 days.`}
                    onClick={() => setActiveTab("renewals")}
                    button="Review"
                  />
                )}

                {leaseRenewalRequests.length > 0 && (
                  <ActionCard
                    title="Renewal activity"
                    text={`${leaseRenewalRequests.length} renewal or move-out update${
                      leaseRenewalRequests.length === 1 ? "" : "s"
                    } across Keylo.`}
                    onClick={() => setActiveTab("renewals")}
                    button="Review"
                  />
                )}

                {dashboardData.unpaidBalance > 0 && (
                  <ActionCard
                    title="Unpaid charges"
                    text={`${formatMoneyFromCents(
                      dashboardData.unpaidBalance
                    )} is unpaid across rent/deposit charges.`}
                    onClick={() => setActiveTab("operations")}
                    button="Review"
                  />
                )}

                {allCaughtUp && (
                  <div className="rounded-3xl bg-[#f7f4ef] p-6 md:col-span-2 xl:col-span-4">
                    <h3 className="text-2xl font-black">All caught up</h3>
                    <p className="mt-2 text-slate-600">
                      No major admin items need review right now.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <PreviewSection
              title="Quick Preview"
              text="A few recent items from the main admin areas."
            >
              <PreviewGrid>
                <MiniPreview
                  title="Renewals"
                  count={leaseRenewalRequests.length}
                  text="Move-outs, renewal offers, and renewal leases."
                  onClick={() => setActiveTab("renewals")}
                />
                <MiniPreview
                  title="Listings"
                  count={properties.length}
                  text="Pending, published, paused, rejected, and archived."
                  onClick={() => setActiveTab("listings")}
                />
                <MiniPreview
                  title="Applications"
                  count={applications.length}
                  text="Recent tenant applications and screening status."
                  onClick={() => setActiveTab("applications")}
                />
                <MiniPreview
                  title="Operations"
                  count={
                    rentCharges.length +
                    maintenanceRequests.length +
                    screeningRequests.length
                  }
                  text="Payments, maintenance, and screening."
                  onClick={() => setActiveTab("operations")}
                />
              </PreviewGrid>
            </PreviewSection>
          </>
        )}

        {activeTab === "renewals" && (
          <>
            <section
              id="renewals"
              className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200"
            >
              <div className="border-b border-slate-200 p-6">
  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 className="text-2xl font-black">Renewals & Move-Outs</h2>
      <p className="mt-1 text-sm font-bold text-slate-500">
        Track tenant renewal requests, move-out plans, landlord offers, and
        completed renewal leases. Use the full renewals page for search,
        filters, and pagination.
      </p>
    </div>

    <div className="flex flex-wrap gap-3">
      <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
        {leaseRenewalRequests.length} updates
      </span>

      <Link
        href="/admin/renewals"
        className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
      >
        View All Renewals
      </Link>
    </div>
  </div>
</div>

              <div className="grid gap-5 border-b border-slate-200 p-6 md:grid-cols-2 xl:grid-cols-5">
                <StatCard
                  title="Want to Renew"
                  value={dashboardData.tenantsWantToRenew.length}
                />
                <StatCard
                  title="Moving Out"
                  value={dashboardData.tenantsMovingOut.length}
                />
                <StatCard
                  title="Offers Sent"
                  value={dashboardData.renewalOffersSent.length}
                />
                <StatCard
                  title="Renewal Leases"
                  value={dashboardData.renewalLeasesSent.length}
                />
                <StatCard
                  title="Completed"
                  value={dashboardData.renewalCompleted.length}
                />
              </div>

              {leaseRenewalRequests.length > 0 ? (
                <div className="divide-y divide-slate-200">
                  {leaseRenewalRequests.slice(0, 25).map((request) => (
                    <RenewalRow key={request.id} request={request} />
                  ))}
                </div>
              ) : (
                <EmptySection
                  title="No renewal activity yet"
                  text="Tenant renewal requests, move-out plans, and landlord renewal offers will appear here."
                />
              )}
            </section>

            <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
              <SectionHeader
                title="Leases Ending Soon"
                text="Leases ending within the next 90 days."
                badge={`${dashboardData.leasesEndingSoon.length} ending soon`}
              />

              {dashboardData.leasesEndingSoon.length > 0 ? (
                <div className="divide-y divide-slate-200">
                  {dashboardData.leasesEndingSoon
                    .slice(0, 25)
                    .map((lease) => (
                      <LeaseEndingSoonRow key={lease.id} lease={lease} />
                    ))}
                </div>
              ) : (
                <EmptySection
                  title="No leases ending soon"
                  text="Leases ending within 90 days will appear here."
                />
              )}
            </section>
          </>
        )}

        {activeTab === "listings" && (
          <>
            <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
              <SectionHeader
                title="Pending Listing Approvals"
                text="Review new landlord listings before they go live."
                badge={`${dashboardData.pendingListings.length} pending`}
              />

              {dashboardData.pendingListings.length > 0 ? (
                <div className="divide-y divide-slate-200">
                  {dashboardData.pendingListings.map((property) => (
                    <ListingRow
                      key={property.id}
                      property={property}
                      landlordName={getLandlordName(property.landlord_id)}
                      pending
                    />
                  ))}
                </div>
              ) : (
                <EmptySection
                  title="No pending listings"
                  text="New landlord listings waiting for approval will appear here."
                />
              )}
            </section>

            <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
              <div className="border-b border-slate-200 p-6">
  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 className="text-2xl font-black">Recent Listings</h2>
      <p className="mt-1 text-sm font-bold text-slate-500">
        Showing latest 25 listings. Use the full listings page for search,
        status filters, and pagination.
      </p>
    </div>

    <div className="flex flex-wrap gap-3">
      <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
        {properties.length} loaded
      </span>

      <Link
        href="/admin/listings"
        className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
      >
        View All Listings
      </Link>
    </div>
  </div>
</div>

              {properties.length > 0 ? (
                <div className="divide-y divide-slate-200">
                  {properties.slice(0, 25).map((property) => (
                    <ListingRow
                      key={property.id}
                      property={property}
                      landlordName={getLandlordName(property.landlord_id)}
                    />
                  ))}
                </div>
              ) : (
                <EmptySection title="No listings yet" text="No listings yet." />
              )}
            </section>
          </>
        )}

        {activeTab === "applications" && (
          <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-200 p-6">
  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 className="text-2xl font-black">Recent Applications</h2>
      <p className="mt-1 text-sm font-bold text-slate-500">
        Showing latest 25 applications. Use the full applications page for
        search, status filters, screening filters, and pagination.
      </p>
    </div>

    <div className="flex flex-wrap gap-3">
      <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
        {applications.length} loaded
      </span>

      <Link
        href="/admin/applications"
        className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
      >
        View All Applications
      </Link>
    </div>
  </div>
</div>

            {applications.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {applications.slice(0, 25).map((application) => (
                  <ApplicationRow
                    key={application.id}
                    application={application}
                  />
                ))}
              </div>
            ) : (
              <EmptySection
                title="No applications yet"
                text="Applications will appear here."
              />
            )}
          </section>
        )}

        {activeTab === "operations" && (
          <>
            <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
              <div className="border-b border-slate-200 p-6">
  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 className="text-2xl font-black">Recent Screening Requests</h2>
      <p className="mt-1 text-sm font-bold text-slate-500">
        Track tenant consent for future TransUnion/background integrations. Use
        the full screenings page for search, status filters, type filters, and
        pagination.
      </p>
    </div>

    <div className="flex flex-wrap gap-3">
      <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
        {dashboardData.pendingScreenings.length} pending
      </span>

      <Link
        href="/admin/screenings"
        className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
      >
        View All Screenings
      </Link>
    </div>
  </div>
</div>

              {screeningRequests.length > 0 ? (
                <div className="divide-y divide-slate-200">
                  {screeningRequests.slice(0, 25).map((screening) => {
                    const matchingApplication = applications.find(
                      (application) => application.id === screening.application_id
                    );

                    const property = matchingApplication
                      ? getApplicationProperty(matchingApplication)
                      : null;

                    return (
                      <ScreeningRow
                        key={screening.id}
                        screening={screening}
                        application={matchingApplication || null}
                        property={property}
                      />
                    );
                  })}
                </div>
              ) : (
                <EmptySection
                  title="No screening requests yet"
                  text="Tenant screening consent requests will appear here."
                />
              )}
            </section>

            <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
              <div className="border-b border-slate-200 p-6">
  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 className="text-2xl font-black">Recent Rent / Deposit Charges</h2>
      <p className="mt-1 text-sm font-bold text-slate-500">
        Review charges created for leases. Use the full payments page for
        search, status filters, charge type filters, and pagination.
      </p>
    </div>

    <div className="flex flex-wrap gap-3">
      <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
        {dashboardData.unpaidCharges.length} unpaid
      </span>

      <Link
        href="/admin/payments"
        className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
      >
        View All Payments
      </Link>
    </div>
  </div>
</div>

              {rentCharges.length > 0 ? (
                <div className="divide-y divide-slate-200">
                  {rentCharges.slice(0, 25).map((charge) => (
                    <RentChargeRow key={charge.id} charge={charge} />
                  ))}
                </div>
              ) : (
                <EmptySection
                  title="No charges yet"
                  text="Rent and deposit charges will appear here."
                />
              )}
            </section>

            <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
              <div className="border-b border-slate-200 p-6">
  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 className="text-2xl font-black">Recent Maintenance</h2>
      <p className="mt-1 text-sm font-bold text-slate-500">
        Monitor active tenant repair requests. Use the full maintenance page
        for search, status filters, priority filters, and pagination.
      </p>
    </div>

    <div className="flex flex-wrap gap-3">
      <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
        {dashboardData.activeMaintenance.length} active
      </span>

      <Link
        href="/admin/maintenance"
        className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
      >
        View All Maintenance
      </Link>
    </div>
  </div>
</div>

              {maintenanceRequests.length > 0 ? (
                <div className="divide-y divide-slate-200">
                  {maintenanceRequests.slice(0, 25).map((request) => (
                    <MaintenanceRow key={request.id} request={request} />
                  ))}
                </div>
              ) : (
                <EmptySection
                  title="No maintenance requests"
                  text="Maintenance requests will appear here."
                />
              )}
            </section>
          </>
        )}

        {activeTab === "leases" && (
          <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-200 p-6">
  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 className="text-2xl font-black">Recent Leases</h2>
      <p className="mt-1 text-sm font-bold text-slate-500">
        Showing latest 25 leases. Use the full leases page for search, lease
        status filters, renewal filters, and pagination.
      </p>
    </div>

    <div className="flex flex-wrap gap-3">
      <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
        {dashboardData.activeLeases.length} active
      </span>

      <Link
        href="/admin/leases"
        className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
      >
        View All Leases
      </Link>
    </div>
  </div>
</div>

            {leases.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {leases.slice(0, 25).map((lease) => (
                  <LeaseRow key={lease.id} lease={lease} />
                ))}
              </div>
            ) : (
              <EmptySection title="No leases yet" text="Leases will appear here." />
            )}
          </section>
        )}

        {activeTab === "users" && (
          <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-200 p-6">
  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 className="text-2xl font-black">Users</h2>
      <p className="mt-1 text-sm font-bold text-slate-500">
        Showing latest 50 users. Use the full users page for search, filters,
        and pagination.
      </p>
    </div>

    <div className="flex flex-wrap gap-3">
      <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
        {profiles.length} loaded
      </span>

      <Link
        href="/admin/users"
        className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
      >
        View All Users
      </Link>
    </div>
  </div>
</div>

            {profiles.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {profiles.slice(0, 50).map((profile) => (
                  <UserRow key={profile.id} profile={profile} />
                ))}
              </div>
            ) : (
              <EmptySection title="No users yet" text="No users yet." />
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  href,
}: {
  title: string;
  value: string | number;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <p className="mt-3 text-4xl font-black">{value}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      {content}
    </div>
  );
}

function ActionCard({
  title,
  text,
  href,
  onClick,
  button,
}: {
  title: string;
  text: string;
  href?: string;
  onClick?: () => void;
  button: string;
}) {
  return (
    <div className="rounded-3xl bg-[#f7f4ef] p-5">
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-600">
        {text}
      </p>

      {href ? (
        <Link
          href={href}
          className="mt-4 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
        >
          {button}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className="mt-4 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
        >
          {button}
        </button>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  text,
  badge,
}: {
  title: string;
  text: string;
  badge?: string;
}) {
  return (
    <div className="border-b border-slate-200 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black">{title}</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">{text}</p>
        </div>

        {badge && (
          <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

function PreviewSection({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-3xl font-black">{title}</h2>
      <p className="mt-2 text-slate-600">{text}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function PreviewGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

function MiniPreview({
  title,
  count,
  text,
  onClick,
}: {
  title: string;
  count: number;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-3xl bg-[#f7f4ef] p-6 text-left transition hover:bg-slate-100"
    >
      <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <p className="mt-3 text-4xl font-black">{count}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </button>
  );
}

function ListingRow({
  property,
  landlordName,
  pending = false,
}: {
  property: Property;
  landlordName: string;
  pending?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-black">{property.title}</h3>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${listingStatusClass(
              property.status
            )}`}
          >
            {pending ? "Pending Review" : property.status}
          </span>
        </div>

        <p className="mt-2 font-bold text-slate-500">
          {property.city}, {property.state} · $
          {property.monthly_rent.toLocaleString()}/mo
        </p>

        <p className="mt-2 text-sm font-bold text-slate-500">
          Landlord: {landlordName}
        </p>

        {property.status === "rejected" && property.rejection_note && (
          <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            Rejection reason: {property.rejection_note}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href={`/admin/listings/${property.id}/preview`}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-center text-sm font-black"
        >
          View
        </Link>

        <Link
          href={`/dashboard/landlord/properties/${property.id}/edit`}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-center text-sm font-black"
        >
          Edit
        </Link>

        <AdminListingStatusButton
          propertyId={property.id}
          status="published"
          label={pending ? "Approve / Publish" : "Publish"}
          variant="dark"
        />

        <AdminListingStatusButton
          propertyId={property.id}
          status="paused"
          label="Pause"
        />

        <AdminListingStatusButton
          propertyId={property.id}
          status="draft"
          label="Draft"
        />

        <AdminListingStatusButton
          propertyId={property.id}
          status="pending"
          label="Pending"
        />

        <AdminListingStatusButton
          propertyId={property.id}
          status="archived"
          label="Archive"
        />

        {pending && <RejectListingButton propertyId={property.id} />}
      </div>
    </div>
  );
}

function RenewalRow({ request }: { request: LeaseRenewalRequest }) {
  return (
    <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-black">
            {formatRenewalType(request.request_type)}
          </h3>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${renewalStatusClass(
              request.status,
              request.request_type
            )}`}
          >
            {formatRenewalStatus(request.status)}
          </span>
        </div>

        <p className="mt-2 text-sm font-bold text-slate-500">
          Current lease ends: {request.current_lease_end_date || "Not provided"}
        </p>

        {request.proposed_monthly_rent && (
          <p className="mt-2 text-sm font-bold text-slate-500">
            Proposed rent: {formatMoney(request.proposed_monthly_rent)}
            {request.proposed_lease_start_date && request.proposed_lease_end_date
              ? ` · ${request.proposed_lease_start_date} to ${request.proposed_lease_end_date}`
              : ""}
          </p>
        )}

        {request.tenant_message && (
          <div className="mt-3 rounded-2xl bg-blue-50 p-4 text-blue-900 ring-1 ring-blue-100">
            <p className="text-sm font-black">Tenant Message</p>
            <p className="mt-2 whitespace-pre-wrap leading-7">
              {request.tenant_message}
            </p>
          </div>
        )}

        {request.landlord_message && (
          <div className="mt-3 rounded-2xl bg-[#f7f4ef] p-4 text-slate-700">
            <p className="text-sm font-black">Landlord Message</p>
            <p className="mt-2 whitespace-pre-wrap leading-7">
              {request.landlord_message}
            </p>
          </div>
        )}

        <p className="mt-3 text-xs font-bold text-slate-500">
          Created {new Date(request.created_at).toLocaleString()}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/dashboard/landlord/leases/${request.lease_id}/renewal`}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black"
        >
          Renewal Plan
        </Link>

        {request.renewal_lease_id ? (
          <Link
            href={`/dashboard/landlord/leases/${request.renewal_lease_id}`}
            className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-black text-white"
          >
            Open Renewal Lease
          </Link>
        ) : (
          <Link
            href={`/dashboard/landlord/leases/${request.lease_id}`}
            className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-black text-white"
          >
            Open Lease
          </Link>
        )}
      </div>
    </div>
  );
}

function LeaseEndingSoonRow({ lease }: { lease: Lease }) {
  const daysUntilEnd = getDaysUntilLeaseEnds(lease.lease_end_date);

  return (
    <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-black">
            {lease.property_address || "Lease Agreement"}
          </h3>

          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
            {daysUntilEnd === 0
              ? "Ends today"
              : `${daysUntilEnd} day${daysUntilEnd === 1 ? "" : "s"} left`}
          </span>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
            {formatLeaseStatus(lease.lease_status)}
          </span>
        </div>

        <p className="mt-2 font-bold text-slate-500">
          Tenant: {lease.tenant_name || "Not provided"}
        </p>

        <p className="mt-2 text-sm font-bold text-slate-500">
          Landlord: {lease.landlord_name || "Not provided"}
          {lease.monthly_rent ? ` · $${lease.monthly_rent.toLocaleString()}/mo` : ""}
        </p>

        <p className="mt-2 text-sm font-bold text-slate-500">
          Lease dates: {lease.lease_start_date || "No start"} to{" "}
          {lease.lease_end_date || "No end"}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/dashboard/landlord/leases/${lease.id}/renewal`}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black"
        >
          Renewal Plan
        </Link>

        <Link
          href={`/dashboard/landlord/leases/${lease.id}`}
          className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-black text-white"
        >
          Open Lease
        </Link>
      </div>
    </div>
  );
}

function ApplicationRow({ application }: { application: Application }) {
  const property = getApplicationProperty(application);

  return (
    <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-black">
            {application.first_name} {application.last_name}
          </h3>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
            {application.status}
          </span>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${screeningStatusClass(
              application.screening_status
            )}`}
          >
            Screening: {formatScreeningStatus(application.screening_status)}
          </span>
        </div>

        <p className="mt-2 font-bold text-slate-500">{application.email}</p>

        <p className="mt-2 text-sm font-bold text-slate-500">
          Listing:{" "}
          {property
            ? `${property.title} · ${property.city}, ${property.state}`
            : "Unknown listing"}
        </p>
      </div>

      <p className="rounded-2xl bg-[#f7f4ef] px-5 py-4 text-sm font-bold text-slate-600">
        Submitted {new Date(application.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}

function ScreeningRow({
  screening,
  application,
  property,
}: {
  screening: ScreeningRequest;
  application: Application | null;
  property: { title: string; city: string; state: string } | null;
}) {
  return (
    <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-black">
            {application
              ? `${application.first_name} ${application.last_name}`
              : "Applicant"}
          </h3>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${screeningStatusClass(
              screening.status
            )}`}
          >
            {formatScreeningStatus(screening.status)}
          </span>
        </div>

        <p className="mt-2 font-bold text-slate-500">
          {application?.email || "No email"}
        </p>

        <p className="mt-2 text-sm font-bold text-slate-500">
          {property
            ? `${property.title} · ${property.city}, ${property.state}`
            : "Unknown listing"}
        </p>
      </div>

      <p className="rounded-2xl bg-[#f7f4ef] px-5 py-4 text-sm font-bold text-slate-600">
        Requested {new Date(screening.requested_at).toLocaleDateString()}
      </p>
    </div>
  );
}

function RentChargeRow({ charge }: { charge: RentCharge }) {
  return (
    <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-black">
            {formatMoneyFromCents(charge.amount_cents)}
          </h3>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${
              charge.status === "paid"
                ? "bg-green-50 text-green-700"
                : charge.status === "overdue"
                  ? "bg-red-50 text-red-700"
                  : "bg-yellow-50 text-yellow-700"
            }`}
          >
            {charge.status}
          </span>
        </div>

        <p className="mt-2 text-sm font-bold text-slate-500">
          Due {charge.due_date}
        </p>
      </div>

      <p className="rounded-2xl bg-[#f7f4ef] px-5 py-4 text-sm font-bold text-slate-600">
        Created {new Date(charge.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}

function MaintenanceRow({ request }: { request: MaintenanceRequest }) {
  return (
    <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-black">{request.title}</h3>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${maintenanceStatusClass(
              request.status,
              request.priority
            )}`}
          >
            {request.status}
          </span>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
            {request.priority}
          </span>
        </div>

        <p className="mt-2 text-sm font-bold text-slate-500">
          Submitted {new Date(request.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

function LeaseRow({ lease }: { lease: Lease }) {
  return (
    <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-black">
            Lease for {lease.tenant_name || "Tenant"}
          </h3>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
            {formatLeaseStatus(lease.lease_status)}
          </span>

          {lease.renewal_status && lease.renewal_status !== "not_started" && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
              {lease.renewal_status.replaceAll("_", " ")}
            </span>
          )}
        </div>

        <p className="mt-2 font-bold text-slate-500">
          {lease.property_address || "No property address"}
        </p>

        <p className="mt-2 text-sm font-bold text-slate-500">
          Landlord: {lease.landlord_name || "Not provided"}
          {lease.monthly_rent ? ` · $${lease.monthly_rent.toLocaleString()}/mo` : ""}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/dashboard/landlord/leases/${lease.id}/renewal`}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black"
        >
          Renewal
        </Link>

        <Link
          href={`/dashboard/landlord/leases/${lease.id}`}
          className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-black text-white"
        >
          Open Lease
        </Link>
      </div>
    </div>
  );
}

function UserRow({ profile }: { profile: Profile }) {
  return (
    <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 className="text-xl font-black">
          {profile.full_name || "Unnamed User"}
        </h3>

        <p className="mt-1 font-bold text-slate-500">{profile.email}</p>

        <p className="mt-2 text-xs font-bold text-slate-400">
          Joined {new Date(profile.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:items-end">
        <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
          Role
        </p>

        <UserRoleSelect userId={profile.id} currentRole={profile.role} />
      </div>
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