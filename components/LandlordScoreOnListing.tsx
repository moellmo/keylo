"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import KeyloScoreCard from "@/components/KeyloScoreCard";

export default function LandlordScoreOnListing({
  landlordId,
}: {
  landlordId: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setSignedIn(!!user);
      setLoading(false);
    }

    checkUser();
  }, []);

  if (loading || !signedIn || !landlordId) {
    return null;
  }

  return (
    <div className="mt-4">
      <KeyloScoreCard userId={landlordId} role="landlord" />
    </div>
  );
}