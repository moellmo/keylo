"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import LogoutButton from "@/components/LogoutButton";
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
};

type Application = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
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

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);

  useEffect(() => {
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

      const { data: currentProfile, error: currentProfileError } =
        await supabase
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
          "id, landlord_id, title, monthly_rent, city, state, status, created_at"
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

      setProfiles((profileRows || []) as Profile[]);
      setProperties((propertyRows || []) as Property[]);
      setApplications((applicationRows || []) as Application[]);
      setLoading(false);
    }

    loadAdmin();
  }, []);

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

  const pendingApplications = applications.filter(
    (application) =>
      application.status === "submitted" || application.status === "reviewing"
  ).length;

  function getLandlordName(landlordId: string | null) {
    if (!landlordId) return "Unknown";

    const landlord = profiles.find((profile) => profile.id === landlordId);

    return landlord?.full_name || landlord?.email || "Unknown";
  }
function getApplicationProperty(application: Application) {
  if (Array.isArray(application.properties)) {
    return application.properties[0] || null;
  }

  return application.properties;
}
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

            <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-600">
              Review users, listings, and tenant applications across Keylo.
            </p>
          </div>

          <LogoutButton />
        </div>

        {message && (
          <div className="mt-6 rounded-2xl bg-white px-5 py-4 font-bold text-red-700 shadow-sm ring-1 ring-red-200">
            {message}
          </div>
        )}

        <div className="mt-8 grid gap-5 md:grid-cols-5">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Users
            </p>
            <p className="mt-3 text-4xl font-black">{profiles.length}</p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Listings
            </p>
            <p className="mt-3 text-4xl font-black">{properties.length}</p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Published
            </p>
            <p className="mt-3 text-4xl font-black">{publishedListings}</p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Pending
            </p>
            <p className="mt-3 text-4xl font-black">{pendingListings.length}</p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Open Apps
            </p>
            <p className="mt-3 text-4xl font-black">{pendingApplications}</p>
          </div>
        </div>

        <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black">
                  Pending Listing Approvals
                </h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Review new landlord listings before they go live.
                </p>
              </div>

              <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
                {pendingListings.length} pending
              </span>
            </div>
          </div>

          {pendingListings.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {pendingListings.map((property) => (
                <div
                  key={property.id}
                  className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-black">{property.title}</h3>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                        Pending Review
                      </span>
                    </div>

                    <p className="mt-2 font-bold text-slate-500">
                      {property.city}, {property.state} · $
                      {property.monthly_rent.toLocaleString()}/mo
                    </p>

                    <p className="mt-2 text-sm font-bold text-slate-500">
                      Landlord: {getLandlordName(property.landlord_id)}
                    </p>
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
                      label="Approve / Publish"
                      variant="dark"
                    />

                    <AdminListingStatusButton
                      propertyId={property.id}
                      status="draft"
                      label="Send to Draft"
                    />

                    <AdminListingStatusButton
                      propertyId={property.id}
                      status="archived"
                      label="Archive"
                    />

                    <RejectListingButton propertyId={property.id} />

                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No pending listings</h3>
              <p className="mt-3 text-slate-600">
                New landlord listings waiting for approval will appear here.
              </p>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-2xl font-black">Recent Listings</h2>
          </div>

          {properties.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {properties.slice(0, 10).map((property) => (
                <div
                  key={property.id}
                  className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-black">{property.title}</h3>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                        {property.status}
                      </span>
                    </div>

                    <p className="mt-2 font-bold text-slate-500">
                      {property.city}, {property.state} · $
                      {property.monthly_rent.toLocaleString()}/mo
                    </p>

                    <p className="mt-2 text-sm font-bold text-slate-500">
                      Landlord: {getLandlordName(property.landlord_id)}
                    </p>
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
                      label="Publish"
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
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No listings yet</h3>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-2xl font-black">Recent Applications</h2>
          </div>

          {applications.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {applications.slice(0, 10).map((application) => (
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
                    </div>

                    <p className="mt-2 font-bold text-slate-500">
                      {application.email}
                    </p>

                    <p className="mt-2 text-sm font-bold text-slate-500">
                      Listing:{" "}
{getApplicationProperty(application)
  ? `${getApplicationProperty(application)?.title} · ${
      getApplicationProperty(application)?.city
    }, ${getApplicationProperty(application)?.state}`
  : "Unknown listing"}
                    </p>
                  </div>

                  <p className="rounded-2xl bg-[#f7f4ef] px-5 py-4 text-sm font-bold text-slate-600">
                    Submitted{" "}
                    {new Date(application.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No applications yet</h3>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-2xl font-black">Users</h2>
          </div>

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
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No users yet</h3>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}