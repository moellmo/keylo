"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import RemoveSavedListingButton from "./RemoveSavedListingButton";

type RentalProperty = {
  id: string;
  title: string;
  monthly_rent: number;
  city: string;
  state: string;
};

type SavedRentalProperty = {
  id: string;
  title: string;
  monthly_rent: number;
  city: string;
  state: string;
  bedrooms: string | null;
  bathrooms: string | null;
  status: string;
};

type TenantApplication = {
  id: string;
  status: string;
  screening_status: string | null;
  created_at: string;
  move_in_date: string | null;
  property_id: string;
  properties: RentalProperty | RentalProperty[] | null;
};

type SavedListing = {
  id: string;
  created_at: string;
  property_id: string;
  properties: SavedRentalProperty | SavedRentalProperty[] | null;
};

type TenantLease = {
  id: string;
  lease_status: string;
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
};

type MaintenanceRequest = {
  id: string;
  status: "open" | "in_progress" | "resolved" | "closed" | "cancelled";
  priority: "low" | "normal" | "urgent" | "emergency";
  created_at: string;
};

function getApplicationProperty(application: TenantApplication) {
  if (Array.isArray(application.properties)) {
    return application.properties[0] || null;
  }

  return application.properties;
}

function getSavedProperty(saved: SavedListing) {
  if (Array.isArray(saved.properties)) {
    return saved.properties[0] || null;
  }

  return saved.properties;
}

function formatLeaseStatus(status: string) {
  if (status === "draft") return "Draft";
  if (status === "sent_to_tenant") return "Ready to Sign";
  if (status === "tenant_signed") return "Tenant Signed";
  if (status === "landlord_signed") return "Landlord Signed";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";

  return status;
}

function formatMoneyFromCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getDaysUntilLeaseEnds(leaseEndDate: string | null) {
  if (!leaseEndDate) return null;

  const today = new Date();
  const endDate = new Date(`${leaseEndDate}T00:00:00`);

  return Math.ceil(
    (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export default function TenantDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [applications, setApplications] = useState<TenantApplication[]>([]);
  const [savedListings, setSavedListings] = useState<SavedListing[]>([]);
  const [leases, setLeases] = useState<TenantLease[]>([]);
  const [rentCharges, setRentCharges] = useState<RentCharge[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<
    MaintenanceRequest[]
  >([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadTenantDashboard() {
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

      if (profile?.role !== "tenant" && profile?.role !== "admin") {
        setLoggedIn(false);
        setErrorMessage(
          "You must be logged in as a tenant to view this dashboard."
        );
        setLoading(false);
        return;
      }

      setLoggedIn(true);

      const { data: applicationRows, error: applicationsError } =
        await supabase
          .from("applications")
          .select(
            `
            id,
            status,
            screening_status,
            created_at,
            move_in_date,
            property_id,
            properties (
              id,
              title,
              monthly_rent,
              city,
              state
            )
          `
          )
          .eq("tenant_id", user.id)
          .order("created_at", { ascending: false });

      if (applicationsError) {
        setErrorMessage(applicationsError.message);
        setLoading(false);
        return;
      }

      const { data: savedRows, error: savedError } = await supabase
        .from("saved_listings")
        .select(
          `
          id,
          created_at,
          property_id,
          properties (
            id,
            title,
            monthly_rent,
            city,
            state,
            bedrooms,
            bathrooms,
            status
          )
        `
        )
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false });

      if (savedError) {
        setErrorMessage(savedError.message);
        setLoading(false);
        return;
      }

      const { data: leaseRows, error: leasesError } = await supabase
        .from("leases")
        .select(
          `
          id,
          lease_status,
          tenant_name,
          landlord_name,
          property_address,
          monthly_rent,
          lease_start_date,
          lease_end_date,
          created_at
        `
        )
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false });

      if (leasesError) {
        setErrorMessage(leasesError.message);
        setLoading(false);
        return;
      }

      const { data: chargeRows, error: chargesError } = await supabase
        .from("rent_charges")
        .select("id, amount_cents, status, due_date")
        .eq("tenant_id", user.id)
        .order("due_date", { ascending: true });

      if (chargesError) {
        setErrorMessage(chargesError.message);
        setLoading(false);
        return;
      }

      const { data: maintenanceRows, error: maintenanceError } = await supabase
        .from("maintenance_requests")
        .select("id, status, priority, created_at")
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false });

      if (maintenanceError) {
        setErrorMessage(maintenanceError.message);
        setLoading(false);
        return;
      }

      setApplications((applicationRows || []) as unknown as TenantApplication[]);
      setSavedListings((savedRows || []) as unknown as SavedListing[]);
      setLeases((leaseRows || []) as TenantLease[]);
      setRentCharges((chargeRows || []) as RentCharge[]);
      setMaintenanceRequests((maintenanceRows || []) as MaintenanceRequest[]);
      setLoading(false);
    }

    loadTenantDashboard();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading dashboard...</h1>
        </div>
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <h1 className="text-3xl font-black">Please log in</h1>

            <p className="mt-3 text-slate-600">
              {errorMessage ||
                "You need to log in as a tenant to view your dashboard."}
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

  const approvedApplications = applications.filter(
    (application) => application.status === "approved"
  );

  const reviewingApplications = applications.filter(
    (application) => application.status === "reviewing"
  );

  const screeningRequests = applications.filter(
    (application) =>
      application.screening_status === "requested" ||
      application.screening_status === "in_progress"
  );

  const leasesReadyToSign = leases.filter(
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

  const unpaidCharges = rentCharges.filter(
    (charge) => charge.status === "unpaid" || charge.status === "overdue"
  );

  const unpaidBalance = unpaidCharges.reduce(
    (sum, charge) => sum + charge.amount_cents,
    0
  );

  const openMaintenance = maintenanceRequests.filter(
    (request) =>
      request.status === "open" || request.status === "in_progress"
  );

  const urgentMaintenance = maintenanceRequests.filter(
    (request) =>
      (request.priority === "urgent" || request.priority === "emergency") &&
      (request.status === "open" || request.status === "in_progress")
  );

  const latestLease = leases[0];
  const leaseEndingSoon = leasesEndingSoon[0];

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/" className="text-sm font-bold text-slate-600">
              ← Back to Home
            </Link>

            <h1 className="mt-4 text-5xl font-black tracking-tight">
              Tenant Dashboard
            </h1>

            <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
              Track your applications, leases, payments, maintenance requests,
              saved listings, and rental documents.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/tenant/payments"
              className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-black text-white"
            >
              Payments
            </Link>

            <Link
              href="/dashboard/notifications"
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              Notifications
            </Link>

            <Link
              href="/dashboard/tenant/maintenance"
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black text-slate-950"
            >
              Maintenance
            </Link>

            <Link
              href="/dashboard/tenant/documents"
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              Documents
            </Link>

            <Link
              href="/dashboard/tenant/profile"
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              Profile
            </Link>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-2xl bg-white px-5 py-4 font-bold text-red-700 shadow-sm ring-1 ring-red-200">
            {errorMessage}
          </div>
        )}

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            title="Amount Due"
            value={formatMoneyFromCents(unpaidBalance)}
            text={`${unpaidCharges.length} unpaid charge${
              unpaidCharges.length === 1 ? "" : "s"
            }`}
            href="/dashboard/tenant/payments"
            urgent={unpaidBalance > 0}
          />

          <DashboardCard
            title="Leases"
            value={String(leases.length)}
            text={`${leasesReadyToSign.length} ready to sign · ${completedLeases.length} completed`}
            href={latestLease ? `/dashboard/tenant/leases/${latestLease.id}` : undefined}
            urgent={leasesReadyToSign.length > 0 || leasesEndingSoon.length > 0}
          />

          <DashboardCard
            title="Maintenance"
            value={String(openMaintenance.length)}
            text={`${urgentMaintenance.length} urgent · ${maintenanceRequests.length} total`}
            href="/dashboard/tenant/maintenance"
            urgent={urgentMaintenance.length > 0}
          />

          <DashboardCard
            title="Applications"
            value={String(applications.length)}
            text={`${approvedApplications.length} approved · ${reviewingApplications.length} reviewing`}
            href="#applications"
          />
        </section>

        <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Next Actions
              </p>

              <h2 className="mt-2 text-3xl font-black">What needs attention</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {leaseEndingSoon && (
              <ActionCard
                title="Lease ending soon"
                text={`Your lease for ${
                  leaseEndingSoon.property_address || "your rental"
                } ends on ${leaseEndingSoon.lease_end_date}. Choose whether you want to renew or move out.`}
                href={`/dashboard/tenant/leases/${leaseEndingSoon.id}/renewal`}
                button="Renew or Move Out"
              />
            )}

            {unpaidBalance > 0 && (
              <ActionCard
                title="Pay rent or deposit"
                text={`${formatMoneyFromCents(unpaidBalance)} currently due.`}
                href="/dashboard/tenant/payments"
                button="View Payments"
              />
            )}

            {screeningRequests.length > 0 && (
              <ActionCard
                title="Approve screening"
                text={`${screeningRequests.length} application${
                  screeningRequests.length === 1 ? " needs" : "s need"
                } screening consent.`}
                href={`/dashboard/tenant/applications/${screeningRequests[0].id}`}
                button="Review Request"
              />
            )}

            {leasesReadyToSign.length > 0 && (
              <ActionCard
                title="Sign your lease"
                text={`${leasesReadyToSign.length} lease${
                  leasesReadyToSign.length === 1 ? " is" : "s are"
                } ready for signature.`}
                href={`/dashboard/tenant/leases/${leasesReadyToSign[0].id}`}
                button="Review Lease"
              />
            )}

            <ActionCard
              title="Submit maintenance"
              text="Report a repair issue and track landlord updates."
              href="/dashboard/tenant/maintenance/new"
              button="New Request"
            />

            <ActionCard
              title="Keep profile ready"
              text="Update your renter profile and upload supporting documents."
              href="/dashboard/tenant/profile"
              button="Edit Profile"
            />
          </div>
        </section>

        <section className="mt-8 grid gap-8 xl:grid-cols-[1fr_420px]">
          <div className="rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <h2 className="text-2xl font-black">Your Leases</h2>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                {leases.length}
              </span>
            </div>

            {leases.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {leases.slice(0, 4).map((lease) => (
                  <div
                    key={lease.id}
                    className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-black">
                          {lease.property_address || "Lease Agreement"}
                        </h3>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            lease.lease_status === "sent_to_tenant"
                              ? "bg-yellow-50 text-yellow-700"
                              : lease.lease_status === "completed"
                                ? "bg-green-50 text-green-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {formatLeaseStatus(lease.lease_status)}
                        </span>
                      </div>

                      <p className="mt-2 font-bold text-slate-500">
                        {lease.monthly_rent
                          ? `$${lease.monthly_rent.toLocaleString()}/mo`
                          : "Rent not provided"}
                        {lease.lease_start_date && lease.lease_end_date
                          ? ` · ${lease.lease_start_date} to ${lease.lease_end_date}`
                          : ""}
                      </p>

                      <p className="mt-2 text-sm font-bold text-slate-500">
                        Landlord: {lease.landlord_name || "Not provided"}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        href={`/dashboard/tenant/leases/${lease.id}/renewal`}
                        className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
                      >
                        Renewal Plan
                      </Link>

                      <Link
                        href={`/dashboard/tenant/leases/${lease.id}`}
                        className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
                      >
                        View Lease
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptySection
                title="No leases yet"
                text="When a landlord sends you a lease, it will appear here."
              />
            )}
          </div>

          <div className="grid gap-8">
            <MiniPanel
              title="Payments"
              value={formatMoneyFromCents(unpaidBalance)}
              text={`${unpaidCharges.length} unpaid charge${
                unpaidCharges.length === 1 ? "" : "s"
              }`}
              href="/dashboard/tenant/payments"
              button="Open Payments"
            />

            <MiniPanel
              title="Maintenance"
              value={`${openMaintenance.length} open`}
              text={`${urgentMaintenance.length} urgent request${
                urgentMaintenance.length === 1 ? "" : "s"
              }`}
              href="/dashboard/tenant/maintenance"
              button="Open Maintenance"
            />
          </div>
        </section>

        <section
          id="applications"
          className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200"
        >
          <div className="flex items-center justify-between border-b border-slate-200 p-6">
            <h2 className="text-2xl font-black">Your Applications</h2>

            <Link href="/listings" className="text-sm font-black underline">
              Browse Rentals
            </Link>
          </div>

          {applications.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {applications.slice(0, 5).map((application) => {
                const property = getApplicationProperty(application);

                return (
                  <div
                    key={application.id}
                    className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-black">
                          {property?.title || "Rental Listing"}
                        </h3>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                          {application.status}
                        </span>
                      </div>

                      <p className="mt-2 font-bold text-slate-500">
                        {property
                          ? `${property.city}, ${
                              property.state
                            } · $${property.monthly_rent.toLocaleString()}/mo`
                          : "Listing details unavailable"}
                      </p>

                      <p className="mt-2 text-sm font-bold text-slate-500">
                        Submitted{" "}
                        {new Date(application.created_at).toLocaleDateString()}
                        {application.move_in_date
                          ? ` · Move-in: ${application.move_in_date}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        href={`/dashboard/tenant/applications/${application.id}`}
                        className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
                      >
                        View Application
                      </Link>

                      <Link
                        href={`/listings/${application.property_id}`}
                        className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
                      >
                        View Listing
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptySection
              title="No applications yet"
              text="Apply to a rental listing to track your application here."
              href="/listings"
              button="Browse Rentals"
            />
          )}
        </section>

        <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 p-6">
            <h2 className="text-2xl font-black">Saved Listings</h2>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
              {savedListings.length}
            </span>
          </div>

          {savedListings.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {savedListings.slice(0, 4).map((saved) => {
                const property = getSavedProperty(saved);

                return (
                  <div
                    key={saved.id}
                    className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-black">
                          {property?.title || "Rental Listing"}
                        </h3>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                          {property?.status || "unknown"}
                        </span>
                      </div>

                      <p className="mt-2 font-bold text-slate-500">
                        {property
                          ? `${property.city}, ${
                              property.state
                            } · $${property.monthly_rent.toLocaleString()}/mo`
                          : "Listing details unavailable"}
                      </p>

                      <p className="mt-2 text-sm font-bold text-slate-500">
                        Saved {new Date(saved.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        href={`/listings/${saved.property_id}`}
                        className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
                      >
                        View
                      </Link>

                      <Link
                        href={`/apply/${saved.property_id}`}
                        className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
                      >
                        Apply
                      </Link>

                      <RemoveSavedListingButton savedListingId={saved.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptySection
              title="No saved listings yet"
              text="Save rentals you like so you can come back to them later."
              href="/listings"
              button="Browse Rentals"
            />
          )}
        </section>
      </div>
    </main>
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
      className={`h-full rounded-3xl p-6 shadow-sm ring-1 transition ${
        urgent
          ? "bg-yellow-50 ring-yellow-200"
          : "bg-white ring-slate-200"
      } ${href ? "hover:-translate-y-0.5 hover:shadow-md" : ""}`}
    >
      <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <p className="mt-3 text-4xl font-black">{value}</p>
      <p className="mt-2 text-sm font-bold text-slate-500">{text}</p>
    </div>
  );

  if (!href) return card;

  return <Link href={href}>{card}</Link>;
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
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-600">
        {text}
      </p>

      <Link
        href={href}
        className="mt-4 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
      >
        {button}
      </Link>
    </div>
  );
}

function MiniPanel({
  title,
  value,
  text,
  href,
  button,
}: {
  title: string;
  value: string;
  text: string;
  href: string;
  button: string;
}) {
  return (
    <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <p className="mt-3 text-4xl font-black">{value}</p>
      <p className="mt-2 font-bold text-slate-500">{text}</p>

      <Link
        href={href}
        className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
      >
        {button}
      </Link>
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