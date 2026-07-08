import { supabase } from "@/lib/supabaseClient";
import { createNotification } from "@/lib/createNotification";

type CompanyNotificationRole =
  | "owner"
  | "admin"
  | "manager"
  | "maintenance"
  | "accounting"
  | "viewer";

type CompanyNotificationInput = {
  companyId: string | null | undefined;
  fallbackUserId?: string | null;
  roles?: CompanyNotificationRole[];
  title: string;
  message: string;
  type: string;
  targetUrl: string;
  dedupe?: boolean;
};

type RecipientRow = {
  user_id: string;
  role: string;
};

export async function createCompanyNotifications({
  companyId,
  fallbackUserId,
  roles = ["owner", "admin", "manager", "maintenance"],
  title,
  message,
  type,
  targetUrl,
  dedupe = false,
}: CompanyNotificationInput) {
  const recipientIds = new Set<string>();

  if (fallbackUserId) {
    recipientIds.add(fallbackUserId);
  }

  if (companyId) {
    const { data, error } = await supabase.rpc(
      "get_landlord_company_notification_recipients",
      {
        company: companyId,
        allowed_roles: roles,
      }
    );

    if (error) {
      console.warn("Company notification recipients error:", error.message);
    }

    ((data || []) as RecipientRow[]).forEach((recipient) => {
      if (recipient.user_id) {
        recipientIds.add(recipient.user_id);
      }
    });
  }

  const results = await Promise.allSettled(
    Array.from(recipientIds).map((userId) =>
      createNotification({
        userId,
        title,
        message,
        type,
        targetUrl,
        dedupe,
      })
    )
  );

  return {
    recipientCount: recipientIds.size,
    results,
  };
}