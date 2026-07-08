"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const amenityOptions = [
  "Parking",
  "Laundry",
  "Central AC",
  "Updated kitchen",
  "Outdoor space",
  "Near transportation",
];

type Company = {
  id: string;
  name: string;
  owner_id: string;
};

type CompanyMembership = {
  company_id: string;
  role: string;
  landlord_companies:
    | Company
    | Company[]
    | null;
};

type VerificationRow = {
  landlord_id: string;
  verification_status: string;
};

function getCompanyFromMembership(membership: CompanyMembership | null) {
  if (!membership) return null;

  if (Array.isArray(membership.landlord_companies)) {
    return membership.landlord_companies[0] || null;
  }

  return membership.landlord_companies;
}

export default function NewListingPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [loadingVerification, setLoadingVerification] = useState(true);
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);

  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("incomplete");

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyRole, setCompanyRole] = useState("");

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
    description: "",
    pet_policy: "",
    amenities: [] as string[],
  });

  useEffect(() => {
    async function loadVerificationStatus() {
      setLoadingVerification(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Please log in as a landlord before posting a listing.");
        setLoadingVerification(false);
        return;
      }

      setUserId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        setMessage("Could not load your account.");
        setLoadingVerification(false);
        return;
      }

      setRole(profile.role);

      if (profile.role !== "landlord" && profile.role !== "admin") {
        setMessage("Only landlord accounts can post rental listings.");
        setLoadingVerification(false);
        return;
      }

      const { data: membershipRows, error: membershipError } = await supabase
        .from("landlord_company_members")
        .select(
          `
          company_id,
          role,
          landlord_companies (
            id,
            name,
            owner_id
          )
        `
        )
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1);

      if (membershipError) {
        setMessage(membershipError.message);
        setLoadingVerification(false);
        return;
      }

      const firstMembership =
        ((membershipRows || [])[0] as unknown as
          | CompanyMembership
          | undefined) || null;

      const company = getCompanyFromMembership(firstMembership);

      if (firstMembership && company) {
        setCompanyId(company.id);
        setCompanyName(company.name);
        setCompanyRole(firstMembership.role);
      } else {
        setCompanyId(null);
        setCompanyName("");
        setCompanyRole("");
      }

      if (profile.role === "admin" && !company) {
        setVerificationStatus("verified");
        setLoadingVerification(false);
        return;
      }

      const verificationUserIds = new Set<string>();
      verificationUserIds.add(user.id);

      if (company?.owner_id) {
        verificationUserIds.add(company.owner_id);
      }

      const { data: verificationRows, error: verificationError } =
        await supabase
          .from("landlord_verifications")
          .select("landlord_id, verification_status")
          .in("landlord_id", Array.from(verificationUserIds));

      if (verificationError) {
        setMessage(verificationError.message);
        setLoadingVerification(false);
        return;
      }

      const hasVerifiedUser = ((verificationRows || []) as VerificationRow[]).some(
        (row) => row.verification_status === "verified"
      );

      setVerificationStatus(hasVerifiedUser ? "verified" : "incomplete");
      setLoadingVerification(false);
    }

    loadVerificationStatus();
  }, []);

  function updateField(field: keyof typeof form, value: string | string[]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
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

  function formatStatus(status: string) {
    if (status === "pending_review") return "Pending Review";
    if (status === "incomplete") return "Incomplete";
    if (status === "verified") return "Verified";
    if (status === "rejected") return "Rejected";

    return status;
  }

  function canSubmitListing() {
    if (role === "admin" && !companyId) return true;

    return verificationStatus === "verified" && !!companyId;
  }

  async function saveListing() {
    setSaving(true);
    setMessage("");

    if (!form.title || !form.monthly_rent || !form.city || !form.state) {
      setMessage("Please fill in title, monthly rent, city, and state.");
      setSaving(false);
      return;
    }

    if (!userId) {
      setMessage("Please log in as a landlord before posting a listing.");
      setSaving(false);
      return;
    }

    if (role !== "landlord" && role !== "admin") {
      setMessage("Only landlord accounts can post rental listings.");
      setSaving(false);
      return;
    }

    if (role !== "admin" && !companyId) {
      setMessage("Please create your landlord company before submitting a listing.");
      setSaving(false);
      return;
    }

    if (companyId && verificationStatus !== "verified") {
      setMessage(
        "Company verification is required before submitting a listing for review."
      );
      setSaving(false);
      return;
    }

    if (role !== "admin" && verificationStatus !== "verified") {
      setMessage(
        "Landlord verification is required before submitting a listing for review."
      );
      setSaving(false);
      return;
    }

    const { data: newProperty, error } = await supabase
      .from("properties")
      .insert({
        landlord_id: userId,
        landlord_company_id: companyId,
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
        description: form.description,
        pet_policy: form.pet_policy,
        amenities: form.amenities,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      setMessage(
        `Error saving listing: ${error.message || JSON.stringify(error)}`
      );
      setSaving(false);
      return;
    }

    if (!newProperty) {
      setMessage("Listing was not created. Please try again.");
      setSaving(false);
      return;
    }

    if (photos.length > 0) {
      for (let index = 0; index < photos.length; index++) {
        const photo = photos[index];
        const fileExt = photo.name.split(".").pop();
        const safeExt = fileExt || "jpg";
        const filePath = `${newProperty.id}/${Date.now()}-${index}.${safeExt}`;

        const { error: uploadError } = await supabase.storage
          .from("property-photos")
          .upload(filePath, photo);

        if (uploadError) {
          setMessage(
            `Listing saved, but photo upload failed: ${uploadError.message}`
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
            property_id: newProperty.id,
            photo_url: publicUrlData.publicUrl,
            storage_path: filePath,
            sort_order: index,
          });

        if (photoRecordError) {
          setMessage(
            `Listing saved, but photo record failed: ${photoRecordError.message}`
          );
          setSaving(false);
          return;
        }
      }
    }

    setMessage("Listing submitted for review.");
    setSaving(false);

    router.push("/dashboard/landlord");
  }

  if (loadingVerification) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-black sm:text-3xl">
            Loading listing form...
          </h1>
        </div>
      </main>
    );
  }

  const verified = canSubmitListing();

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/dashboard/landlord"
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Landlord Dashboard
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="border-b border-slate-200 pb-6">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Landlord Dashboard
            </p>

            <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                  Post a Rental Listing
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                  Add the rental details tenants need before applying.
                </p>
              </div>

              <div className="grid gap-2">
                <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
                  Verification: {formatStatus(verificationStatus)}
                </span>

                {companyName && (
                  <span className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">
                    Company: {companyName}
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

          {role !== "admin" && !companyId && (
            <div className="mt-6 rounded-3xl bg-blue-50 p-6 ring-1 ring-blue-200">
              <h2 className="text-2xl font-black text-blue-900">
                Company Required
              </h2>

              <p className="mt-3 font-bold leading-7 text-blue-800">
                Create your landlord company before posting listings. Listings
                will be connected to your company so team members can help manage
                them later.
              </p>

              <Link
                href="/dashboard/landlord/company"
                className="mt-5 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
              >
                Create Company
              </Link>
            </div>
          )}

          {companyId && verificationStatus !== "verified" && (
            <div className="mt-6 rounded-3xl bg-amber-50 p-6 ring-1 ring-amber-200">
              <h2 className="text-2xl font-black text-amber-900">
                Verification Required
              </h2>

              <p className="mt-3 font-bold leading-7 text-amber-800">
                This company needs an approved landlord verification before
                submitting a listing for review. The company owner can upload ID,
                proof of ownership, tax bill, utility bill, or management
                agreement.
              </p>

              <Link
                href="/dashboard/landlord/verification"
                className="mt-5 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
              >
                Go to Verification
              </Link>
            </div>
          )}

          {role !== "admin" && !companyId && verificationStatus !== "verified" && (
            <div className="mt-6 rounded-3xl bg-amber-50 p-6 ring-1 ring-amber-200">
              <h2 className="text-2xl font-black text-amber-900">
                Verification Required
              </h2>

              <p className="mt-3 font-bold leading-7 text-amber-800">
                You need to complete landlord verification before submitting a
                listing for review. You can upload your ID, proof of ownership,
                tax bill, utility bill, or management agreement.
              </p>

              <Link
                href="/dashboard/landlord/verification"
                className="mt-5 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
              >
                Go to Verification
              </Link>
            </div>
          )}

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
                    placeholder="Example: Modern 3 Bedroom Home"
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
                    placeholder="2850"
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
                    value={form.street_address}
                    onChange={(e) =>
                      updateField("street_address", e.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                    placeholder="123 Main Street"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">City *</label>
                  <input
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                    placeholder="Monroe"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    State *
                  </label>
                  <input
                    value={form.state}
                    onChange={(e) => updateField("state", e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                    placeholder="NY"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    ZIP code
                  </label>
                  <input
                    value={form.zip_code}
                    onChange={(e) => updateField("zip_code", e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                    placeholder="10950"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    Neighborhood / Area
                  </label>
                  <input
                    value={form.neighborhood}
                    onChange={(e) =>
                      updateField("neighborhood", e.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
                    placeholder="Optional"
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
                    placeholder="Describe the rental, layout, parking, nearby shopping, schools, and any important details."
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

              <div className="mt-5 rounded-3xl border-2 border-dashed border-slate-300 bg-[#f7f4ef] p-5 text-center sm:p-8">
                <p className="text-lg font-black">Upload property photos</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Select one or more images. These will upload when you save the
                  listing.
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
                            Photo {index + 1}
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
                href="/dashboard/landlord"
                className="rounded-full border border-slate-300 bg-white px-6 py-3 text-center font-black"
              >
                Cancel
              </Link>

              {role !== "admin" && !companyId && (
                <Link
                  href="/dashboard/landlord/company"
                  className="rounded-full border border-blue-300 bg-blue-50 px-6 py-3 text-center font-black text-blue-900"
                >
                  Create Company
                </Link>
              )}

              {companyId && verificationStatus !== "verified" && (
                <Link
                  href="/dashboard/landlord/verification"
                  className="rounded-full border border-amber-300 bg-amber-50 px-6 py-3 text-center font-black text-amber-900"
                >
                  Complete Verification
                </Link>
              )}

              <button
                type="button"
                onClick={saveListing}
                disabled={saving || !verified}
                className="rounded-full bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-60"
              >
                {saving ? "Submitting..." : "Submit Listing for Review"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}