"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type FeaturedListing = {
  id: string;
  title: string;
  monthly_rent: number | null;
  city: string | null;
  state: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
};

export default function Home() {
  const [featuredListings, setFeaturedListings] = useState<FeaturedListing[]>(
    []
  );
  const [loadingListings, setLoadingListings] = useState(true);

  useEffect(() => {
    async function loadFeaturedListings() {
      setLoadingListings(true);

      const { data, error } = await supabase
        .from("properties")
        .select(
          `
          id,
          title,
          monthly_rent,
          city,
          state,
          bedrooms,
          bathrooms
        `
        )
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(3);

      if (!error && data) {
        setFeaturedListings(data as FeaturedListing[]);
      }

      setLoadingListings(false);
    }

    loadFeaturedListings();
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-24">
        <div>
          <div className="mb-5 inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
            Your key to renting smarter
          </div>

          <h1 className="max-w-4xl text-5xl font-black leading-tight tracking-tight md:text-7xl">
            A better way to list, apply, and rent.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700 md:text-xl">
            Keylo is a rental marketplace built for landlords and tenants. Post
            listings, search rentals, apply online, and manage the rental process
            from one clean platform.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/listings"
              className="rounded-full bg-slate-950 px-7 py-4 text-center text-base font-black text-white"
            >
              Browse Rentals
            </Link>

            <Link
              href="/dashboard/landlord/properties/new"
              className="rounded-full border border-slate-300 bg-white px-7 py-4 text-center text-base font-black text-slate-950"
            >
              Post a Listing
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-4 shadow-xl ring-1 ring-slate-200">
          <div className="rounded-[1.5rem] bg-slate-950 p-6 text-white">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-300">
              Featured rentals
            </p>

            <div className="mt-6 space-y-4">
              {loadingListings ? (
                <>
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-28 animate-pulse rounded-2xl bg-white/20"
                    />
                  ))}
                </>
              ) : featuredListings.length > 0 ? (
                featuredListings.map((listing) => (
                  <Link
                    key={listing.id}
                    href={`/listings/${listing.id}`}
                    className="block rounded-2xl bg-white p-5 text-slate-950 transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-black">{listing.title}</h3>

                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          {[listing.city, listing.state]
                            .filter(Boolean)
                            .join(", ") || "Location available soon"}
                        </p>
                      </div>

                      <p className="shrink-0 text-sm font-black">
                        {listing.monthly_rent
                          ? `$${listing.monthly_rent.toLocaleString()}/mo`
                          : "Contact"}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                      {listing.bedrooms !== null && (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          {listing.bedrooms}{" "}
                          {listing.bedrooms === 1 ? "bed" : "beds"}
                        </span>
                      )}

                      {listing.bathrooms !== null && (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          {listing.bathrooms}{" "}
                          {listing.bathrooms === 1 ? "bath" : "baths"}
                        </span>
                      )}

                      <span className="rounded-full bg-slate-100 px-3 py-1">
                        Verified
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl bg-white p-6 text-slate-950">
                  <h3 className="text-xl font-black">
                    No featured rentals yet
                  </h3>

                  <p className="mt-3 leading-7 text-slate-600">
                    Published rentals will appear here automatically once
                    listings are approved.
                  </p>

                  <Link
                    href="/dashboard/landlord/properties/new"
                    className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
                  >
                    Post the First Listing
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Phase 1 MVP
          </p>

          <h2 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
            Built first as a real rental website.
          </h2>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            The first version focuses on the core marketplace: public listings,
            landlord posting tools, tenant applications, and dashboards.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-4">
            {[
              "Verified rental listings",
              "Tenant applications",
              "Landlord dashboard",
              "Lease signing and messages",
            ].map((item) => (
              <div
                key={item}
                className="rounded-3xl border border-slate-200 bg-[#f7f4ef] p-6"
              >
                <h3 className="text-xl font-black">{item}</h3>

                <p className="mt-3 leading-7 text-slate-600">
                  Keylo gives landlords and tenants the core tools needed to
                  list, apply, communicate, and manage rentals in one place.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}