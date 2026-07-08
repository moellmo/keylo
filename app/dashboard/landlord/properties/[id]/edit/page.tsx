"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createNotification } from "@/lib/createNotification";

const amenityOptions = [
  "Parking",
  "Laundry",
  "Central AC",
  "Updated kitchen",
  "Outdoor space",
  "Near transportation",
];

type CompanyRole =
  | "owner"
  | "admin"
  | "manager"
  | "maintenance"
  | "accounting"
  | "viewer"
  | "";

type PropertyPhoto = {
  id: string;
  photo_url: string;
  storage_path: string;
  sort_order: number | null;
};

type AdminProfile = {
  id: string;
};

type PropertyRow = {
  id: string;
  landlord_id: string;
  landlord_company_id: string | null;
  title: string | null;
  monthly_rent: number | null;
  available_date: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  neighborhood: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  description: string | null;
  pet_policy: string | null;
  amenities: string[] | null;
  status: string | null;
  property_photos: PropertyPhoto[] | null;
};

type CompanyMembership = {
  company_id: string;
  role: CompanyRole;
};

declare global {
  interface Window {
    google?: any;
    keyloGoogleMapsLoading?: Promise<void>;
  }
}

function canEditCompanyListing(role: CompanyRole) {
  return role === "owner" || role === "admin" || role === "manager";
}

async function loadGoogleMaps() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.");
  }

  if (window.google?.maps?.places) {
    return;
  }

  if (window.google?.maps?.importLibrary) {
    await window.google.maps.importLibrary("places");
    return;
  }

  if (window.keyloGoogleMapsLoading) {
    await window.keyloGoogleMapsLoading;

    if (window.google?.maps?.places) {
      return;
    }

    if (window.google?.maps?.importLibrary) {
      await window.google.maps.importLibrary("places");
      return;
    }
  }

  window.keyloGoogleMapsLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");

    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google Maps."));

    document.head.appendChild(script);
  });

  await window.keyloGoogleMapsLoading;

  if (window.google?.maps?.importLibrary && !window.google?.maps?.places) {
    await window.google.maps.importLibrary("places");
  }
}

function getAddressComponent(place: any, type: string, shortName = false) {
  const component = place.address_components?.find((item: any) =>
    item.types?.includes(type)
  );

  if (!component) return "";

  return shortName ? component.short_name || "" : component.long_name || "";
}

async function geocodeTypedAddress(form: {
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
}) {
  const address = [
    form.street_address,
    form.city,
    form.state,
    form.zip_code,
  ]
    .filter(Boolean)
    .join(", ");

  if (!address) {
    return { latitude: null, longitude: null };
  }

  try {
    await loadGoogleMaps();

    const google = window.google;

    if (!google?.maps) {
      return { latitude: null, longitude: null };
    }

    const geocoder = new google.maps.Geocoder();
    const result = await geocoder.geocode({ address });
    const location = result.results?.[0]?.geometry?.location;

    if (!location) {
      return { latitude: null, longitude: null };
    }

    return {
      latitude: location.lat(),
      longitude: location.lng(),
    };
  } catch {
    return { latitude: null, longitude: null };
  }
}

function getCoordinate(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return null;

  return numberValue;
}

