import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(request: Request) {
  try {
    const { applicationId } = await request.json();

    if (!applicationId) {
      return NextResponse.json(
        { error: "Missing applicationId" },
        { status: 400 }
      );
    }

    const { data: application, error } = await supabaseAdmin
      .from("applications")
      .select(
        `
        id,
        first_name,
        last_name,
        email,
        phone,
        monthly_income,
        move_in_date,
        household_size,
        pets,
        message,
        status,
        created_at,
        properties (
          id,
          title,
          monthly_rent,
          city,
          state,
          landlord_id
        )
      `
      )
      .eq("id", applicationId)
      .single();

    if (error || !application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const property = Array.isArray(application.properties)
      ? application.properties[0]
      : application.properties;

    if (!property?.landlord_id) {
      return NextResponse.json(
        { error: "Listing has no landlord" },
        { status: 400 }
      );
    }

    const { data: landlordProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name, company_name")
      .eq("id", property.landlord_id)
      .single();

    if (!landlordProfile?.email) {
      return NextResponse.json(
        { error: "Landlord email not found" },
        { status: 400 }
      );
    }

    const applicantName = `${application.first_name} ${application.last_name}`;
    const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/dashboard/landlord/properties/${property.id}/applications`;

    await resend.emails.send({
      from: "Keylo <onboarding@resend.dev>",
      to: landlordProfile.email,
      subject: `New application for ${property.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; background:#f7f4ef; padding:30px;">
          <div style="max-width:640px; margin:0 auto; background:white; border-radius:24px; padding:30px;">
            <h1 style="margin:0; font-size:28px;">New rental application</h1>

            <p style="font-size:16px; color:#475569;">
              A tenant submitted an application for:
            </p>

            <div style="background:#f7f4ef; border-radius:18px; padding:18px; margin:20px 0;">
              <h2 style="margin:0 0 8px 0;">${property.title}</h2>
              <p style="margin:0; color:#475569;">
                ${property.city}, ${property.state} · $${Number(
                  property.monthly_rent
                ).toLocaleString()}/mo
              </p>
            </div>

            <h3>Applicant</h3>

            <p><strong>Name:</strong> ${applicantName}</p>
            <p><strong>Email:</strong> ${application.email}</p>
            <p><strong>Phone:</strong> ${application.phone || "Not provided"}</p>
            <p><strong>Monthly income:</strong> ${
              application.monthly_income
                ? `$${Number(application.monthly_income).toLocaleString()}`
                : "Not provided"
            }</p>
            <p><strong>Move-in date:</strong> ${
              application.move_in_date || "Not provided"
            }</p>
            <p><strong>Household size:</strong> ${
              application.household_size || "Not provided"
            }</p>
            <p><strong>Pets:</strong> ${application.pets || "Not provided"}</p>

            <h3>Message</h3>
            <p style="line-height:1.6; color:#475569;">
              ${application.message || "No message provided."}
            </p>

            <div style="margin-top:28px;">
              <a href="${dashboardUrl}" style="background:#020617; color:white; text-decoration:none; padding:14px 22px; border-radius:999px; font-weight:bold; display:inline-block;">
                View Application
              </a>
            </div>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Email failed" },
      { status: 500 }
    );
  }
}