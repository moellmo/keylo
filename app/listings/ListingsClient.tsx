"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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

type ListingsClientProps = {
  listings: Property[];
};

export default function ListingsClient({ listings }: ListingsClientProps) {
  const [locationSearch, setLocationSearch] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [beds, setBeds] = useState("");

  const [appliedLocationSearch, setAppliedLocationSearch] = useState("");
  const [appliedMaxRent, setAppliedMaxRent] = useState("");
  const [appliedBeds, setAppliedBeds] = useState("");

  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      const locationText = `${listing.city} ${listing.state}`.toLowerCase();
      const searchText = appliedLocationSearch.trim().toLowerCase();

      const matchesLocation =
        !searchText || locationText.includes(searchText);

      const maxRentNumber = appliedMaxRent ? Number(appliedMaxRent) : null;
      const matchesRent =
        !maxRentNumber || listing.monthly_rent <= maxRentNumber;

      const matchesBeds =
        !appliedBeds ||
        appliedBeds === "any" ||
        listing.bedrooms === appliedBeds;

      return matchesLocation && matchesRent && matchesBeds;
    });
  }, [listings, appliedLocationSearch, appliedMaxRent, appliedBeds]);

  function runSearch() {
    setAppliedLocationSearch(locationSearch);
    setAppliedMaxRent(maxRent);
    setAppliedBeds(beds);
  }

  function clearFilters() {
    setLocationSearch("");
    setMaxRent("");
    setBeds("");
    setAppliedLocationSearch("");
    setAppliedMaxRent("");
    setAppliedBeds("");
  }

  return (
    <>
      <div className="mt-8 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-3 md:grid-cols-6">
          <input
            value={locationSearch}
            onChange={(e) => setLocationSearch(e.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none md:col-span-2"
            placeholder="City or state"
          />

          <input
            value={maxRent}
            onChange={(e) => setMaxRent(e.target.value)}
            type="number"
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none"
            placeholder="Max rent"
          />

          <select
            value={beds}
            onChange={(e) => setBeds(e.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none"
          >
            <option value="">Beds</option>
            <option value="any">Any</option>
            <option value="Studio">Studio</option>
            <option value="1">1 bed</option>
            <option value="2">2 beds</option>
            <option value="3">3 beds</option>
            <option value="4+">4+ beds</option>
          </select>

          <button
            type="button"
            onClick={runSearch}
            className="rounded-2xl bg-slate-950 px-4 py-3 font-black text-white"
          >
            Search
          </button>

          <button
            type="button"
            onClick={clearFilters}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 font-black text-slate-950"
          >
            Clear
          </button>
        </div>

        <p className="mt-4 text-sm font-bold text-slate-500">
          Showing {filteredListings.length} of {listings.length} published
          rental{listings.length === 1 ? "" : "s"}.
        </p>
      </div>

      {filteredListings.length > 0 ? (
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {filteredListings.map((listing) => {
            const firstPhoto = [...(listing.property_photos || [])].sort(
              (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
            )[0];

            return (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}`}
                className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg"
              >
                {firstPhoto ? (
                  <img
                    src={firstPhoto.photo_url}
                    alt={listing.title}
                    className="h-48 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100">
                    <p className="text-sm font-black text-slate-400">
                      No photo yet
                    </p>
                  </div>
                )}

                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-black">{listing.title}</h2>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        {listing.city}, {listing.state}
                      </p>
                    </div>

                    <p className="shrink-0 font-black">
                      ${listing.monthly_rent.toLocaleString()}/mo
                    </p>
                  </div>

                  <p className="mt-4 line-clamp-3 leading-7 text-slate-600">
                    {listing.description || "No description added yet."}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      {listing.bedrooms || "—"} beds
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      {listing.bathrooms || "—"} baths
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      {listing.pet_policy || "Pet policy not listed"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h2 className="text-2xl font-black">No listings found</h2>
          <p className="mt-3 text-slate-600">
            Try changing your filters or check back later.
          </p>

          <button
            type="button"
            onClick={clearFilters}
            className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
          >
            Clear Filters
          </button>
        </div>
      )}
    </>
  );
}