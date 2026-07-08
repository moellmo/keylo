"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type LeaseFee = {
  id: string;
  lease_id: string;
  user_id: string;
  payer_role: "tenant" | "landlord";
  fee_type: string;
  amount_cents: number;
  currency: string;
  status: "unpaid" | "paid" | "waived" | "refunded";
  paid_at: string | null;
};

export default function LeaseFeeBox({
  leaseId,
  userId,
  payerRole,
  onStatusChange,
}: {
  leaseId: string;
  userId: string;
  payerRole: "tenant" | "landlord";
  onStatusChange: (paid: boolean) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [fee, setFee] = useState<LeaseFee | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadFee();
  }, [leaseId, userId, payerRole]);

  async function loadFee() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("lease_fees")
      .select("*")
      .eq("lease_id", leaseId)
      .eq("user_id", userId)
      .eq("payer_role", payerRole)
      .eq("fee_type", "esign_fee")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      setLoading(false);
      onStatusChange(false);
      return;
    }

    if (!data) {
      const { data: createdFee, error: createError } = await supabase
        .from("lease_fees")
        .insert({
          lease_id: leaseId,
          user_id: userId,
          payer_role: payerRole,
          fee_type: "esign_fee",
          amount_cents: 7500,
          currency: "usd",
          status: "unpaid",
        })
        .select("*")
        .single();

      if (createError) {
        setMessage(createError.message);
        setLoading(false);
        onStatusChange(false);
        return;
      }

      setFee(createdFee as LeaseFee);
      onStatusChange(false);
      setLoading(false);
      return;
    }

    const loadedFee = data as LeaseFee;
    setFee(loadedFee);
    onStatusChange(
      loadedFee.status === "paid" || loadedFee.status === "waived"
    );
    setLoading(false);
  }

  async function markPaidForTesting() {
    if (!fee) return;

    const confirmed = window.confirm(
      "For testing, mark this $75 e-sign fee as paid?"
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("lease_fees")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", fee.id)
      .select("*")
      .single();

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    const updatedFee = data as LeaseFee;
    setFee(updatedFee);
    onStatusChange(true);
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
        <p className="font-black">Loading e-sign fee...</p>
      </div>
    );
  }

  const isPaid = fee?.status === "paid" || fee?.status === "waived";

  return (
    <div
      className={`rounded-3xl p-6 ring-1 ${
        isPaid
          ? "bg-green-50 ring-green-200"
          : "bg-amber-50 ring-amber-200"
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            {payerRole === "tenant" ? "Tenant" : "Landlord"} E-Sign Fee
          </p>

          <h3 className="mt-2 text-3xl font-black">$75</h3>

          <p className="mt-2 font-bold text-slate-700">
            Status:{" "}
            <span className={isPaid ? "text-green-700" : "text-amber-700"}>
              {fee?.status || "unpaid"}
            </span>
          </p>

          {!isPaid && (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This fee must be paid before this party can electronically sign
              the lease.
            </p>
          )}

          {message && (
            <p className="mt-3 text-sm font-bold text-red-700">{message}</p>
          )}
        </div>

        {!isPaid && (
          <button
            type="button"
            onClick={markPaidForTesting}
            disabled={saving}
            className="rounded-full bg-slate-950 px-5 py-3 font-black text-white disabled:opacity-60"
          >
            {saving ? "Updating..." : "Mark Paid for Testing"}
          </button>
        )}
      </div>
    </div>
  );
}