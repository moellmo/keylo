"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type PropertyPhoto = {
  photo_url: string;
  sort_order: number | null;
};

type Property = {
  id: string;
  title: string;
  monthly_rent: number;
  bedrooms: string | number | null;
  bathrooms: string | number | null;
  street_address?: string | null;
  city: string;
  state: string;
  zip_code?: string | null;
  neighborhood?: string | null;
  available_date?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description: string | null;
  pet_policy: string | null;
  status: string;
  created_at: string;
  property_photos: PropertyPhoto[];
};

type ListingsClientProps = {
  listings: Property[];
};

type SortOption = "newest" | "rent_low" | "rent_high";
type ViewMode = "list" | "map";

type MapLocation = {
  listingId: string;
  lat: number;
  lng: number;
};

declare global {
  interface Window {
    google?: any;
    keyloGoogleMapsLoading?: Promise<void>;
  }
}

function getMainPhoto(listing: Property) {
  const photos = [...(listing.property_photos || [])].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
  );

  return photos[0]?.photo_url || null;
}

function normalizeValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function formatMoney(value: number) {
  return `$${value.toLocaleString()}/mo`;
}

function formatRoom(
  value: string | number | null | undefined,
  singular: string,
  plural: string
) {
  if (value === null || value === undefined || value === "") return `— ${plural}`;

  if (String(value).toLowerCase() === "studio") return "Studio";

  return `${value} ${String(value) === "1" ? singular : plural}`;
}

