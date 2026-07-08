import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import SaveListingButton from "./SaveListingButton";
import LandlordScoreOnListing from "@/components/LandlordScoreOnListing";

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
  created_at: string;
  property_photos: PropertyPhoto[];
};

type LandlordProfile = {
  full_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  bio: string | null;
};

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
    .eq("id", id)
    .eq("status", "published")
    .single();

  if (error || !listing) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-12 text-slate-950">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Listing not found</h1>

          <p className="mt-3 text-slate-600">
            This listing may have been removed or is not available.
          </p>

          <Link href="/listings" className="mt-6 inline-block font-bold">
            ← Back to listings
          </Link>
        </div>
      </main>
    );
  }

  const property = listing as Property;

  let landlordProfile: LandlordProfile | null = null;

  if (property.landlord_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, company_name, email, phone, website, bio")
      .eq("id", property.landlord_id)
      .single();

    landlordProfile = profile as LandlordProfile | null;
  }

  const photos = [...(property.property_photos || [])].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
  );

  const mainPhoto = photos[0];

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link href="/listings" className="text-sm font-bold text-slate-600">
          ← Back to Rentals
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
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
                {property.status} rental
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                {property.title}
              </h1>

              <p className="mt-3 text-lg font-bold text-slate-600">
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

              <h2 className="mt-8 text-2xl font-black">About this rental</h2>

              <p className="mt-3 text-lg leading-8 text-slate-600">
                {property.description || "No description added yet."}
              </p>

              {property.amenities && property.amenities.length > 0 && (
                <>
                  <h2 className="mt-8 text-2xl font-black">Amenities</h2>

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
              Listed on Keylo
            </p>

            <div className="mt-6 space-y-3">
              <Link
                href={`/apply/${property.id}`}
                className="block rounded-full bg-slate-950 px-6 py-4 text-center font-black text-white"
              >
                Apply Now
              </Link>

              <SaveListingButton propertyId={property.id} />
            </div>

            <div className="mt-6 rounded-2xl bg-[#f7f4ef] p-5">
              <h3 className="font-black">Listed by</h3>

              <p className="mt-2 text-lg font-black">
                {landlordProfile?.company_name ||
                  landlordProfile?.full_name ||
                  "Keylo Landlord"}
              </p>

              {landlordProfile?.bio && (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {landlordProfile.bio}
                </p>
              )}

              <div className="mt-4 space-y-2 text-sm font-bold text-slate-600">
                {landlordProfile?.email && <p>Email: {landlordProfile.email}</p>}

                {landlordProfile?.phone && <p>Phone: {landlordProfile.phone}</p>}

                {landlordProfile?.website && (
                  <p>
                    Website:{" "}
                    <a
                      href={landlordProfile.website}
                      target="_blank"
                      className="underline"
                    >
                      {landlordProfile.website}
                    </a>
                  </p>
                )}
              </div>
            </div>

            <LandlordScoreOnListing landlordId={property.landlord_id} />

            <div className="mt-4 rounded-2xl bg-[#f7f4ef] p-5">
              <h3 className="font-black">Keylo Phase 1</h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Tenants can apply online and landlords can review the
                application in their dashboard.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}