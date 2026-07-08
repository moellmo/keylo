import { supabase } from "@/lib/supabaseClient";

type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  type: string;
  targetUrl: string;
  dedupe?: boolean;
};

async function sendNotificationEmail({
  userId,
  title,
  message,
  type,
  targetUrl,
}: {
  userId: string;
  title: string;
  message: string;
  type: string;
  targetUrl: string;
}) {
  try {
    await fetch("/api/email-notifications/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        notificationType: type,
        subject: title,
        body: message,
        targetUrl,
      }),
    });
  } catch (error) {
    console.warn("Email notification failed:", error);
  }
}

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

  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    title,
    message,
    type,
    target_url: targetUrl,
  });

  if (error) {
    console.warn("In-app notification failed:", error.message);
    return;
  }

  await sendNotificationEmail({
    userId,
    title,
    message,
    type,
    targetUrl,
  });
}