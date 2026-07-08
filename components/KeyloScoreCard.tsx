"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Role = "tenant" | "landlord";

type RatingRow = {
  overall_rating: number;
  communication_rating: number | null;
  payment_or_rent_rating: number | null;
  property_care_rating: number | null;
  maintenance_rating: number | null;
};

type KeyloScoreCardProps = {
  userId: string;
  role: Role;
};

function average(values: (number | null)[]) {
  const cleanValues = values.filter(
    (value): value is number => value !== null && value !== undefined
  );

  if (cleanValues.length === 0) return null;

  const total = cleanValues.reduce((sum, value) => sum + value, 0);
  return Number((total / cleanValues.length).toFixed(2));
}

function scoreLabel(score: number | null) {
  if (score === null) return "No score yet";
  if (score >= 4.5) return "Excellent";
  if (score >= 4) return "Very Good";
  if (score >= 3) return "Good";
  if (score >= 2) return "Needs Improvement";
  return "Poor";
}

function formatScore(score: number | null) {
  if (score === null) return "—";
  return score.toFixed(1);
}

export default function KeyloScoreCard({ userId, role }: KeyloScoreCardProps) {
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<RatingRow[]>([]);

  useEffect(() => {
    async function loadRatings() {
      setLoading(true);

      const { data } = await supabase
        .from("ratings")
        .select(
          `
          overall_rating,
          communication_rating,
          payment_or_rent_rating,
          property_care_rating,
          maintenance_rating
        `
        )
        .eq("reviewee_id", userId)
        .eq("reviewee_role", role);

      setRatings((data || []) as RatingRow[]);
      setLoading(false);
    }

    if (userId && role) {
      loadRatings();
    }
  }, [userId, role]);

  const overallScore = average(ratings.map((rating) => rating.overall_rating));
  const communicationScore = average(
    ratings.map((rating) => rating.communication_rating)
  );
  const paymentOrRentScore = average(
    ratings.map((rating) => rating.payment_or_rent_rating)
  );
  const propertyCareScore = average(
    ratings.map((rating) => rating.property_care_rating)
  );
  const maintenanceScore = average(
    ratings.map((rating) => rating.maintenance_rating)
  );

  const isTenant = role === "tenant";

  return (
    <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Keylo Score
          </p>

          <h2 className="mt-3 text-3xl font-black">
            {loading ? "Loading..." : scoreLabel(overallScore)}
          </h2>

          <p className="mt-2 leading-7 text-slate-600">
            {isTenant
              ? "Your tenant score is based on landlord ratings after completed leases."
              : "Your landlord score is based on tenant ratings after completed leases."}
          </p>
        </div>

        <div className="rounded-3xl bg-[#f7f4ef] px-7 py-5 text-center">
          <p className="text-5xl font-black">{formatScore(overallScore)}</p>
          <p className="mt-1 text-sm font-black text-slate-500">
            {ratings.length} rating{ratings.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <ScoreMiniCard label="Communication" score={communicationScore} />

        {isTenant ? (
          <>
            <ScoreMiniCard
              label="Payment / Rent Reliability"
              score={paymentOrRentScore}
            />
            <ScoreMiniCard label="Property Care" score={propertyCareScore} />
          </>
        ) : (
          <ScoreMiniCard
            label="Maintenance / Responsiveness"
            score={maintenanceScore}
          />
        )}
      </div>

      {ratings.length === 0 && !loading && (
        <div className="mt-6 rounded-3xl bg-[#f7f4ef] p-5">
          <p className="font-bold text-slate-600">
            No ratings yet. Ratings will appear after completed leases.
          </p>
        </div>
      )}
    </div>
  );
}

function ScoreMiniCard({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  return (
    <div className="rounded-3xl bg-[#f7f4ef] p-5">
      <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black">{formatScore(score)}</p>
    </div>
  );
}