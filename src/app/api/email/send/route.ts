import { NextResponse } from "next/server";
import { isAuthor } from "@/lib/auth";
import { getSubscribers, addBroadcast } from "@/lib/subscribers";
import {
  emailConfigured,
  renderEmailHtml,
  sendToAll,
  buildMailtoBcc,
} from "@/lib/email";

/** Author-only: send a broadcast to every subscriber. */
export async function POST(request: Request) {
  if (!(await isAuthor())) {
    return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 401 });
  }

  let subject = "";
  let body = "";
  try {
    const payload = await request.json();
    subject = typeof payload?.subject === "string" ? payload.subject.trim() : "";
    body = typeof payload?.body === "string" ? payload.body.trim() : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  if (!subject || !body) {
    return NextResponse.json(
      { ok: false, error: "Add a subject and a message first." },
      { status: 400 },
    );
  }

  const subscribers = await getSubscribers();
  const emails = subscribers.map((s) => s.email);
  if (emails.length === 0) {
    return NextResponse.json({ ok: false, error: "No subscribers yet." }, { status: 400 });
  }

  // No email provider configured → hand back a mailto BCC the author can send from their client.
  if (!emailConfigured()) {
    await addBroadcast({
      subject,
      body,
      recipients: emails.length,
      via: "mailto",
    });
    return NextResponse.json({
      ok: true,
      via: "mailto",
      recipients: emails.length,
      mailto: buildMailtoBcc(emails, subject, body),
      message:
        "Email isn’t configured yet, so I prepared a ready-to-send email in your mail app (everyone BCC’d).",
    });
  }

  // Resend configured → send one personal email per subscriber.
  const html = renderEmailHtml(subject, body);
  const { sent, failed, errors } = await sendToAll(emails, subject, html);
  await addBroadcast({ subject, body, recipients: emails.length, via: "resend" });

  return NextResponse.json({
    ok: true,
    via: "resend",
    recipients: emails.length,
    sent,
    failed,
    errors: errors.slice(0, 5),
    message: `Sent ${sent} of ${emails.length}${failed ? ` (${failed} failed)` : ""}.`,
  });
}
