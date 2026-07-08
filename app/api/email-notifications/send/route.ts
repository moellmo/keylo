import { NextResponse } from "next/server";
import { sendEmailNotification } from "@/lib/sendEmailNotification";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const userId = String(body.userId || "");
    const notificationType = String(body.notificationType || "");
    const subject = String(body.subject || "");
    const messageBody = String(body.body || "");
    const targetUrl = body.targetUrl ? String(body.targetUrl) : null;

    if (!userId || !notificationType || !subject || !messageBody) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: userId, notificationType, subject, body.",
        },
        { status: 400 }
      );
    }

    const result = await sendEmailNotification({
      userId,
      notificationType,
      subject,
      body: messageBody,
      targetUrl,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown email error.";

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}