import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

type SendEmailNotificationInput = {
  userId: string;
  notificationType: string;
  subject: string;
  body: string;
  targetUrl?: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  role: "tenant" | "landlord" | "admin" | string | null;
};

type PreferenceRow = {
  [key: string]: boolean | string | null;
};

const preferenceMap: Record<string, string> = {
  application_submitted: "application_submitted",
  application_status_updated: "application_status_updated",

  listing_approved: "listing_approved",
  listing_rejected: "listing_rejected",
  listing_needs_changes: "listing_needs_changes",

  message_received: "message_received",

  lease_sent: "lease_sent",
  lease_tenant_signed: "lease_signed",
  lease_completed: "lease_signed",
  lease_signed: "lease_signed",
  lease_renewal: "lease_renewal_requested",
  lease_ending_soon: "lease_ending_soon",
  lease_move_out: "lease_move_out_requested",

  screening_request: "screening_requested",
  screening_requested: "screening_requested",
  screening_update: "screening_updated",
  screening_updated: "screening_updated",

  maintenance_request: "maintenance_created",
  maintenance_created: "maintenance_created",
  maintenance_update: "maintenance_updated",
  maintenance_updated: "maintenance_updated",

  payment_due: "payment_due",
  payment_updated: "payment_updated",

  marketing_updates: "marketing_updates",
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function buildEmailHtml({
  subject,
  body,
  targetUrl,
}: {
  subject: string;
  body: string;
  targetUrl?: string | null;
}) {
  const safeBody = body.replace(/\n/g, "<br />");

  return `
    <div style="margin:0;padding:0;background:#f7f4ef;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;padding:32px 18px;">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:28px;">
          <div style="display:inline-block;background:#0f172a;color:#ffffff;border-radius:14px;padding:10px 14px;font-weight:900;letter-spacing:.04em;">
            Keylo
          </div>

          <h1 style="font-size:28px;line-height:1.2;margin:24px 0 12px;font-weight:900;color:#0f172a;">
            ${subject}
          </h1>

          <p style="font-size:16px;line-height:1.7;margin:0;color:#475569;">
            ${safeBody}
          </p>

          ${
            targetUrl
              ? `
                <div style="margin-top:26px;">
                  <a href="${targetUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:999px;padding:14px 22px;font-weight:900;">
                    Open in Keylo
                  </a>
                </div>
              `
              : ""
          }

          <p style="font-size:12px;line-height:1.6;color:#94a3b8;margin-top:30px;">
            You are receiving this email because you have a Keylo account. You can update your email preferences from your Keylo dashboard.
          </p>
        </div>
      </div>
    </div>
  `;
}

async function logEmail({
  userId,
  notificationType,
  recipientEmail,
  subject,
  body,
  targetUrl,
  status,
  providerMessageId,
  errorMessage,
}: {
  userId: string;
  notificationType: string;
  recipientEmail: string;
  subject: string;
  body: string;
  targetUrl?: string | null;
  status:
    | "queued"
    | "sent"
    | "skipped_preferences"
    | "skipped_missing_email"
    | "failed";
  providerMessageId?: string | null;
  errorMessage?: string | null;
}) {
  const supabaseAdmin = getSupabaseAdmin();

  await supabaseAdmin.from("email_notification_logs").insert({
    user_id: userId,
    notification_type: notificationType,
    recipient_email: recipientEmail || "missing",
    subject,
    body,
    target_url: targetUrl || null,
    status,
    provider: "resend",
    provider_message_id: providerMessageId || null,
    error_message: errorMessage || null,
    sent_at: status === "sent" ? new Date().toISOString() : null,
  });
}

export async function sendEmailNotification({
  userId,
  notificationType,
  subject,
  body,
  targetUrl,
}: SendEmailNotificationInput) {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message || "Profile not found.");
  }

  const profileRow = profile as ProfileRow;

  if (!profileRow.email) {
    await logEmail({
      userId,
      notificationType,
      recipientEmail: "",
      subject,
      body,
      targetUrl,
      status: "skipped_missing_email",
    });

    return {
      sent: false,
      skipped: true,
      reason: "missing_email",
    };
  }

  const preferenceColumn = preferenceMap[notificationType];

  if (preferenceColumn) {
    const { data: preferences } = await supabaseAdmin
      .from("email_notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const preferenceRow = preferences as PreferenceRow | null;

    if (preferenceRow && preferenceRow[preferenceColumn] === false) {
      await logEmail({
        userId,
        notificationType,
        recipientEmail: profileRow.email,
        subject,
        body,
        targetUrl,
        status: "skipped_preferences",
      });

      return {
        sent: false,
        skipped: true,
        reason: "preferences_off",
      };
    }
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.KEYLO_EMAIL_FROM;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  if (!resendApiKey || !emailFrom) {
    await logEmail({
      userId,
      notificationType,
      recipientEmail: profileRow.email,
      subject,
      body,
      targetUrl,
      status: "failed",
      errorMessage: "Missing RESEND_API_KEY or KEYLO_EMAIL_FROM.",
    });

    return {
      sent: false,
      skipped: false,
      reason: "missing_resend_config",
    };
  }

  const fullTargetUrl = targetUrl?.startsWith("http")
    ? targetUrl
    : targetUrl
      ? `${siteUrl}${targetUrl}`
      : null;

  try {
    const resend = new Resend(resendApiKey);

    const result = await resend.emails.send({
      from: emailFrom,
      to: profileRow.email,
      subject,
      html: buildEmailHtml({
        subject,
        body,
        targetUrl: fullTargetUrl,
      }),
    });

    await logEmail({
      userId,
      notificationType,
      recipientEmail: profileRow.email,
      subject,
      body,
      targetUrl: fullTargetUrl,
      status: "sent",
      providerMessageId: result.data?.id || null,
    });

    return {
      sent: true,
      skipped: false,
      providerMessageId: result.data?.id || null,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown email error.";

    await logEmail({
      userId,
      notificationType,
      recipientEmail: profileRow.email,
      subject,
      body,
      targetUrl: fullTargetUrl,
      status: "failed",
      errorMessage,
    });

    return {
      sent: false,
      skipped: false,
      reason: errorMessage,
    };
  }
}