export default function EditListingPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params.id as string;
  const addressInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<PropertyPhoto[]>([]);
  const [originalStatus, setOriginalStatus] = useState("draft");
  const [companyRole, setCompanyRole] = useState<CompanyRole>("");
  const [landlordCompanyId, setLandlordCompanyId] = useState<string | null>(
    null
  );
  const [addressHelper, setAddressHelper] = useState(
    "Start typing and select an address from Google, or type it manually."
  );

  const [form, setForm] = useState({
    title: "",
    monthly_rent: "",
    available_date: "",
    bedrooms: "",
    bathrooms: "",
    street_address: "",
    city: "",
    state: "",
    zip_code: "",
    neighborhood: "",
    latitude: null as number | null,
    longitude: null as number | null,
    description: "",
    pet_policy: "",
    amenities: [] as string[],
    status: "draft",
  });

  useEffect(() => {
    loadListing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  useEffect(() => {
    if (loading || !allowed) return;

    let autocomplete: any = null;
    let listener: any = null;

    async function setupAutocomplete() {
      if (!addressInputRef.current) return;

      try {
        await loadGoogleMaps();

        const google = window.google;

        if (!google?.maps?.places || !addressInputRef.current) {
          setAddressHelper(
            "Google address autocomplete is not available. You can still type the address manually."
          );
          return;
        }

        autocomplete = new google.maps.places.Autocomplete(
          addressInputRef.current,
          {
            types: ["address"],
            fields: ["address_components", "formatted_address", "geometry"],
          }
        );

        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();

          if (!place?.geometry?.location) {
            setAddressHelper(
              "Please select an address from the dropdown, or type it manually and Keylo will try to map it when you save."
            );
            return;
          }

          const streetNumber = getAddressComponent(place, "street_number");
          const route = getAddressComponent(place, "route");

          const city =
            getAddressComponent(place, "locality") ||
            getAddressComponent(place, "postal_town") ||
            getAddressComponent(place, "sublocality") ||
            getAddressComponent(place, "administrative_area_level_2");

          const state = getAddressComponent(
            place,
            "administrative_area_level_1",
            true
          );

          const zipCode = getAddressComponent(place, "postal_code");

          const neighborhood =
            getAddressComponent(place, "neighborhood") ||
            getAddressComponent(place, "sublocality") ||
            "";

          const latitude = place.geometry.location.lat();
          const longitude = place.geometry.location.lng();

          setForm((current) => ({
            ...current,
            street_address:
              [streetNumber, route].filter(Boolean).join(" ") ||
              place.formatted_address ||
              current.street_address,
            city: city || current.city,
            state: state || current.state,
            zip_code: zipCode || current.zip_code,
            neighborhood: neighborhood || current.neighborhood,
            latitude,
            longitude,
          }));

          setAddressHelper(
            "Address selected. Map location will be saved automatically."
          );
        });
      } catch (error) {
        setAddressHelper(
          error instanceof Error
            ? `${error.message} You can still type the address manually.`
            : "Google address autocomplete could not load. You can still type the address manually."
        );
      }
    }

    setupAutocomplete();

    return () => {
      if (listener?.remove) {
        listener.remove();
      }
    };
  }, [loading, allowed]);

  async function loadListing() {
    setLoading(true);
    setAllowed(false);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please log in as a landlord to edit this listing.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      setMessage("Could not load your account.");
      setLoading(false);
      return;
    }

    if (profile.role !== "landlord" && profile.role !== "admin") {
      setMessage("Only landlord accounts can edit rental listings.");
      setLoading(false);
      return;
    }

    const { data: propertyData, error } = await supabase
      .from("properties")
      .select(
        `
        *,
        property_photos (
          id,
          photo_url,
          storage_path,
          sort_order
        )
      `
      )
      .eq("id", propertyId)
      .single();

    if (error || !propertyData) {
      setMessage("Listing not found.");
      setLoading(false);
      return;
    }

    const property = propertyData as unknown as PropertyRow;

    const isAdmin = profile.role === "admin";
    const isOriginalLandlord = property.landlord_id === user.id;

    let isCompanyEditor = false;
    let currentCompanyRole: CompanyRole = "";

    if (!isAdmin && !isOriginalLandlord && property.landlord_company_id) {
      const { data: membership, error: membershipError } = await supabase
        .from("landlord_company_members")
        .select("company_id, role")
        .eq("company_id", property.landlord_company_id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (membershipError) {
        setMessage(membershipError.message);
        setLoading(false);
        return;
      }

      const companyMembership = membership as CompanyMembership | null;

      currentCompanyRole = companyMembership?.role || "";
      isCompanyEditor =
        !!companyMembership && canEditCompanyListing(companyMembership.role);
    }

    if (!isAdmin && !isOriginalLandlord && !isCompanyEditor) {
      setMessage("You do not have permission to edit this listing.");
      setLoading(false);
      return;
    }

    const propertyStatus = property.status || "draft";
    const latitude = getCoordinate(property.latitude);
    const longitude = getCoordinate(property.longitude);

    setForm({
      title: property.title || "",
      monthly_rent: property.monthly_rent ? String(property.monthly_rent) : "",
      available_date: property.available_date || "",
      bedrooms: property.bedrooms || "",
      bathrooms: property.bathrooms || "",
      street_address: property.street_address || "",
      city: property.city || "",
      state: property.state || "",
      zip_code: property.zip_code || "",
      neighborhood: property.neighborhood || "",
      latitude,
      longitude,
      description: property.description || "",
      pet_policy: property.pet_policy || "",
      amenities: property.amenities || [],
      status: propertyStatus,
    });

    if (latitude !== null && longitude !== null) {
      setAddressHelper("This listing already has a saved map location.");
    } else {
      setAddressHelper(
        "Start typing and select an address from Google, or type it manually."
      );
    }

    setOriginalStatus(propertyStatus);
    setCompanyRole(currentCompanyRole);
    setLandlordCompanyId(property.landlord_company_id || null);

    const sortedPhotos = [...(property.property_photos || [])].sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
    );

    setExistingPhotos(sortedPhotos);
    setAllowed(true);
    setLoading(false);
  }

  function updateField(
    field: keyof typeof form,
    value: string | string[] | number | null
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateAddressField(field: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
      latitude: null,
      longitude: null,
    }));

    setAddressHelper(
      "Address entered manually. Keylo will try to map it when you save."
    );
  }

  function toggleAmenity(amenity: string) {
    const exists = form.amenities.includes(amenity);

    if (exists) {
      updateField(
        "amenities",
        form.amenities.filter((item) => item !== amenity)
      );
    } else {
      updateField("amenities", [...form.amenities, amenity]);
    }
  }

  async function notifyAdminsListingPending() {
    const { data: admins, error: adminError } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if (adminError || !admins || admins.length === 0) {
      return;
    }

    for (const admin of admins as AdminProfile[]) {
      await createNotification({
        userId: admin.id,
        title: "Listing pending review",
        message: `A landlord submitted "${
          form.title || "a listing"
        }" for approval.`,
        type: "admin_listing_pending",
        targetUrl: `/admin/listings/${propertyId}/preview`,
        dedupe: true,
      });
    }
  }

  async function deletePhoto(photo: PropertyPhoto) {
    const confirmDelete = window.confirm("Delete this photo?");
    if (!confirmDelete) return;

    setMessage("");

    const { error: storageError } = await supabase.storage
      .from("property-photos")
      .remove([photo.storage_path]);

    if (storageError) {
      setMessage(`Could not delete photo file: ${storageError.message}`);
      return;
    }

    const { error: dbError } = await supabase
      .from("property_photos")
      .delete()
      .eq("id", photo.id);

    if (dbError) {
      setMessage(`Could not delete photo record: ${dbError.message}`);
      return;
    }

    setExistingPhotos((current) =>
      current.filter((item) => item.id !== photo.id)
    );
  }

  async function saveListing() {
    setSaving(true);
    setMessage("");

    if (!form.title || !form.monthly_rent || !form.city || !form.state) {
      setMessage("Please fill in title, monthly rent, city, and state.");
      setSaving(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please log in as a landlord before editing this listing.");
      setSaving(false);
      return;
    }

    let latitudeToSave = form.latitude;
    let longitudeToSave = form.longitude;

    if (latitudeToSave === null || longitudeToSave === null) {
      const geocoded = await geocodeTypedAddress({
        street_address: form.street_address,
        city: form.city,
        state: form.state,
        zip_code: form.zip_code,
      });

      latitudeToSave = geocoded.latitude;
      longitudeToSave = geocoded.longitude;
    }

    const { error } = await supabase
      .from("properties")
      .update({
        title: form.title,
        monthly_rent: Number(form.monthly_rent),
        available_date: form.available_date || null,
        bedrooms: form.bedrooms,
        bathrooms: form.bathrooms,
        street_address: form.street_address,
        city: form.city,
        state: form.state,
        zip_code: form.zip_code,
        neighborhood: form.neighborhood,
        latitude: latitudeToSave,
        longitude: longitudeToSave,
        description: form.description,
        pet_policy: form.pet_policy,
        amenities: form.amenities,
        status: form.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", propertyId);

    if (error) {
      setMessage(`Error updating listing: ${error.message}`);
      setSaving(false);
      return;
    }

    if (photos.length > 0) {
      const startingSortOrder = existingPhotos.length;

      for (let index = 0; index < photos.length; index++) {
        const photo = photos[index];
        const fileExt = photo.name.split(".").pop();
        const safeExt = fileExt || "jpg";
        const filePath = `${propertyId}/${Date.now()}-${index}.${safeExt}`;

        const { error: uploadError } = await supabase.storage
          .from("property-photos")
          .upload(filePath, photo);

        if (uploadError) {
          setMessage(
            `Listing updated, but photo upload failed: ${uploadError.message}`
          );
          setSaving(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("property-photos")
          .getPublicUrl(filePath);

        const { error: photoRecordError } = await supabase
          .from("property_photos")
          .insert({
            property_id: propertyId,
            photo_url: publicUrlData.publicUrl,
            storage_path: filePath,
            sort_order: startingSortOrder + index,
          });

        if (photoRecordError) {
          setMessage(
            `Listing updated, but photo record failed: ${photoRecordError.message}`
          );
          setSaving(false);
          return;
        }
      }
    }

    if (form.status === "pending" && originalStatus !== "pending") {
      await notifyAdminsListingPending();
    }

    setOriginalStatus(form.status);
    setSaving(false);
    router.push("/dashboard/landlord/properties");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading listing...</h1>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Listing unavailable</h1>

          <p className="mt-3 text-slate-600">{message}</p>

          <Link
            href="/dashboard/landlord/properties"
            className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
          >
            Back to Listings
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/dashboard/landlord/properties"
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Listings
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 pb-6">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Landlord Dashboard
            </p>

            <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                  Edit Rental Listing
                </h1>

                <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                  Update the rental details, status, amenities, and photos.
                </p>
              </div>

              <div className="grid gap-2">
                {landlordCompanyId && (
                  <span className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">
                    Company Listing
                  </span>
                )}

                {companyRole && (
                  <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black capitalize text-slate-700">
                    Role: {companyRole}
                  </span>
                )}
              </div>
            </div>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl bg-slate-100 px-5 py-4 font-bold text-slate-800">
              {message}
            </div>
          )}

          <form className="mt-8 space-y-8">
            <section>
              <h2 className="text-2xl font-black">Property basics</h2>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-black">
                    Listing title *
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    Monthly rent *
                  </label>
                  <input
                    value={form.monthly_rent}
                    onChange={(e) =>
                      updateField("monthly_rent", e.target.value)
                    }
                    type="number"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    Available date
                  </label>
                  <input
                    value={form.available_date}
                    onChange={(e) =>
                      updateField("available_date", e.target.value)
                    }
                    type="date"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    Bedrooms
                  </label>
                  <select
                    value={form.bedrooms}
                    onChange={(e) => updateField("bedrooms", e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                  >
                    <option value="">Select bedrooms</option>
                    <option value="Studio">Studio</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4+">4+</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    Bathrooms
                  </label>
                  <select
                    value={form.bathrooms}
                    onChange={(e) => updateField("bathrooms", e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                  >
                    <option value="">Select bathrooms</option>
                    <option value="1">1</option>
                    <option value="1.5">1.5</option>
                    <option value="2">2</option>
                    <option value="2.5">2.5</option>
                    <option value="3+">3+</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => updateField("status", e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="pending">Pending Review</option>
                    <option value="paused">Paused</option>
                    <option value="archived">Archived</option>
                    <option value="rejected">Rejected</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-black">Location</h2>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-black">
                    Street address
                  </label>
                  <input
                    ref={addressInputRef}
                    value={form.street_address}
                    onChange={(e) =>
                      updateAddressField("street_address", e.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                    placeholder="Start typing an address..."
                  />

                  <p
                    className={`mt-2 text-sm font-bold ${
                      form.latitude && form.longitude
                        ? "text-green-700"
                        : "text-slate-500"
                    }`}
                  >
                    {addressHelper}
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    City *
                  </label>
                  <input
                    value={form.city}
                    onChange={(e) => updateAddressField("city", e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    State *
                  </label>
                  <input
                    value={form.state}
                    onChange={(e) =>
                      updateAddressField("state", e.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    ZIP code
                  </label>
                  <input
                    value={form.zip_code}
                    onChange={(e) =>
                      updateAddressField("zip_code", e.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    Neighborhood / Area
                  </label>
                  <input
                    value={form.neighborhood}
                    onChange={(e) =>
                      updateAddressField("neighborhood", e.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-black">Listing details</h2>

              <div className="mt-5 grid gap-5">
                <div>
                  <label className="mb-2 block text-sm font-black">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      updateField("description", e.target.value)
                    }
                    rows={6}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    Pet policy
                  </label>
                  <select
                    value={form.pet_policy}
                    onChange={(e) => updateField("pet_policy", e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                  >
                    <option value="">Select pet policy</option>
                    <option value="Pet friendly">Pet friendly</option>
                    <option value="Pets considered">Pets considered</option>
                    <option value="No pets">No pets</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    Amenities
                  </label>

                  <div className="grid gap-3 md:grid-cols-3">
                    {amenityOptions.map((amenity) => (
                      <label
                        key={amenity}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 font-bold"
                      >
                        <input
                          type="checkbox"
                          checked={form.amenities.includes(amenity)}
                          onChange={() => toggleAmenity(amenity)}
                        />
                        {amenity}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-black">Photos</h2>

              {existingPhotos.length > 0 && (
                <div className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {existingPhotos.map((photo, index) => (
                    <div
                      key={photo.id}
                      className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.photo_url}
                        alt={`Property photo ${index + 1}`}
                        className="h-36 w-full object-cover"
                      />

                      <div className="p-3">
                        <p className="text-sm font-black">
                          Current photo {index + 1}
                        </p>

                        <button
                          type="button"
                          onClick={() => deletePhoto(photo)}
                          className="mt-3 rounded-full border border-slate-300 px-4 py-2 text-xs font-black"
                        >
                          Delete Photo
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 rounded-3xl border-2 border-dashed border-slate-300 bg-[#f7f4ef] p-8 text-center">
                <p className="text-lg font-black">Add more property photos</p>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  New photos will upload when you save the listing.
                </p>

                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    const selectedFiles = Array.from(e.target.files || []);
                    setPhotos(selectedFiles);
                  }}
                  className="mt-5 max-w-full rounded-2xl bg-white p-3 text-sm font-bold"
                />

                {photos.length > 0 && (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {photos.map((photo, index) => (
                      <div
                        key={`${photo.name}-${index}`}
                        className="overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-slate-200"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Selected property photo ${index + 1}`}
                          className="h-36 w-full object-cover"
                        />

                        <div className="p-3">
                          <p className="truncate text-sm font-black">
                            {photo.name}
                          </p>

                          <p className="mt-1 text-xs font-bold text-slate-500">
                            New photo {index + 1}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
              <Link
                href="/dashboard/landlord/properties"
                className="rounded-full border border-slate-300 bg-white px-6 py-3 text-center font-black"
              >
                Cancel
              </Link>

              <button
                type="button"
                onClick={saveListing}
                disabled={saving}
                className="rounded-full bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}