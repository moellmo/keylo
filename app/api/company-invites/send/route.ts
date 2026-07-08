import { NextResponse } from "next/server";
import { Resend } from "resend";

type InviteEmailPayload = {
  email?: string;
  companyName?: string;
  inviteLink?: string;
  role?: string;
};

export async function POST(request: Request) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom =
      process.env.KEYLO_EMAIL_FROM || "Keylo <notifications@keylo.local>";

    const body = (await request.json()) as InviteEmailPayload;

    const email = body.email?.trim();
    const companyName = body.companyName?.trim() || "a landlord company";
    const inviteLink = body.inviteLink?.trim();
    const role = body.role?.trim() || "team member";

    if (!email || !inviteLink) {
      return NextResponse.json(
        { error: "Missing email or invite link." },
        { status: 400 }
      );
    }

    if (!resendApiKey) {
      console.warn(
        "RESEND_API_KEY is missing. Company invite email was skipped."
      );

      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "RESEND_API_KEY is missing.",
      });
    }

    const resend = new Resend(resendApiKey);

    const result = await resend.emails.send({
      from: emailFrom,
      to: email,
      subject: `You're invited to join ${companyName} on Keylo`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h1 style="margin: 0 0 16px;">You're invited to Keylo</h1>

          <p>
            You have been invited to join <strong>${companyName}</strong> as a
            <strong>${role}</strong>.
          </p>

          <p>
            Click below to accept the invite and join the landlord team.
          </p>

          <p style="margin: 24px 0;">
            <a
              href="${inviteLink}"
              style="background:#020617;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700;display:inline-block;"
            >
              Accept Invite
            </a>
          </p>

          <p style="font-size: 13px; color: #64748b;">
            If the button does not work, copy and paste this link into your browser:<br />
            ${inviteLink}
          </p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not send invite email.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}