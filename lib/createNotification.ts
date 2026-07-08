import { supabase } from "@/lib/supabaseClient";

type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  type: string;
  targetUrl: string;
  dedupe?: boolean;
};

export async function createNotification({
  userId,
  title,
  message,
  type,
  targetUrl,
  dedupe = true,
}: CreateNotificationInput) {
  if (!userId || !title || !message || !type || !targetUrl) {
    return;
  }

  if (dedupe) {
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", type)
      .eq("target_url", targetUrl)
      .maybeSingle();

    if (existing?.id) {
      return;
    }
  }

  await supabase.from("notifications").insert({
    user_id: userId,
    title,
    message,
    type,
    target_url: targetUrl,
  });
}