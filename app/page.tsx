"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type PropertyPhoto = {
  photo_url: string;
  sort_order: number | null;
};

type FeaturedListing = {
  id: string;
  title: string;
  monthly_rent: number | null;
  city: string | null;
  state: string | null;
  bedrooms: string | number | null;
  bathrooms: string | number | null;
  property_photos: PropertyPhoto[] | null;
};

function getMainPhoto(listing: FeaturedListing) {
  const photos = [...(listing.property_photos || [])].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
  );

  return photos[0]?.photo_url || null;
}

function formatRent(value: number | null) {
  if (!value) return "Contact";

  return `$${value.toLocaleString()}/mo`;
}

function formatRoom(value: string | number | null, singular: string, plural: string) {
  if (value === null || value === undefined || value === "") return null;

  return `${value} ${String(value) === "1" ? singular : plural}`;
}

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
          bathrooms,
          property_photos (
            photo_url,
            sort_order
          )
        `
        )
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(3);

      if (!error && data) {
        setFeaturedListings(data as unknown as FeaturedListing[]);
      }

      setLoadingListings(false);
    }

    loadFeaturedListings();
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f1e7] text-[#07101f]">
      <section className="relative overflow-hidden border-b border-[#ded6c8]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,199,106,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(7,16,31,0.10),transparent_38%)]" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-14 md:grid-cols-[1.02fr_0.98fr] md:items-center md:py-20 lg:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d8cdbb] bg-white/85 px-4 py-2 text-sm font-black text-[#23314a] shadow-sm">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#07101f] text-xs text-[#f5c76a]">
                K
              </span>
              A smarter rental platform for landlords and tenants
            </div>

            <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.06em] md:text-7xl">
              Find it. Apply. Sign. Manage it all in Keylo.
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#31415f] md:text-xl">
              Keylo brings rentals, applications, leases, payments, messages,
              and maintenance into one simple platform — built to make renting
              feel clear, trusted, and organized.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/listings"
                className="rounded-full bg-[#07101f] px-7 py-4 text-center text-base font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                Browse Rentals
              </Link>

              <Link
                href="/landlords"
                className="rounded-full border border-[#d6ccbc] bg-white px-7 py-4 text-center text-base font-black text-[#07101f] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                List Your Property
              </Link>
            </div>

            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <TrustPill label="Verified landlords" />
              <TrustPill label="Online applications" />
              <TrustPill label="Digital leases" />
              <TrustPill label="Maintenance tracking" />
            </div>
          </div>

          <HeroProductCard />
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-5 px-6 md:grid-cols-4">
          <StatCard value="Apply" label="Submit renter details online" />
          <StatCard value="Sign" label="Review and e-sign leases" />
          <StatCard value="Pay" label="Track rent and deposits" />
          <StatCard value="Fix" label="Manage maintenance requests" />
        </div>
      </section>

      <section className="bg-[#f7f1e7] py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-[#8a7652]">
                Featured Rentals
              </p>

              <h2 className="mt-3 text-4xl font-black tracking-[-0.05em] md:text-6xl">
                Fresh rentals, cleaner details.
              </h2>

              <p className="mt-4 max-w-2xl text-lg leading-8 text-[#31415f]">
                Browse current listings with photos, rent details, location,
                and application tools all in one place.
              </p>
            </div>

            <Link
              href="/listings"
              className="rounded-full bg-[#07101f] px-6 py-4 text-center font-black text-white shadow-sm"
            >
              View All Rentals
            </Link>
          </div>

          <div className="mt-10">
            {loadingListings ? (
              <div className="grid gap-6 md:grid-cols-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-96 animate-pulse rounded-[2rem] bg-white shadow-sm ring-1 ring-[#ded6c8]"
                  />
                ))}
              </div>
            ) : featuredListings.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-3">
                {featuredListings.map((listing) => (
                  <FeaturedListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <div className="rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-[#ded6c8]">
                <h3 className="text-3xl font-black">Listings coming soon</h3>

                <p className="mx-auto mt-3 max-w-2xl text-lg leading-8 text-[#31415f]">
                  Approved rentals will appear here automatically once landlords
                  publish listings on Keylo.
                </p>

                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link
                    href="/dashboard/landlord/properties/new"
                    className="rounded-full bg-[#07101f] px-6 py-4 text-center font-black text-white"
                  >
                    Post the First Listing
                  </Link>

                  <Link
                    href="/listings"
                    className="rounded-full border border-[#d6ccbc] bg-white px-6 py-4 text-center font-black text-[#07101f]"
                  >
                    Browse Rentals
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-[#07101f] py-20 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-[#f5c76a]">
                How Keylo works
              </p>

              <h2 className="mt-4 text-4xl font-black tracking-[-0.04em] md:text-6xl">
                One flow for the whole rental journey.
              </h2>

              <p className="mt-5 text-lg leading-8 text-slate-300">
                Instead of jumping between texts, PDFs, emails, payment notes,
                and spreadsheets, Keylo keeps the rental process in one clean
                place.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <FeatureCard
                number="01"
                title="Browse & apply"
                text="Tenants find rentals, save details, and apply with a renter profile."
              />

              <FeatureCard
                number="02"
                title="Review applicants"
                text="Landlords review applications, screening consent, messages, and documents."
              />

              <FeatureCard
                number="03"
                title="Send leases"
                text="Build lease terms, send to tenants, collect e-signatures, and track status."
              />

              <FeatureCard
                number="04"
                title="Manage after move-in"
                text="Track rent charges, deposits, maintenance requests, updates, and renewals."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f7f1e7] py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-2">
          <AudienceCard
            label="For Landlords"
            title="Post, review, lease, and manage from one dashboard."
            text="Keylo gives landlords and property teams tools for listings, applicants, leases, payment tracking, messages, and maintenance."
            href="/landlords"
            button="Explore Landlord Tools"
          />

          <AudienceCard
            label="For Tenants"
            title="A simpler way to find and manage your rental."
            text="Tenants can browse rentals, apply online, sign leases, track payments, and submit maintenance requests from their portal."
            href="/tenants"
            button="Explore Tenant Tools"
          />
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="overflow-hidden rounded-[2rem] bg-[#07101f] text-white shadow-xl">
            <div className="grid gap-0 lg:grid-cols-[1fr_420px]">
              <div className="p-8 md:p-12">
                <p className="text-sm font-black uppercase tracking-[0.25em] text-[#f5c76a]">
                  Ready to start?
                </p>

                <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] md:text-5xl">
                  List smarter. Apply faster. Rent with more confidence.
                </h2>

                <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                  Keylo is built for the full rental journey — from the first
                  listing to the signed lease and everything after.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/listings"
                    className="rounded-full bg-white px-7 py-4 text-center font-black text-[#07101f]"
                  >
                    Browse Rentals
                  </Link>

                  <Link
                    href="/landlords"
                    className="rounded-full border border-white/20 bg-white/10 px-7 py-4 text-center font-black text-white"
                  >
                    List Your Property
                  </Link>
                </div>
              </div>

              <div className="bg-white/[0.06] p-8 md:p-10">
                <div className="rounded-[1.5rem] bg-white p-6 text-[#07101f]">
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-[#8a7652]">
                    Built for clarity
                  </p>

                  <div className="mt-5 grid gap-3">
                    <ChecklistItem text="Verified rental profiles" />
                    <ChecklistItem text="Applicant and lease tracking" />
                    <ChecklistItem text="Payment and deposit records" />
                    <ChecklistItem text="Maintenance history in one place" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function HeroProductCard() {
  return (
    <div className="relative">
      <div className="rounded-[2rem] border border-[#d8cdbb] bg-white/85 p-4 shadow-2xl backdrop-blur">
        <div className="rounded-[1.5rem] bg-[#07101f] p-5 text-white sm:p-6">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#f5c76a]">
                Keylo Dashboard
              </p>
              <h3 className="mt-2 text-2xl font-black">
                Rental command center
              </h3>
            </div>

            <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Flow
              </p>
              <p className="text-lg font-black">4 steps</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <HeroStep
              label="Listing"
              title="Publish a verified rental"
              status="Live"
            />
            <HeroStep
              label="Application"
              title="Review tenant details"
              status="Ready"
            />
            <HeroStep
              label="Lease"
              title="Send and e-sign online"
              status="Sent"
            />
            <HeroStep
              label="Maintenance"
              title="Track requests after move-in"
              status="Open"
            />
          </div>

          <div className="mt-5 rounded-2xl bg-white p-5 text-[#07101f]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-[#8a7652]">
                  Next action
                </p>
                <p className="mt-1 text-lg font-black">
                  Tenant lease awaiting signature
                </p>
              </div>

              <span className="rounded-full bg-[#fff1bf] px-3 py-1 text-xs font-black text-[#6b4c00]">
                Smart alert
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroStep({
  label,
  title,
  status,
}: {
  label: string;
  title: string;
  status: string;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.08] p-4 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            {label}
          </p>
          <p className="mt-1 font-black">{title}</p>
        </div>

        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#07101f]">
          {status}
        </span>
      </div>
    </div>
  );
}

function FeaturedListingCard({ listing }: { listing: FeaturedListing }) {
  const mainPhoto = getMainPhoto(listing);
  const beds = formatRoom(listing.bedrooms, "bed", "beds");
  const baths = formatRoom(listing.bathrooms, "bath", "baths");

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-[#ded6c8] transition hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="relative h-56 overflow-hidden bg-[#e9e0d2]">
        {mainPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mainPhoto}
            alt={listing.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#e8ddca] to-[#f7f1e7]">
            <div className="text-center">
              <p className="text-4xl font-black text-[#07101f]">K</p>
              <p className="mt-2 text-sm font-black uppercase tracking-[0.18em] text-[#7b6f5f]">
                Photo coming soon
              </p>
            </div>
          </div>
        )}

        <div className="absolute left-4 top-4 rounded-full bg-white px-4 py-2 text-xs font-black text-[#07101f] shadow-sm">
          Verified
        </div>

        <div className="absolute bottom-4 right-4 rounded-full bg-[#07101f] px-4 py-2 text-sm font-black text-white shadow-sm">
          {formatRent(listing.monthly_rent)}
        </div>
      </div>

      <div className="p-6">
        <h3 className="text-2xl font-black tracking-[-0.03em]">
          {listing.title}
        </h3>

        <p className="mt-2 font-bold text-[#63708a]">
          {[listing.city, listing.state].filter(Boolean).join(", ") ||
            "Location available soon"}
        </p>

        <div className="mt-5 flex flex-wrap gap-2 text-xs font-black text-[#53627a]">
          {beds && (
            <span className="rounded-full bg-[#f1eee8] px-3 py-2">{beds}</span>
          )}

          {baths && (
            <span className="rounded-full bg-[#f1eee8] px-3 py-2">
              {baths}
            </span>
          )}

          <span className="rounded-full bg-[#fff1bf] px-3 py-2 text-[#6b4c00]">
            Instant Apply
          </span>
        </div>
      </div>
    </Link>
  );
}

function TrustPill({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-[#d8cdbb] bg-white/85 px-4 py-3 text-sm font-black text-[#23314a] shadow-sm">
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
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f5c76a]">
        {number}
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

function ChecklistItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#f7f1e7] px-4 py-3">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#07101f] text-xs font-black text-[#f5c76a]">
        ✓
      </span>

      <span className="font-black">{text}</span>
    </div>
  );
}