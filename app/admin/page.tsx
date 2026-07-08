"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminListingStatusButton from "./AdminListingStatusButton";
import UserRoleSelect from "./UserRoleSelect";
import RejectListingButton from "./RejectListingButton";

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

function formatMoneyFromCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

  return status;
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

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");

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
      .order("created_at", { ascending: false });

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
      .order("created_at", { ascending: false });

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
      .order("created_at", { ascending: false });

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
    tenant_name,
    landlord_name,
    property_address,
    monthly_rent,
    lease_start_date,
    lease_end_date,
    created_at
  `
  )
  .order("created_at", { ascending: false });

    if (leasesError) {
      setMessage(`Leases error: ${leasesError.message}`);
      setLoading(false);
      return;
    }

    const { data: chargeRows, error: chargesError } = await supabase
      .from("rent_charges")
      .select("id, amount_cents, status, due_date, created_at")
      .order("due_date", { ascending: true });

    if (chargesError) {
      setMessage(`Rent charges error: ${chargesError.message}`);
      setLoading(false);
      return;
    }

    const { data: maintenanceRows, error: maintenanceError } = await supabase
      .from("maintenance_requests")
      .select("id, title, status, priority, created_at")
      .order("created_at", { ascending: false });

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
      .order("requested_at", { ascending: false });

    if (screeningError) {
      setMessage(`Screening error: ${screeningError.message}`);
      setLoading(false);
      return;
    }

    const { data: verificationRows, error: verificationError } = await supabase
  .from("landlord_verifications")
  .select("id, landlord_id, created_at")
  .order("created_at", { ascending: false });

    if (verificationError) {
      setMessage(`Landlord verification error: ${verificationError.message}`);
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

    setLoading(false);
  }
function getDaysUntilLeaseEnds(leaseEndDate: string | null) {
  if (!leaseEndDate) return null;

  const today = new Date();
  const endDate = new Date(`${leaseEndDate}T00:00:00`);

  return Math.ceil(
    (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}
  function getLandlordName(landlordId: string | null) {
    if (!landlordId) return "Unknown";

    const landlord = profiles.find((profile) => profile.id === landlordId);

    return landlord?.full_name || landlord?.email || "Unknown";
  }

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

  const pendingVerifications = landlordVerifications;

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
              maintenance, screenings, and landlord verification across Keylo.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admin/landlord-verifications"
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              Landlord Verifications
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
          <StatCard title="Users" value={profiles.length} />
          <StatCard title="Listings" value={properties.length} />
          <StatCard title="Applications" value={applications.length} />
          <StatCard title="Leases" value={leases.length} />
          <StatCard title="Maintenance" value={maintenanceRequests.length} />
          <StatCard title="Screenings" value={screeningRequests.length} />
          <StatCard title="Rent Charges" value={rentCharges.length} />
          <StatCard title="Published" value={publishedListings} />
          <StatCard title="Pending Listings" value={pendingListings.length} />
          <StatCard title="Unpaid" value={formatMoneyFromCents(unpaidBalance)} />
        </section>

        <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Admin Attention
          </p>

          <h2 className="mt-2 text-3xl font-black">What needs review</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {pendingListings.length > 0 && (
              <ActionCard
                title="Pending listings"
                text={`${pendingListings.length} listing${
                  pendingListings.length === 1 ? " needs" : "s need"
                } approval.`}
                href="#pending-listings"
                button="Review Listings"
              />
            )}

            {rejectedListings.length > 0 && (
              <ActionCard
                title="Rejected listings"
                text={`${rejectedListings.length} listing${
                  rejectedListings.length === 1 ? " is" : "s are"
                } rejected.`}
                href="#recent-listings"
                button="Review"
              />
            )}

            {pendingVerifications.length > 0 && (
              <ActionCard
                title="Landlord verification"
                text={`${pendingVerifications.length} verification request${
                  pendingVerifications.length === 1 ? "" : "s"
                } need review.`}
                href="/admin/landlord-verifications"
                button="Open"
              />
            )}

            {urgentMaintenance.length > 0 && (
              <ActionCard
                title="Urgent maintenance"
                text={`${urgentMaintenance.length} urgent or emergency maintenance request${
                  urgentMaintenance.length === 1 ? "" : "s"
                }.`}
                href="#maintenance"
                button="Review"
              />
            )}

            {approvedScreenings.length > 0 && (
              <ActionCard
                title="Screening approved"
                text={`${approvedScreenings.length} tenant${
                  approvedScreenings.length === 1 ? " has" : "s have"
                } approved screening consent.`}
                href="#screenings"
                button="Review"
              />
            )}

            {pendingApplications > 0 && (
              <ActionCard
                title="Open applications"
                text={`${pendingApplications} application${
                  pendingApplications === 1 ? " is" : "s are"
                } open or under review.`}
                href="#applications"
                button="View"
              />
            )}

            {leasesEndingSoon.length > 0 && (
  <ActionCard
    title="Leases ending soon"
    text={`${leasesEndingSoon.length} lease${
      leasesEndingSoon.length === 1 ? " is" : "s are"
    } ending within 90 days.`}
    href="#leases-ending-soon"
    button="Review Leases"
  />
)}

            {unpaidBalance > 0 && (
              <ActionCard
                title="Unpaid charges"
                text={`${formatMoneyFromCents(unpaidBalance)} is unpaid across rent/deposit charges.`}
                href="#payments"
                button="Review"
              />
            )}

            {pendingListings.length === 0 &&
              rejectedListings.length === 0 &&
              pendingVerifications.length === 0 &&
              urgentMaintenance.length === 0 &&
              approvedScreenings.length === 0 &&
              pendingApplications === 0 &&
              leasesEndingSoon.length === 0 &&
              unpaidBalance === 0 && (
                <div className="rounded-3xl bg-[#f7f4ef] p-6 md:col-span-2 xl:col-span-4">
                  <h3 className="text-2xl font-black">All caught up</h3>
                  <p className="mt-2 text-slate-600">
                    No major admin items need review right now.
                  </p>
                </div>
              )}
          </div>
        </section>

        <section
  id="leases-ending-soon"
  className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200"
>
  <SectionHeader
    title="Leases Ending Soon"
    text="Leases ending within the next 90 days."
    badge={`${leasesEndingSoon.length} ending soon`}
  />

  {leasesEndingSoon.length > 0 ? (
    <div className="divide-y divide-slate-200">
      {leasesEndingSoon.slice(0, 10).map((lease) => {
        const daysUntilEnd = getDaysUntilLeaseEnds(lease.lease_end_date);

        return (
          <div
            key={lease.id}
            className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
          >
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
                  {lease.lease_status}
                </span>
              </div>

              <p className="mt-2 font-bold text-slate-500">
                Tenant: {lease.tenant_name || "Not provided"}
              </p>

              <p className="mt-2 text-sm font-bold text-slate-500">
                Landlord: {lease.landlord_name || "Not provided"}
                {lease.monthly_rent
                  ? ` · $${lease.monthly_rent.toLocaleString()}/mo`
                  : ""}
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
      })}
    </div>
  ) : (
    <EmptySection
      title="No leases ending soon"
      text="Leases ending within 90 days will appear here."
    />
  )}
</section>

        <section
          id="pending-listings"
          className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200"
        >
          <SectionHeader
            title="Pending Listing Approvals"
            text="Review new landlord listings before they go live."
            badge={`${pendingListings.length} pending`}
          />

          {pendingListings.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {pendingListings.map((property) => (
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

        <section
          id="screenings"
          className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200"
        >
          <SectionHeader
            title="Recent Screening Requests"
            text="Track tenant consent for future TransUnion/background integrations."
            badge={`${pendingScreenings.length} pending`}
          />

          {screeningRequests.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {screeningRequests.slice(0, 10).map((screening) => {
                const matchingApplication = applications.find(
                  (application) => application.id === screening.application_id
                );

                const property = matchingApplication
                  ? getApplicationProperty(matchingApplication)
                  : null;

                return (
                  <div
                    key={screening.id}
                    className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-black">
                          {matchingApplication
                            ? `${matchingApplication.first_name} ${matchingApplication.last_name}`
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
                        {matchingApplication?.email || "No email"}
                      </p>

                      <p className="mt-2 text-sm font-bold text-slate-500">
                        {property
                          ? `${property.title} · ${property.city}, ${property.state}`
                          : "Unknown listing"}
                      </p>
                    </div>

                    <p className="rounded-2xl bg-[#f7f4ef] px-5 py-4 text-sm font-bold text-slate-600">
                      Requested{" "}
                      {new Date(screening.requested_at).toLocaleDateString()}
                    </p>
                  </div>
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

        <section
          id="payments"
          className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200"
        >
          <SectionHeader
            title="Recent Rent / Deposit Charges"
            text="Review charges created for leases."
            badge={`${unpaidCharges.length} unpaid`}
          />

          {rentCharges.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {rentCharges.slice(0, 10).map((charge) => (
                <div
                  key={charge.id}
                  className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                >
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
                    Created{" "}
                    {new Date(charge.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptySection
              title="No charges yet"
              text="Rent and deposit charges will appear here."
            />
          )}
        </section>

        <section
          id="maintenance"
          className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200"
        >
          <SectionHeader
            title="Recent Maintenance"
            text="Monitor active tenant repair requests."
            badge={`${activeMaintenance.length} active`}
          />

          {maintenanceRequests.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {maintenanceRequests.slice(0, 10).map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                >
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
                      Submitted{" "}
                      {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptySection
              title="No maintenance requests"
              text="Maintenance requests will appear here."
            />
          )}
        </section>

        <section
          id="recent-listings"
          className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200"
        >
          <SectionHeader
            title="Recent Listings"
            text="Manage listing status across the platform."
          />

          {properties.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {properties.slice(0, 10).map((property) => (
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

        <section
          id="applications"
          className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200"
        >
          <SectionHeader
            title="Recent Applications"
            text="View recent tenant applications across Keylo."
          />

          {applications.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {applications.slice(0, 10).map((application) => {
                const property = getApplicationProperty(application);

                return (
                  <div
                    key={application.id}
                    className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                  >
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
                          Screening:{" "}
                          {formatScreeningStatus(
                            application.screening_status
                          )}
                        </span>
                      </div>

                      <p className="mt-2 font-bold text-slate-500">
                        {application.email}
                      </p>

                      <p className="mt-2 text-sm font-bold text-slate-500">
                        Listing:{" "}
                        {property
                          ? `${property.title} · ${property.city}, ${property.state}`
                          : "Unknown listing"}
                      </p>
                    </div>

                    <p className="rounded-2xl bg-[#f7f4ef] px-5 py-4 text-sm font-bold text-slate-600">
                      Submitted{" "}
                      {new Date(application.created_at).toLocaleDateString()}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptySection
              title="No applications yet"
              text="Applications will appear here."
            />
          )}
        </section>

        <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <SectionHeader
            title="Recent Leases"
            text="Monitor lease status across Keylo."
            badge={`${activeLeases.length} active`}
          />

          {leases.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {leases.slice(0, 10).map((lease) => (
                <div
                  key={lease.id}
                  className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-black">
                        Lease for {lease.tenant_name || "Tenant"}
                      </h3>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                        {lease.lease_status}
                      </span>
                    </div>

                    <p className="mt-2 font-bold text-slate-500">
                      {lease.property_address || "No property address"}
                    </p>

                    <p className="mt-2 text-sm font-bold text-slate-500">
                      Landlord: {lease.landlord_name || "Not provided"}
                      {lease.monthly_rent
                        ? ` · $${lease.monthly_rent.toLocaleString()}/mo`
                        : ""}
                    </p>
                  </div>

                  <p className="rounded-2xl bg-[#f7f4ef] px-5 py-4 text-sm font-bold text-slate-600">
                    Created {new Date(lease.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptySection title="No leases yet" text="Leases will appear here." />
          )}
        </section>

        <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <SectionHeader title="Users" text="Manage user roles." />

          {profiles.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {profiles.slice(0, 20).map((profile) => (
                <div
                  key={profile.id}
                  className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <h3 className="text-xl font-black">
                      {profile.full_name || "Unnamed User"}
                    </h3>

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
            <EmptySection title="No users yet" text="No users yet." />
          )}
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

function EmptySection({ title, text }: { title: string; text: string }) {
  return (
    <div className="p-8 text-center">
      <h3 className="text-2xl font-black">{title}</h3>
      <p className="mt-3 text-slate-600">{text}</p>
    </div>
  );
}