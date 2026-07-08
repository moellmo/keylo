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
    <main className="min-h-screen bg-[#f7f1e7] text-[#07101f]">
      <section className="relative overflow-hidden">
        <div className="absolute left-[-120px] top-[-120px] h-80 w-80 rounded-full bg-[#f5c76a]/35 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-96 w-96 rounded-full bg-[#c9a46a]/25 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-[1.05fr_0.95fr] md:items-center md:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d8cdbb] bg-white/80 px-4 py-2 text-sm font-black text-[#23314a] shadow-sm">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#07101f] text-xs text-[#f5c76a]">
                ✦
              </span>
              Your key to renting smarter
            </div>

            <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.06em] md:text-7xl">
              Renting should feel clear, trusted, and simple.
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#31415f] md:text-xl">
              Keylo helps landlords list rentals, screen applicants, build
              leases, track payments, manage maintenance, and communicate with
              tenants — all from one clean rental platform.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/listings"
                className="rounded-full bg-[#07101f] px-7 py-4 text-center text-base font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                Browse Rentals
              </Link>

              <Link
                href="/dashboard/landlord/properties/new"
                className="rounded-full border border-[#d6ccbc] bg-white px-7 py-4 text-center text-base font-black text-[#07101f] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                Post a Listing
              </Link>
            </div>

            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
              <TrustPill label="Verified listings" />
              <TrustPill label="Instant Apply" />
              <TrustPill label="Lease tools" />
            </div>
          </div>

          <div className="relative">
            <div className="absolute -right-4 -top-4 hidden rounded-3xl bg-[#f5c76a] px-5 py-4 font-black shadow-lg md:block">
              Keylo Verify
            </div>

            <div className="rounded-[2rem] border border-[#d8cdbb] bg-white/80 p-4 shadow-2xl backdrop-blur">
              <div className="rounded-[1.5rem] bg-[#07101f] p-6 text-white">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.25em] text-[#f5c76a]">
                      Featured Rentals
                    </p>
                    <p className="mt-2 text-sm font-bold text-slate-300">
                      Fresh listings from verified landlords
                    </p>
                  </div>

                  <div className="hidden rounded-2xl bg-white/10 px-4 py-3 text-right sm:block">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      Live
                    </p>
                    <p className="text-lg font-black">
                      {featuredListings.length}
                    </p>
                  </div>
                </div>

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
                        className="block rounded-2xl bg-white p-5 text-[#07101f] transition hover:-translate-y-0.5 hover:shadow-xl"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-black">
                              {listing.title}
                            </h3>

                            <p className="mt-1 text-sm font-bold text-[#63708a]">
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

                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-black text-[#53627a]">
                          {listing.bedrooms !== null && (
                            <span className="rounded-full bg-[#f1eee8] px-3 py-1">
                              {listing.bedrooms}{" "}
                              {listing.bedrooms === 1 ? "bed" : "beds"}
                            </span>
                          )}

                          {listing.bathrooms !== null && (
                            <span className="rounded-full bg-[#f1eee8] px-3 py-1">
                              {listing.bathrooms}{" "}
                              {listing.bathrooms === 1 ? "bath" : "baths"}
                            </span>
                          )}

                          <span className="rounded-full bg-[#fff1bf] px-3 py-1 text-[#6b4c00]">
                            Verified
                          </span>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-white p-6 text-[#07101f]">
                      <h3 className="text-xl font-black">
                        No featured rentals yet
                      </h3>

                      <p className="mt-3 leading-7 text-[#53627a]">
                        Published rentals will appear here automatically once
                        listings are approved.
                      </p>

                      <Link
                        href="/dashboard/landlord/properties/new"
                        className="mt-5 inline-flex rounded-full bg-[#07101f] px-5 py-3 text-sm font-black text-white"
                      >
                        Post the First Listing
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#ded6c8] bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-5 px-6 md:grid-cols-4">
          <StatCard value="1" label="Platform for the full rental flow" />
          <StatCard value="$75" label="Simple e-sign fee model" />
          <StatCard value="24/7" label="Tenant portal access" />
          <StatCard value="100%" label="Built around trust and clarity" />
        </div>
      </section>

      <section className="bg-[#07101f] py-20 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-[#f5c76a]">
              Keylo Platform
            </p>

            <h2 className="mt-4 text-4xl font-black tracking-[-0.04em] md:text-6xl">
              More than listings. A cleaner way to manage rentals.
            </h2>

            <p className="mt-5 text-lg leading-8 text-slate-300">
              Keylo is being built as a real rental operating system: listings,
              applications, verification, leases, messages, rent tracking, and
              maintenance in one place.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <FeatureCard
              eyebrow="Apply"
              title="Instant Apply"
              text="Tenants can save their renter profile, upload documents, and apply faster."
            />

            <FeatureCard
              eyebrow="Trust"
              title="Keylo Verify"
              text="Landlords and listings can be reviewed before going live, helping the marketplace feel safer."
            />

            <FeatureCard
              eyebrow="Lease"
              title="Lease Builder"
              text="Create lease templates, send leases, collect e-sign fees, and track signatures."
            />

            <FeatureCard
              eyebrow="Manage"
              title="Payments & Maintenance"
              text="Track rent, deposits, unpaid balances, and tenant maintenance requests from dashboards."
            />
          </div>
        </div>
      </section>

      <section className="bg-[#f7f1e7] py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-2">
          <AudienceCard
            label="For Landlords"
            title="Post, screen, lease, and manage in one dashboard."
            text="Keylo gives landlords a cleaner place to publish listings, review applicants, build leases, track charges, and handle maintenance requests."
            href="/landlords"
            button="Explore landlord tools"
          />

          <AudienceCard
            label="For Tenants"
            title="Find rentals and manage the whole process online."
            text="Tenants can browse rentals, save listings, apply online, sign leases, track payments, and submit maintenance requests."
            href="/tenants"
            button="Explore tenant tools"
          />
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="rounded-[2rem] bg-[#07101f] p-8 text-white shadow-xl md:p-12">
            <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.25em] text-[#f5c76a]">
                  Ready to start?
                </p>

                <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] md:text-5xl">
                  List smarter. Apply faster. Rent with confidence.
                </h2>

                <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                  Start with a public listing or browse rentals already on
                  Keylo.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
                <Link
                  href="/listings"
                  className="rounded-full bg-white px-7 py-4 text-center font-black text-[#07101f]"
                >
                  Browse Rentals
                </Link>

                <Link
                  href="/dashboard/landlord/properties/new"
                  className="rounded-full border border-white/20 bg-white/10 px-7 py-4 text-center font-black text-white"
                >
                  Post a Listing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function TrustPill({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-[#d8cdbb] bg-white/80 px-4 py-3 text-sm font-black text-[#23314a] shadow-sm">
      {label}
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-3xl border border-[#ded6c8] bg-[#f7f1e7] p-6">
      <p className="text-4xl font-black tracking-[-0.04em] text-[#07101f]">
        {value}
      </p>
      <p className="mt-2 text-sm font-black uppercase tracking-[0.16em] text-[#6f7b91]">
        {label}
      </p>
    </div>
  );
}

function FeatureCard({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f5c76a]">
        {eyebrow}
      </p>
      <h3 className="mt-3 text-2xl font-black">{title}</h3>
      <p className="mt-3 leading-7 text-slate-300">{text}</p>
    </div>
  );
}

function AudienceCard({
  label,
  title,
  text,
  href,
  button,
}: {
  label: string;
  title: string;
  text: string;
  href: string;
  button: string;
}) {
  return (
    <div className="rounded-[2rem] border border-[#ded6c8] bg-white p-8 shadow-sm">
      <p className="text-sm font-black uppercase tracking-[0.22em] text-[#6f7b91]">
        {label}
      </p>

      <h3 className="mt-4 text-4xl font-black tracking-[-0.04em] text-[#07101f]">
        {title}
      </h3>

      <p className="mt-4 text-lg leading-8 text-[#31415f]">{text}</p>

      <Link
        href={href}
        className="mt-7 inline-flex rounded-full bg-[#07101f] px-6 py-4 font-black text-white"
      >
        {button}
      </Link>
    </div>
  );
}