function formatDate(date: string | null | undefined) {
  if (!date) return "Availability not listed";

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return date;

  return `Available ${parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function petPolicyMatches(listingPolicy: string | null, selectedPolicy: string) {
  if (!selectedPolicy || selectedPolicy === "any") return true;

  return (listingPolicy || "").toLowerCase() === selectedPolicy.toLowerCase();
}

function getListingAddress(listing: Property) {
  return [
    listing.street_address,
    listing.neighborhood,
    listing.city,
    listing.state,
    listing.zip_code,
  ]
    .filter(Boolean)
    .join(", ");
}

function loadGoogleMaps() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return Promise.reject(new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY."));
  }

  if (window.google?.maps) {
    return Promise.resolve();
  }

  if (window.keyloGoogleMapsLoading) {
    return window.keyloGoogleMapsLoading;
  }

  window.keyloGoogleMapsLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");

    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;

    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google Maps."));

    document.head.appendChild(script);
  });

  return window.keyloGoogleMapsLoading;
}

export default function ListingsClient({ listings }: ListingsClientProps) {
  const [locationSearch, setLocationSearch] = useState("");
  const [minRent, setMinRent] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [petPolicy, setPetPolicy] = useState("");
  const [availableBy, setAvailableBy] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [mapError, setMapError] = useState("");
  const [mapLocations, setMapLocations] = useState<Record<string, MapLocation>>(
    {}
  );

  const mapRef = useRef<HTMLDivElement | null>(null);

  const filteredListings = useMemo(() => {
    const searchText = locationSearch.trim().toLowerCase();
    const minRentNumber = minRent ? Number(minRent) : null;
    const maxRentNumber = maxRent ? Number(maxRent) : null;

    const filtered = listings.filter((listing) => {
      const locationText = [
        listing.title,
        listing.city,
        listing.state,
        listing.zip_code,
        listing.neighborhood,
        listing.street_address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesLocation =
        !searchText || locationText.includes(searchText);

      const matchesMinRent =
        !minRentNumber || listing.monthly_rent >= minRentNumber;

      const matchesMaxRent =
        !maxRentNumber || listing.monthly_rent <= maxRentNumber;

      const listingBeds = normalizeValue(listing.bedrooms);
      const listingBaths = normalizeValue(listing.bathrooms);

      const matchesBeds =
        !beds ||
        beds === "any" ||
        listingBeds === beds ||
        (beds === "4+" && Number(listingBeds) >= 4);

      const matchesBaths =
        !baths ||
        baths === "any" ||
        Number(listingBaths) >= Number(baths.replace("+", ""));

      const matchesPetPolicy = petPolicyMatches(listing.pet_policy, petPolicy);

      const matchesAvailableBy =
        !availableBy ||
        !listing.available_date ||
        new Date(`${listing.available_date}T00:00:00`) <=
          new Date(`${availableBy}T00:00:00`);

      return (
        matchesLocation &&
        matchesMinRent &&
        matchesMaxRent &&
        matchesBeds &&
        matchesBaths &&
        matchesPetPolicy &&
        matchesAvailableBy
      );
    });

    return filtered.sort((a, b) => {
      if (sortBy === "rent_low") return a.monthly_rent - b.monthly_rent;
      if (sortBy === "rent_high") return b.monthly_rent - a.monthly_rent;

      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [
    listings,
    locationSearch,
    minRent,
    maxRent,
    beds,
    baths,
    petPolicy,
    availableBy,
    sortBy,
  ]);

  useEffect(() => {
    async function buildMap() {
      if (viewMode !== "map") return;
      if (!mapRef.current) return;

      setMapError("");

      try {
        await loadGoogleMaps();

        const google = window.google;

        if (!google?.maps) {
          setMapError("Google Maps is not available.");
          return;
        }

        const initialCenter = { lat: 40.8568, lng: -74.1285 };

        const map = new google.maps.Map(mapRef.current, {
          center: initialCenter,
          zoom: 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });

        const bounds = new google.maps.LatLngBounds();
let markerCount = 0;

for (const listing of filteredListings) {
  const rawLat = listing.latitude;
  const rawLng = listing.longitude;

  const lat =
    rawLat !== null && rawLat !== undefined ? Number(rawLat) : null;

  const lng =
    rawLng !== null && rawLng !== undefined ? Number(rawLng) : null;

  if (
    lat === null ||
    lng === null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    continue;
  }

  const position = { lat, lng };

  const marker = new google.maps.Marker({
    position,
    map,
    title: listing.title,
  });

  const infoWindow = new google.maps.InfoWindow({
    content: `
      <div style="max-width:220px">
        <strong>${listing.title}</strong>
        <div style="margin-top:6px">${formatMoney(listing.monthly_rent)}</div>
        <div style="margin-top:6px">${[listing.city, listing.state]
          .filter(Boolean)
          .join(", ")}</div>
        <a href="/listings/${listing.id}" style="display:inline-block;margin-top:10px;font-weight:700">
          View listing
        </a>
      </div>
    `,
  });

  marker.addListener("click", () => {
    infoWindow.open(map, marker);
  });

  bounds.extend(position);
  markerCount += 1;
}

if (markerCount > 0) {
  map.fitBounds(bounds);

  if (markerCount === 1) {
    map.setZoom(13);
  }
} else {
  setMapError(
    "No map-ready listings found yet. Add latitude/longitude to listings."
  );
}

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds);
        } else {
          setMapError(
            "No map-ready listings found yet. Add latitude/longitude or full addresses to listings."
          );
        }
      } catch (error) {
        setMapError(
          error instanceof Error ? error.message : "Map could not load."
        );
      }
    }

    buildMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, filteredListings]);

  function clearFilters() {
    setLocationSearch("");
    setMinRent("");
    setMaxRent("");
    setBeds("");
    setBaths("");
    setPetPolicy("");
    setAvailableBy("");
    setSortBy("newest");
  }

  const hasFilters =
    locationSearch ||
    minRent ||
    maxRent ||
    beds ||
    baths ||
    petPolicy ||
    availableBy ||
    sortBy !== "newest";

  return (
    <>
      <div className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-[#ded6c8] sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
          <div>
            <p className="text-sm font-black text-[#07101f]">
              Showing {filteredListings.length} of {listings.length}
            </p>
            <p className="mt-1 text-xs font-bold text-[#6f7b91]">
              Search and filter rentals
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMobileFiltersOpen((current) => !current)}
            className="rounded-full bg-[#07101f] px-5 py-3 text-sm font-black text-white"
          >
            {mobileFiltersOpen ? "Hide Filters" : "Filters"}
          </button>
        </div>

        <div
          className={`grid gap-3 lg:grid lg:grid-cols-12 ${
            mobileFiltersOpen ? "grid" : "hidden"
          }`}
        >
          <input
            value={locationSearch}
            onChange={(event) => setLocationSearch(event.target.value)}
            className="rounded-2xl border border-[#d6ccbc] bg-white px-4 py-3 font-bold text-[#07101f] outline-none transition placeholder:text-[#8b95a7] focus:border-[#07101f] lg:col-span-3"
            placeholder="City, state, ZIP, or neighborhood"
          />

          <input
            value={minRent}
            onChange={(event) => setMinRent(event.target.value)}
            type="number"
            className="rounded-2xl border border-[#d6ccbc] bg-white px-4 py-3 font-bold text-[#07101f] outline-none transition placeholder:text-[#8b95a7] focus:border-[#07101f] lg:col-span-2"
            placeholder="Min rent"
          />

          <input
            value={maxRent}
            onChange={(event) => setMaxRent(event.target.value)}
            type="number"
            className="rounded-2xl border border-[#d6ccbc] bg-white px-4 py-3 font-bold text-[#07101f] outline-none transition placeholder:text-[#8b95a7] focus:border-[#07101f] lg:col-span-2"
            placeholder="Max rent"
          />

          <select
            value={beds}
            onChange={(event) => setBeds(event.target.value)}
            className="rounded-2xl border border-[#d6ccbc] bg-white px-4 py-3 font-bold text-[#07101f] outline-none transition focus:border-[#07101f] lg:col-span-1"
          >
            <option value="">Beds</option>
            <option value="any">Any</option>
            <option value="Studio">Studio</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4+">4+</option>
          </select>

          <select
            value={baths}
            onChange={(event) => setBaths(event.target.value)}
            className="rounded-2xl border border-[#d6ccbc] bg-white px-4 py-3 font-bold text-[#07101f] outline-none transition focus:border-[#07101f] lg:col-span-1"
          >
            <option value="">Baths</option>
            <option value="any">Any</option>
            <option value="1">1+</option>
            <option value="1.5">1.5+</option>
            <option value="2">2+</option>
            <option value="2.5">2.5+</option>
            <option value="3+">3+</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
            className="rounded-2xl border border-[#d6ccbc] bg-white px-4 py-3 font-bold text-[#07101f] outline-none transition focus:border-[#07101f] lg:col-span-2"
          >
            <option value="newest">Newest</option>
            <option value="rent_low">Rent: Low to High</option>
            <option value="rent_high">Rent: High to Low</option>
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className="rounded-2xl border border-[#d6ccbc] bg-[#f7f1e7] px-4 py-3 font-black text-[#07101f] transition hover:bg-white lg:col-span-1"
          >
            Clear
          </button>
        </div>

        <div
          className={`mt-3 gap-3 md:grid-cols-3 lg:grid ${
            mobileFiltersOpen ? "grid" : "hidden"
          }`}
        >
          <select
            value={petPolicy}
            onChange={(event) => setPetPolicy(event.target.value)}
            className="rounded-2xl border border-[#d6ccbc] bg-white px-4 py-3 font-bold text-[#07101f] outline-none transition focus:border-[#07101f]"
          >
            <option value="">Pet policy</option>
            <option value="any">Any</option>
            <option value="Pet friendly">Pet friendly</option>
            <option value="Pets considered">Pets considered</option>
            <option value="No pets">No pets</option>
          </select>

          <label className="rounded-2xl border border-[#d6ccbc] bg-white px-4 py-2">
            <span className="block text-[11px] font-black uppercase tracking-[0.16em] text-[#7b6f5f]">
              Available by
            </span>

            <input
              value={availableBy}
              onChange={(event) => setAvailableBy(event.target.value)}
              type="date"
              className="mt-1 w-full bg-transparent font-bold text-[#07101f] outline-none"
            />
          </label>

          <div className="flex items-center justify-between rounded-2xl bg-[#f7f1e7] px-4 py-3 text-sm font-black text-[#6f7b91]">
            <span>
              Showing {filteredListings.length} of {listings.length}
            </span>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[#07101f] underline decoration-2 underline-offset-4"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-bold text-[#6f7b91]">
          {filteredListings.length === 0
            ? "No rentals match your filters."
            : `${filteredListings.length} rental${
                filteredListings.length === 1 ? "" : "s"
              } available`}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`rounded-full px-4 py-2 text-xs font-black ring-1 ${
              viewMode === "list"
                ? "bg-[#07101f] text-white ring-[#07101f]"
                : "bg-white text-[#6f7b91] ring-[#ded6c8]"
            }`}
          >
            List View
          </button>

          <button
            type="button"
            onClick={() => setViewMode("map")}
            className={`rounded-full px-4 py-2 text-xs font-black ring-1 ${
              viewMode === "map"
                ? "bg-[#07101f] text-white ring-[#07101f]"
                : "bg-white text-[#6f7b91] ring-[#ded6c8]"
            }`}
          >
            Map View
          </button>
        </div>
      </div>

      {viewMode === "map" ? (
        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-[#ded6c8]">
            <div ref={mapRef} className="h-[520px] w-full" />
          </div>

          <div className="grid max-h-[520px] gap-4 overflow-y-auto pr-1">
            {mapError && (
              <div className="rounded-3xl bg-red-50 p-5 font-bold text-red-700 ring-1 ring-red-200">
                {mapError}
              </div>
            )}

            {filteredListings.map((listing) => (
              <SmallListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </section>
      ) : filteredListings.length > 0 ? (
        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-[#ded6c8]">
          <h2 className="text-3xl font-black">No listings found</h2>

          <p className="mx-auto mt-3 max-w-xl text-lg leading-8 text-[#31415f]">
            Try changing your filters, increasing your rent range, or searching
            a nearby city.
          </p>

          <button
            type="button"
            onClick={clearFilters}
            className="mt-6 inline-flex rounded-full bg-[#07101f] px-6 py-3 font-black text-white"
          >
            Clear Filters
          </button>
        </div>
      )}
    </>
  );
}

function ListingCard({ listing }: { listing: Property }) {
  const firstPhoto = getMainPhoto(listing);

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-[#ded6c8] transition hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="relative h-60 overflow-hidden bg-[#e8ddca]">
        {firstPhoto ? (
          <img
            src={firstPhoto}
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
          {formatMoney(listing.monthly_rent)}
        </div>
      </div>

      <div className="p-6">
        <h2 className="text-2xl font-black tracking-[-0.03em]">
          {listing.title}
        </h2>

        <p className="mt-2 font-bold text-[#63708a]">
          {[listing.neighborhood, listing.city, listing.state]
            .filter(Boolean)
            .join(", ")}
        </p>

        <p className="mt-4 line-clamp-2 leading-7 text-[#31415f]">
          {listing.description || "No description added yet."}
        </p>

        <div className="mt-5 flex flex-wrap gap-2 text-xs font-black text-[#53627a]">
          <span className="rounded-full bg-[#f1eee8] px-3 py-2">
            {formatRoom(listing.bedrooms, "bed", "beds")}
          </span>

          <span className="rounded-full bg-[#f1eee8] px-3 py-2">
            {formatRoom(listing.bathrooms, "bath", "baths")}
          </span>

          <span className="rounded-full bg-[#f1eee8] px-3 py-2">
            {listing.pet_policy || "Pet policy not listed"}
          </span>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#eee6d8] pt-5">
          <p className="text-sm font-black text-[#6f7b91]">
            {formatDate(listing.available_date)}
          </p>

          <span className="rounded-full bg-[#fff1bf] px-3 py-2 text-xs font-black text-[#6b4c00]">
            View
          </span>
        </div>
      </div>
    </Link>
  );
}

function SmallListingCard({ listing }: { listing: Property }) {
  const firstPhoto = getMainPhoto(listing);

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#ded6c8]"
    >
      <div className="grid grid-cols-[110px_1fr]">
        <div className="h-full min-h-[130px] bg-[#e8ddca]">
          {firstPhoto ? (
            <img
              src={firstPhoto}
              alt={listing.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xl font-black text-[#07101f]">
              K
            </div>
          )}
        </div>

        <div className="p-4">
          <h3 className="font-black">{listing.title}</h3>

          <p className="mt-1 text-sm font-bold text-[#63708a]">
            {[listing.city, listing.state].filter(Boolean).join(", ")}
          </p>

          <p className="mt-2 text-sm font-black">
            {formatMoney(listing.monthly_rent)}
          </p>

          <p className="mt-2 text-xs font-bold text-[#6f7b91]">
            {formatRoom(listing.bedrooms, "bed", "beds")} ·{" "}
            {formatRoom(listing.bathrooms, "bath", "baths")}
          </p>
        </div>
      </div>
    </Link>
  );
}