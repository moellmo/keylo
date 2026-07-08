import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import ListingsClient from "./ListingsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PropertyPhoto = {
  photo_url: string;
  sort_order: number | null;
};

type Property = {
  id: string;
  title: string;
  monthly_rent: number;
  bedrooms: string | null;
  bathrooms: string | null;
  street_address: string | null;
  city: string;
  state: string;
  zip_code: string | null;
  neighborhood: string | null;
  available_date: string | null;
  description: string | null;
  pet_policy: string | null;
  status: string;
  created_at: string;
  property_photos: PropertyPhoto[];
  latitude: number | null;
longitude: number | null;
};

export default async function ListingsPage() {
  const { data: listings, error } = await supabase
    .from("properties")
    .select(
      `
      id,
      title,
      monthly_rent,
      bedrooms,
      bathrooms,
      street_address,
      city,
      state,
      zip_code,
      neighborhood,
      available_date,
      description,
      pet_policy,
      latitude,
longitude,
      status,
      created_at,
      property_photos (
        photo_url,
        sort_order
      )
    `
    )
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-[#f7f1e7] text-[#07101f]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
          <Link href="/" className="text-sm font-bold text-[#6f7b91]">
            ← Back to Home
          </Link>

          <div className="mt-8 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-[#ded6c8]">
            <h1 className="text-3xl font-black">Could not load listings</h1>
            <p className="mt-3 text-[#31415f]">{error.message}</p>
          </div>
        </div>
      </main>
    );
  }

  const rentalListings = (listings || []) as Property[];

  return (
    <main className="min-h-screen bg-[#f7f1e7] text-[#07101f]">
      <section className="border-b border-[#ded6c8] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
          <Link href="/" className="text-sm font-bold text-[#6f7b91]">
            ← Back to Home
          </Link>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-[#8a7652]">
                Rentals
              </p>

              <h1 className="mt-3 text-5xl font-black tracking-[-0.06em] sm:text-6xl">
                Browse Rentals
              </h1>

              <p className="mt-4 max-w-2xl text-lg leading-8 text-[#31415f]">
                Search verified rentals by location, rent, bedrooms, bathrooms,
                pet policy, and availability.
              </p>
            </div>

            <Link
              href="/landlords"
              className="rounded-full bg-[#07101f] px-6 py-4 text-center font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              List Your Property
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <ListingsClient listings={rentalListings} />
      </div>
    </main>
  );
}