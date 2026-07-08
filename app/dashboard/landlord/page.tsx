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

function formatMoneyFromCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
  const [errorMessage, setErrorMessage] = useState("");

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

      const { data, error } = await supabase
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
          aapplications (
  id,
  status,
  screening_status
)
        `
        )
        .eq("landlord_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMessage(error.message);
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
        .eq("landlord_id", user.id)
        .order("created_at", { ascending: false });

      if (leasesError) {
        setErrorMessage(leasesError.message);
        setLoading(false);
        return;
      }

      const { data: chargeRows, error: chargesError } = await supabase
        .from("rent_charges")
        .select("id, amount_cents, status, due_date")
        .eq("landlord_id", user.id)
        .order("due_date", { ascending: true });

      if (chargesError) {
        setErrorMessage(chargesError.message);
        setLoading(false);
        return;
      }

      const { data: maintenanceRows, error: maintenanceError } = await supabase
        .from("maintenance_requests")
        .select("id, title, status, priority, created_at")
        .eq("landlord_id", user.id)
        .order("created_at", { ascending: false });

      if (maintenanceError) {
        setErrorMessage(maintenanceError.message);
        setLoading(false);
        return;
      }

      setListings((data || []) as unknown as PropertyWithApplications[]);
      setLeases((leaseRows || []) as LandlordLease[]);
      setRentCharges((chargeRows || []) as RentCharge[]);
      setMaintenanceRequests(
        (maintenanceRows || []) as MaintenanceRequest[]
      );
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

  const totalApplications = listings.reduce(
    (total, listing) => total + listing.applications.length,
    0
  );

  const screeningApprovedApplications = listings.flatMap((listing) =>
  listing.applications.filter(
    (application) => application.screening_status === "tenant_approved"
  )
);

const screeningRequestedApplications = listings.flatMap((listing) =>
  listing.applications.filter(
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
    (request) =>
      request.status === "open" || request.status === "in_progress"
  );

  const urgentMaintenance = maintenanceRequests.filter(
    (request) =>
      (request.priority === "urgent" || request.priority === "emergency") &&
      (request.status === "open" || request.status === "in_progress")
  );

  const recentLeases = leases.slice(0, 5);
  const recentMaintenance = maintenanceRequests.slice(0, 4);

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/" className="text-sm font-bold text-slate-600">
              ← Back to Home
            </Link>

            <h1 className="mt-4 text-5xl font-black tracking-tight">
              Landlord Dashboard
            </h1>

            <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
              Manage listings, applications, leases, rent payments, maintenance
              requests, and landlord verification.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/dashboard/landlord/properties/new"
              className="rounded-full bg-slate-950 px-6 py-3 text-center font-black text-white"
            >
              Post New Listing
            </Link>

            <Link
              href="/dashboard/landlord/payments"
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black text-slate-950"
            >
              Payments
            </Link>

            <Link
              href="/dashboard/landlord/maintenance"
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black text-slate-950"
            >
              Maintenance
            </Link>

            <Link
              href="/dashboard/landlord/lease-builder"
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black text-slate-950"
            >
              Lease Builder
            </Link>

            <Link
  href="/dashboard/notifications"
  className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black text-slate-950"
>
  Notifications
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
            title="Unpaid Balance"
            value={formatMoneyFromCents(unpaidBalance)}
            text={`${unpaidCharges.length} unpaid charge${
              unpaidCharges.length === 1 ? "" : "s"
            }`}
            href="/dashboard/landlord/payments"
            urgent={unpaidBalance > 0}
          />

          <DashboardCard
            title="Maintenance"
            value={String(activeMaintenance.length)}
            text={`${urgentMaintenance.length} urgent · ${maintenanceRequests.length} total`}
            href="/dashboard/landlord/maintenance"
            urgent={urgentMaintenance.length > 0}
          />

          <DashboardCard
            title="Applications"
            value={String(totalApplications)}
            text={`${publishedListings} published listing${
              publishedListings === 1 ? "" : "s"
            }`}
            href="#listings"
          />

          <DashboardCard
            title="Leases"
            value={String(leases.length)}
            text={`${leasesNeedingSignature.length} need signature · ${completedLeases.length} completed`}
            href="#leases"
            urgent={leasesNeedingSignature.length > 0}
          />
        </section>

        <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Needs Attention
              </p>

              <h2 className="mt-2 text-3xl font-black">Today’s landlord tasks</h2>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard/landlord/profile"
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black"
              >
                Profile
              </Link>

              <Link
                href="/dashboard/landlord/verification"
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black"
              >
                Verification
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {leasesNeedingSignature.length > 0 && (
              <ActionCard
                title="Sign lease"
                text={`${leasesNeedingSignature.length} lease${
                  leasesNeedingSignature.length === 1 ? "" : "s"
                } waiting for your final signature.`}
                href={`/dashboard/landlord/leases/${leasesNeedingSignature[0].id}`}
                button="Open Lease"
              />
            )}

            {unpaidBalance > 0 && (
              <ActionCard
                title="Review unpaid charges"
                text={`${formatMoneyFromCents(unpaidBalance)} is currently unpaid.`}
                href="/dashboard/landlord/payments"
                button="Open Payments"
              />
            )}

            {urgentMaintenance.length > 0 && (
              <ActionCard
                title="Urgent maintenance"
                text={`${urgentMaintenance.length} urgent or emergency request${
                  urgentMaintenance.length === 1 ? "" : "s"
                } need attention.`}
                href="/dashboard/landlord/maintenance"
                button="Open Requests"
              />
            )}

            {screeningApprovedApplications.length > 0 && (
  <ActionCard
    title="Screening approved"
    text={`${screeningApprovedApplications.length} tenant${
      screeningApprovedApplications.length === 1 ? " has" : "s have"
    } approved screening consent.`}
    href="#listings"
    button="Review Applicants"
  />
)}

            {pendingListings > 0 && (
              <ActionCard
                title="Listings pending"
                text={`${pendingListings} listing${
                  pendingListings === 1 ? " is" : "s are"
                } waiting for admin review.`}
                href="#listings"
                button="View Listings"
              />
            )}

            {rejectedListings > 0 && (
              <ActionCard
                title="Fix rejected listings"
                text={`${rejectedListings} listing${
                  rejectedListings === 1 ? " needs" : "s need"
                } changes before resubmitting.`}
                href="#listings"
                button="Review"
              />
            )}

            {leasesNeedingSignature.length === 0 &&
unpaidBalance === 0 &&
urgentMaintenance.length === 0 &&
pendingListings === 0 &&
rejectedListings === 0 &&
screeningApprovedApplications.length === 0 &&
screeningRequestedApplications.length === 0 && (
                <div className="rounded-3xl bg-[#f7f4ef] p-6 md:col-span-2 xl:col-span-4">
                  <h3 className="text-2xl font-black">All caught up</h3>
                  <p className="mt-2 text-slate-600">
                    No urgent maintenance, unpaid charges, lease signatures, or
                    listing issues need attention right now.
                  </p>
                </div>
              )}
          </div>
        </section>

        <section className="mt-8 grid gap-8 xl:grid-cols-[1fr_420px]">
          <div
            id="needs-signature"
            className="rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200"
          >
            <div className="border-b border-slate-200 p-6">
              <h2 className="text-2xl font-black">
                Leases Needing Your Signature
              </h2>
            </div>

            {leasesNeedingSignature.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {leasesNeedingSignature.map((lease) => (
                  <div
                    key={lease.id}
                    className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-black">
                          Lease for {lease.tenant_name || "Tenant"}
                        </h3>

                        <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-black text-yellow-700">
                          Needs Your Signature
                        </span>
                      </div>

                      <p className="mt-2 font-bold text-slate-500">
                        {lease.property_address ||
                          "No property address provided"}
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
                ))}
              </div>
            ) : (
              <EmptySection
                title="No signatures needed"
                text="When a tenant signs a lease, it will appear here for your final signature."
              />
            )}
          </div>

          <div className="grid gap-8">
            <MiniPanel
              title="Payments"
              value={formatMoneyFromCents(unpaidBalance)}
              text={`${formatMoneyFromCents(paidTotal)} collected so far.`}
              href="/dashboard/landlord/payments"
              button="Open Payments"
            />

            <MiniPanel
              title="Maintenance"
              value={`${activeMaintenance.length} active`}
              text={`${urgentMaintenance.length} urgent request${
                urgentMaintenance.length === 1 ? "" : "s"
              }.`}
              href="/dashboard/landlord/maintenance"
              button="Open Maintenance"
            />
          </div>
        </section>

        <section
          id="leases"
          className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200"
        >
          <div className="flex items-center justify-between border-b border-slate-200 p-6">
            <h2 className="text-2xl font-black">Recent Leases</h2>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
              {sentLeases.length} sent
            </span>
          </div>

          {recentLeases.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {recentLeases.map((lease) => (
                <div
                  key={lease.id}
                  className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-black">
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

                  <Link
                    href={`/dashboard/landlord/leases/${lease.id}`}
                    className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
                  >
                    View Lease
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <EmptySection
              title="No leases yet"
              text="Leases will appear here after you create them from approved applications."
            />
          )}
        </section>

        <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 p-6">
            <h2 className="text-2xl font-black">Recent Maintenance</h2>

            <Link
              href="/dashboard/landlord/maintenance"
              className="text-sm font-black underline"
            >
              View All
            </Link>
          </div>

          {recentMaintenance.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {recentMaintenance.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-black">{request.title}</h3>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          request.priority === "urgent" ||
                          request.priority === "emergency"
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
                      Submitted{" "}
                      {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <Link
                    href="/dashboard/landlord/maintenance"
                    className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
                  >
                    Open
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <EmptySection
              title="No maintenance requests"
              text="Tenant repair requests will appear here."
            />
          )}
        </section>

        <div
          id="listings"
          className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200"
        >
          <div className="flex items-center justify-between border-b border-slate-200 p-6">
            <h2 className="text-2xl font-black">Your Listings</h2>

            <Link
              href="/dashboard/landlord/properties/new"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
            >
              Post New
            </Link>
          </div>

          {listings.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-black">{listing.title}</h3>

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
                      {listing.applications.length} application
                      {listing.applications.length === 1 ? "" : "s"}
                    </p>

                    {listing.status === "pending" && (
                      <div className="mt-3 rounded-2xl bg-yellow-50 px-4 py-3 text-sm font-bold text-yellow-700">
                        This listing is waiting for admin approval before it
                        appears publicly.
                      </div>
                    )}

                    {listing.status === "rejected" &&
                      listing.rejection_note && (
                        <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                          Rejection reason: {listing.rejection_note}
                        </div>
                      )}

                    {listing.status === "rejected" &&
                      !listing.rejection_note && (
                        <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                          This listing was rejected. Please edit and resubmit.
                        </div>
                      )}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
                        Public View
                      </Link>
                    )}

                    <Link
                      href={`/dashboard/landlord/properties/${listing.id}/edit`}
                      className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
                    >
                      Edit
                    </Link>

                    {listing.status === "rejected" && (
                      <ResubmitListingButton propertyId={listing.id} />
                    )}

                    <ArchiveListingButton propertyId={listing.id} />

                    <Link
                      href={`/dashboard/landlord/properties/${listing.id}/applications`}
                      className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
                    >
                      Applicants
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptySection
              title="No listings yet"
              text="Post your first rental listing to start receiving applications."
              href="/dashboard/landlord/properties/new"
              button="Post First Listing"
            />
          )}
        </div>
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