import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const resendApiKey = process.env.RESEND_API_KEY || "";
const emailFrom = process.env.KEYLO_EMAIL_FROM || "Keylo <notifications@keylo.com>";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
const resend = new Resend(resendApiKey);

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Missing auth token." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await adminSupabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid auth token." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const inviteId = body.invite_id as string | undefined;

    if (!inviteId) {
      return NextResponse.json(
        { error: "Invite ID is required." },
        { status: 400 }
      );
    }

    const { data: invite, error: inviteError } = await adminSupabase
      .from("landlord_company_invites")
      .select(
        `
        id,
        company_id,
        email,
        role,
        status,
        token,
        expires_at,
        landlord_companies (
          id,
          name
        )
      `
      )
      .eq("id", inviteId)
      .maybeSingle();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: inviteError?.message || "Invite not found." },
        { status: 404 }
      );
    }

    if (invite.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending invites can be sent." },
        { status: 400 }
      );
    }

    const { data: membership, error: membershipError } = await adminSupabase
      .from("landlord_company_members")
      .select("id, role, status")
      .eq("company_id", invite.company_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (
      membershipError ||
      !membership ||
      !["owner", "admin"].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: "Only company owners and admins can send invites." },
        { status: 403 }
      );
    }

    const companyRow = Array.isArray(invite.landlord_companies)
      ? invite.landlord_companies[0]
      : invite.landlord_companies;

    const companyName = companyRow?.name || "a landlord company";
    const inviteLink = `${siteUrl}/company-invites/${invite.token}`;

    const { error: emailError } = await resend.emails.send({
      from: emailFrom,
      to: invite.email,
      subject: `${companyName} invited you to Keylo`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px;">
          <h1 style="margin: 0 0 16px; font-size: 28px;">You're invited to Keylo</h1>

          <p style="font-size: 16px; line-height: 1.6;">
            ${companyName} invited you to join their landlord team on Keylo.
          </p>

          <p style="font-size: 16px; line-height: 1.6;">
            Your role: <strong>${invite.role}</strong>
          </p>

          <p style="margin: 28px 0;">
            <a href="${inviteLink}" style="background:#07101f;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700;display:inline-block;">
              Accept Invite
            </a>
          </p>

          <p style="font-size: 14px; line-height: 1.6; color: #64748b;">
            This invite expires on ${new Date(invite.expires_at).toLocaleDateString()}.
          </p>

          <p style="font-size: 14px; line-height: 1.6; color: #64748b;">
            If the button does not work, copy and paste this link into your browser:<br />
            ${inviteLink}
          </p>
        </div>
      `,
    });

    if (emailError) {
      return NextResponse.json(
        { error: emailError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}