import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import SaveListingButton from "./SaveListingButton";
import LandlordScoreOnListing from "@/components/LandlordScoreOnListing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  latitude: number | string | null;
  longitude: number | string | null;
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

function formatMoney(value: number) {
  return `$${Number(value || 0).toLocaleString()}/mo`;
}

function formatRoom(value: string | null, singular: string, plural: string) {
  if (!value) return `— ${plural}`;

  if (value.toLowerCase() === "studio") return "Studio";

  return `${value} ${value === "1" ? singular : plural}`;
}

function formatAvailableDate(value: string | null) {
  if (!value) return "Availability not listed";

  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return `Available ${value}`;
  }

  return `Available ${parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function cleanNeighborhood(city: string, neighborhood: string | null) {
  if (!neighborhood) return "";

  if (neighborhood.trim().toLowerCase() === city.trim().toLowerCase()) {
    return "";
  }

  return neighborhood;
}

function getWebsiteHref(website: string) {
  if (website.startsWith("http://") || website.startsWith("https://")) {
    return website;
  }

  return `https://${website}`;
}

function getLocationLine(property: Property) {
  return [
    cleanNeighborhood(property.city, property.neighborhood),
    property.city,
    property.state,
    property.zip_code,
  ]
    .filter(Boolean)
    .join(", ");
}

