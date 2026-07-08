"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type RatingFormProps = {
  leaseId: string;
  reviewerId: string;
  revieweeId: string;
  reviewerRole: "tenant" | "landlord";
  revieweeRole: "tenant" | "landlord";
  onSaved?: () => void;
};

function ratingOptions() {
  return [5, 4, 3, 2, 1];
}

export default function RatingForm({
  leaseId,
  reviewerId,
  revieweeId,
  reviewerRole,
  revieweeRole,
  onSaved,
}: RatingFormProps) {
  const [overallRating, setOverallRating] = useState("5");
  const [communicationRating, setCommunicationRating] = useState("5");
  const [paymentOrRentRating, setPaymentOrRentRating] = useState("5");
  const [propertyCareRating, setPropertyCareRating] = useState("5");
  const [maintenanceRating, setMaintenanceRating] = useState("5");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const isTenantReviewingLandlord =
    reviewerRole === "tenant" && revieweeRole === "landlord";

  async function submitRating() {
    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("ratings").upsert(
      {
        lease_id: leaseId,
        reviewer_id: reviewerId,
        reviewee_id: revieweeId,
        reviewer_role: reviewerRole,
        reviewee_role: revieweeRole,
        overall_rating: Number(overallRating),
        communication_rating: Number(communicationRating),
        payment_or_rent_rating: isTenantReviewingLandlord
          ? null
          : Number(paymentOrRentRating),
        property_care_rating: isTenantReviewingLandlord
          ? null
          : Number(propertyCareRating),
        maintenance_rating: isTenantReviewingLandlord
          ? Number(maintenanceRating)
          : null,
        comment: comment.trim() || null,
        is_public: false,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "lease_id,reviewer_id,reviewee_id",
      }
    );

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setMessage("Rating saved successfully.");
    setSaving(false);

    if (onSaved) {
      onSaved();
    }
  }

  return (
    <div className="rounded-3xl bg-[#f7f4ef] p-6">
      <h3 className="text-2xl font-black">
        {isTenantReviewingLandlord ? "Rate Landlord" : "Rate Tenant"}
      </h3>

      <p className="mt-2 leading-7 text-slate-600">
        This helps build trust on Keylo. Ratings are private for now and can be
        used later for Keylo Score.
      </p>

      {message && (
        <div className="mt-5 rounded-2xl bg-white px-5 py-4 font-bold text-slate-700 ring-1 ring-slate-200">
          {message}
        </div>
      )}

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <RatingSelect
          label="Overall Rating"
          value={overallRating}
          onChange={setOverallRating}
        />

        <RatingSelect
          label="Communication"
          value={communicationRating}
          onChange={setCommunicationRating}
        />

        {isTenantReviewingLandlord ? (
          <RatingSelect
            label="Maintenance / Responsiveness"
            value={maintenanceRating}
            onChange={setMaintenanceRating}
          />
        ) : (
          <>
            <RatingSelect
              label="Payment / Rent Reliability"
              value={paymentOrRentRating}
              onChange={setPaymentOrRentRating}
            />

            <RatingSelect
              label="Property Care"
              value={propertyCareRating}
              onChange={setPropertyCareRating}
            />
          </>
        )}
      </div>

      <div className="mt-5">
        <label className="text-sm font-black text-slate-700">
          Comment optional
        </label>

        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={4}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-slate-950"
          placeholder={
            isTenantReviewingLandlord
              ? "Share your experience with the landlord..."
              : "Share your experience with the tenant..."
          }
        />
      </div>

      <button
        type="button"
        onClick={submitRating}
        disabled={saving}
        className="mt-6 rounded-full bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save Rating"}
      </button>
    </div>
  );
}

function RatingSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-black text-slate-700">{label}</label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-black outline-none focus:border-slate-950"
      >
        {ratingOptions().map((rating) => (
          <option key={rating} value={rating}>
            {rating} star{rating === 1 ? "" : "s"}
          </option>
        ))}
      </select>
    </div>
  );
}