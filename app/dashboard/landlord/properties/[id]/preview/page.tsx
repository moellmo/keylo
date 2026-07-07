"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type PropertyPhoto = {
  photo_url: string;
  sort_order: number | null;
};

type Property = {
  id: string;
  landlord_id: string | null;
  title: string;
  monthly_rent: number;
  available_date: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  street_address: string | null;
  city: string;
  state: string;
  zip_code: string | null;
  neighborhood: string | null;
  description: string | null;
  pet_policy: string | null;
  amenities: string[] | null;
  status: string;
  rejection_note: string | null;
  created_at: string;
  property_photos: PropertyPhoto[];
};

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  website: string | null;
  bio: string | null;
};

export default function LandlordListingPreviewPage() {
  const params = useParams();
  const propertyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [property, setProperty] = useState<Property | null>(null);
  const [landlord, setLandlord] = useState<Profile | null>(null);

  useEffect(() => {
    async function loadPreview() {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Please log in as a landlord to preview this listing.");
        setAllowed(false);
        setLoading(false);
        return;
      }

      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const { data: listing, error } = await supabase
        .from("properties")
        .select(
          `
          *,
          property_photos (
            photo_url,
            sort_order
          )
        `
        )
        .eq("id", propertyId)
        .single();

      if (error || !listing) {
        setMessage("Listing not found.");
        setAllowed(false);
        setLoading(false);
        return;
      }

      const propertyData = listing as Property;

      const isAdmin = currentProfile?.role === "admin";
      const isListingOwner = propertyData.landlord_id === user.id;

      if (!isAdmin && !isListingOwner) {
        setMessage("You do not have permission to preview this listing.");
        setAllowed(false);
        setLoading(false);
        return;
      }

      if (propertyData.landlord_id) {
        const { data: landlordProfile } = await supabase
          .from("profiles")
          .select("id, email, full_name, company_name, phone, website, bio")
          .eq("id", propertyData.landlord_id)
          .single();

        setLandlord(landlordProfile as Profile | null);
      }

      setProperty(propertyData);
      setAllowed(true);
      setLoading(false);
    }

    loadPreview();
  }, [propertyId]);

  function statusLabel(status: string) {
    if (status === "pending") return "Pending Review";
    if (status === "published") return "Published";
    if (status === "draft") return "Draft";
    if (status === "paused") return "Paused";
    if (status === "archived") return "Archived";
    if (status === "rejected") return "Rejected";
    return status;
  }

  function statusClass(status: string) {
    if (status === "published") return "bg-green-50 text-green-700";
    if (status === "pending") return "bg-yellow-50 text-yellow-700";
    if (status === "rejected") return "bg-red-50 text-red-700";
    return "bg-slate-100 text-slate-600";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading preview...</h1>
        </div>
      </main>
    );
  }

  if (!allowed || !property) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Preview unavailable</h1>
          <p className="mt-3 text-slate-600">{message}</p>

          <Link
            href="/dashboard/landlord"
            className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const photos = [...(property.property_photos || [])].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
  );

  const mainPhoto = photos[0];

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link
          href="/dashboard/landlord"
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Landlord Dashboard
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Landlord Listing Preview
              </p>

              <h1 className="mt-2 text-4xl font-black">{property.title}</h1>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-full px-4 py-2 text-sm font-black ${statusClass(
                    property.status
                  )}`}
                >
                  {statusLabel(property.status)}
                </span>

                <span className="text-sm font-bold text-slate-500">
                  Private preview only
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {property.status === "published" && (
                <Link
                  href={`/listings/${property.id}`}
                  className="rounded-full bg-slate-950 px-5 py-3 text-center font-black text-white"
                >
                  Public View
                </Link>
              )}

              <Link
                href={`/dashboard/landlord/properties/${property.id}/edit`}
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center font-black"
              >
                Edit Listing
              </Link>
            </div>
          </div>

          {property.status === "pending" && (
            <div className="mt-6 rounded-2xl bg-yellow-50 px-5 py-4 text-sm font-bold text-yellow-700">
              This listing is waiting for admin approval before it appears
              publicly.
            </div>
          )}

          {property.status === "rejected" && property.rejection_note && (
            <div className="mt-6 rounded-2xl bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
              Rejection reason: {property.rejection_note}
            </div>
          )}

          {property.status === "rejected" && !property.rejection_note && (
            <div className="mt-6 rounded-2xl bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
              This listing was rejected. Please edit it and resubmit for review.
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <section>
            {mainPhoto ? (
              <div className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
                <img
                  src={mainPhoto.photo_url}
                  alt={property.title}
                  className="h-[420px] w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-[420px] items-center justify-center rounded-[2rem] bg-gradient-to-br from-slate-200 to-slate-100">
                <div className="text-center">
                  <p className="text-lg font-black text-slate-500">
                    Property Photos
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-400">
                    No photos uploaded yet
                  </p>
                </div>
              </div>
            )}

            {photos.length > 1 && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                {photos.slice(1).map((photo, index) => (
                  <img
                    key={`${photo.photo_url}-${index}`}
                    src={photo.photo_url}
                    alt={`${property.title} photo ${index + 2}`}
                    className="h-32 w-full rounded-2xl object-cover shadow-sm ring-1 ring-slate-200"
                  />
                ))}
              </div>
            )}

            <div className="mt-8 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                {statusLabel(property.status)} rental
              </p>

              <h2 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                {property.title}
              </h2>

              <p className="mt-3 text-lg font-bold text-slate-600">
                {property.street_address ? `${property.street_address}, ` : ""}
                {property.city}, {property.state}
                {property.zip_code ? ` ${property.zip_code}` : ""}
              </p>

              {property.neighborhood && (
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {property.neighborhood}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3 text-sm font-black text-slate-700">
                <span className="rounded-full bg-slate-100 px-4 py-2">
                  {property.bedrooms || "—"} beds
                </span>

                <span className="rounded-full bg-slate-100 px-4 py-2">
                  {property.bathrooms || "—"} baths
                </span>

                <span className="rounded-full bg-slate-100 px-4 py-2">
                  {property.pet_policy || "Pet policy not listed"}
                </span>

                <span className="rounded-full bg-slate-100 px-4 py-2">
                  {property.available_date
                    ? `Available ${property.available_date}`
                    : "Availability not listed"}
                </span>
              </div>

              <h3 className="mt-8 text-2xl font-black">About this rental</h3>

              <p className="mt-3 text-lg leading-8 text-slate-600">
                {property.description || "No description added yet."}
              </p>

              {property.amenities && property.amenities.length > 0 && (
                <>
                  <h3 className="mt-8 text-2xl font-black">Amenities</h3>
                  <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold text-slate-600">
                    {property.amenities.map((amenity) => (
                      <span
                        key={amenity}
                        className="rounded-full bg-slate-100 px-4 py-2"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>

          <aside className="h-fit rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-6">
            <p className="text-3xl font-black">
              ${property.monthly_rent.toLocaleString()}/mo
            </p>

            <p className="mt-1 text-sm font-bold text-slate-500">
              Private landlord preview
            </p>

            <div className="mt-6 space-y-3">
              {property.status === "published" && (
                <Link
                  href={`/listings/${property.id}`}
                  className="block rounded-full bg-slate-950 px-6 py-4 text-center font-black text-white"
                >
                  Public View
                </Link>
              )}

              <Link
                href={`/dashboard/landlord/properties/${property.id}/edit`}
                className="block rounded-full border border-slate-300 bg-white px-6 py-4 text-center font-black"
              >
                Edit Listing
              </Link>

              <Link
                href="/dashboard/landlord"
                className="block rounded-full border border-slate-300 bg-white px-6 py-4 text-center font-black"
              >
                Back to Dashboard
              </Link>
            </div>

            <div className="mt-6 rounded-2xl bg-[#f7f4ef] p-5">
              <h3 className="font-black">Listed by</h3>

              <p className="mt-2 text-lg font-black">
                {landlord?.company_name ||
                  landlord?.full_name ||
                  landlord?.email ||
                  "Keylo Landlord"}
              </p>

              {landlord?.email && (
                <p className="mt-3 text-sm font-bold text-slate-600">
                  Email: {landlord.email}
                </p>
              )}

              {landlord?.phone && (
                <p className="mt-2 text-sm font-bold text-slate-600">
                  Phone: {landlord.phone}
                </p>
              )}

              {landlord?.website && (
                <p className="mt-2 text-sm font-bold text-slate-600">
                  Website: {landlord.website}
                </p>
              )}

              {landlord?.bio && (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {landlord.bio}
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}