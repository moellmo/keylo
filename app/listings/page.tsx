import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import ListingsClient from "./ListingsClient";

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
  city: string;
  state: string;
  description: string | null;
  pet_policy: string | null;
  status: string;
  created_at: string;
  property_photos: PropertyPhoto[];
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
      city,
      state,
      description,
      pet_policy,
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
      <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
       

        <div className="mx-auto max-w-7xl px-6 py-10">
          <Link href="/" className="text-sm font-bold text-slate-600">
            ← Back to Home
          </Link>

          <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <h1 className="text-3xl font-black">Could not load listings</h1>
            <p className="mt-3 text-slate-600">{error.message}</p>
          </div>
        </div>
      </main>
    );
  }

  const rentalListings = (listings || []) as Property[];

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/" className="text-sm font-bold text-slate-600">
              ← Back to Home
            </Link>

            <h1 className="mt-4 text-5xl font-black tracking-tight">
              Browse Rentals
            </h1>

            <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-600">
              Search available rentals posted by verified landlords.
            </p>
          </div>

          <Link
            href="/dashboard/landlord/properties/new"
            className="rounded-full bg-slate-950 px-6 py-3 text-center font-black text-white"
          >
            Post a Listing
          </Link>
        </div>

        <ListingsClient listings={rentalListings} />
      </div>
    </main>
  );
}