function getMapHref(property: Property) {
  const query = [
    property.street_address,
    property.city,
    property.state,
    property.zip_code,
  ]
    .filter(Boolean)
    .join(", ");

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query || `${property.city}, ${property.state}`
  )}`;
}

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
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-10 text-slate-950 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-4xl rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <h1 className="text-3xl font-black tracking-tight">
            Listing not found
          </h1>

          <p className="mt-3 leading-7 text-slate-600">
            This listing may have been removed or is not available.
          </p>

          <Link
            href="/listings"
            className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
          >
            ← Back to rentals
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
  const locationLine = getLocationLine(property);
  const neighborhood = cleanNeighborhood(property.city, property.neighborhood);
  const hasContactInfo =
    landlordProfile?.email || landlordProfile?.phone || landlordProfile?.website;

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/listings"
          className="inline-flex text-sm font-black text-slate-600 transition hover:text-slate-950"
        >
          ← Back to rentals
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_390px] lg:items-start">
          <section className="min-w-0">
            <div className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
              {mainPhoto ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mainPhoto.photo_url}
                    alt={property.title}
                    className="h-[280px] w-full object-cover sm:h-[420px] lg:h-[500px]"
                  />
                </>
              ) : (
                <div className="flex h-[280px] items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100 sm:h-[420px] lg:h-[500px]">
                  <div className="text-center">
                    <p className="text-5xl font-black text-slate-300">K</p>
                    <p className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                      Photos coming soon
                    </p>
                  </div>
                </div>
              )}
            </div>

            {photos.length > 1 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {photos.slice(1, 5).map((photo, index) => (
                  <div
                    key={`${photo.photo_url}-${index}`}
                    className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.photo_url}
                      alt={`${property.title} photo ${index + 2}`}
                      className="h-28 w-full object-cover sm:h-32"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a7652]">
                    Verified rental
                  </p>

                  <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] sm:text-5xl">
                    {property.title}
                  </h1>

                  <p className="mt-3 text-base font-black text-slate-700 sm:text-lg">
                    {locationLine}
                  </p>

                  {neighborhood && (
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {neighborhood}
                    </p>
                  )}
                </div>

                <div className="rounded-3xl bg-[#fff1bf] px-5 py-4 text-left sm:text-right">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7a5a00]">
                    Rent
                  </p>
                  <p className="mt-1 text-2xl font-black">
                    {formatMoney(property.monthly_rent)}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 text-sm font-black text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
                <span className="rounded-2xl bg-slate-100 px-4 py-3">
                  {formatRoom(property.bedrooms, "bed", "beds")}
                </span>

                <span className="rounded-2xl bg-slate-100 px-4 py-3">
                  {formatRoom(property.bathrooms, "bath", "baths")}
                </span>

                <span className="rounded-2xl bg-slate-100 px-4 py-3">
                  {property.pet_policy || "Pet policy not listed"}
                </span>

                <span className="rounded-2xl bg-slate-100 px-4 py-3">
                  {formatAvailableDate(property.available_date)}
                </span>
              </div>

              <div className="mt-8 border-t border-slate-200 pt-8">
                <h2 className="text-2xl font-black">About this rental</h2>

                <p className="mt-3 whitespace-pre-line text-base leading-8 text-slate-600 sm:text-lg">
                  {property.description ||
                    "The landlord has not added a full description yet."}
                </p>
              </div>

              {property.amenities && property.amenities.length > 0 && (
                <div className="mt-8 border-t border-slate-200 pt-8">
                  <h2 className="text-2xl font-black">Amenities</h2>

                  <div className="mt-4 flex flex-wrap gap-2 text-sm font-black text-slate-700">
                    {property.amenities.map((amenity) => (
                      <span
                        key={amenity}
                        className="rounded-full bg-slate-100 px-4 py-2"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 border-t border-slate-200 pt-8">
                <div className="rounded-[1.5rem] bg-[#f7f4ef] p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-black">Location</h2>
                      <p className="mt-2 font-bold text-slate-600">
                        {locationLine}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        Exact address details may be confirmed during the
                        application process.
                      </p>
                    </div>

                    <a
                      href={getMapHref(property)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-white px-5 py-3 text-center text-sm font-black shadow-sm ring-1 ring-slate-200"
                    >
                      Open map
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="h-fit rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6 lg:sticky lg:top-6">
            <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
              <p className="text-3xl font-black">
                {formatMoney(property.monthly_rent)}
              </p>

              <p className="mt-1 text-sm font-bold text-slate-300">
                Listed on Keylo
              </p>

              <div className="mt-5 space-y-3">
                <Link
                  href={`/apply/${property.id}`}
                  className="block rounded-full bg-white px-6 py-4 text-center font-black text-slate-950"
                >
                  Apply Now
                </Link>

                <SaveListingButton propertyId={property.id} />
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] bg-[#f7f4ef] p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Listed by
              </p>

              <h3 className="mt-2 text-xl font-black">
                {landlordProfile?.company_name ||
                  landlordProfile?.full_name ||
                  "Keylo Landlord"}
              </h3>

              {landlordProfile?.bio && (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {landlordProfile.bio}
                </p>
              )}

              {hasContactInfo && (
                <div className="mt-4 space-y-2 text-sm font-bold text-slate-600">
                  {landlordProfile?.email && (
                    <p className="break-words">
                      Email: {landlordProfile.email}
                    </p>
                  )}

                  {landlordProfile?.phone && (
                    <p>Phone: {landlordProfile.phone}</p>
                  )}

                  {landlordProfile?.website && (
                    <p className="break-words">
                      Website:{" "}
                      <a
                        href={getWebsiteHref(landlordProfile.website)}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-2 underline-offset-4"
                      >
                        {landlordProfile.website}
                      </a>
                    </p>
                  )}
                </div>
              )}
            </div>

            <LandlordScoreOnListing landlordId={property.landlord_id} />

            <div className="mt-5 rounded-[1.5rem] bg-[#f7f4ef] p-5">
              <h3 className="font-black">How applying works</h3>

              <div className="mt-4 space-y-3 text-sm font-bold leading-6 text-slate-600">
                <p>1. Submit your rental application online.</p>
                <p>2. The landlord reviews your details in Keylo.</p>
                <p>3. If approved, next steps are handled from your dashboard.</p>
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white p-5">
              <h3 className="font-black">Need help?</h3>

              <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                Have a question before applying? Use the listing details and
                landlord information above to confirm anything important first.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}