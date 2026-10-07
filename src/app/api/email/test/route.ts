import { NextResponse } from "next/server";
import { isAuthor } from "@/lib/auth";
import { emailConfigured, renderEmailHtml, sendToAll } from "@/lib/email";
import { site } from "@/lib/site";

/** Author-only: send a single test email to confirm email delivery works. */
export async function POST(request: Request) {
  if (!(await isAuthor())) {
    return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 401 });
  }
  if (!emailConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Email isn’t configured. Add RESEND_API_KEY and NEWSLETTER_FROM to .env.local and restart.",
      },
      { status: 400 },
    );
  }

  let to = "";
  try {
    const body = await request.json();
    to = typeof body?.to === "string" ? body.to.trim() : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  if (!to) {
    return NextResponse.json({ ok: false, error: "Enter an address to test." }, { status: 400 });
  }

  const html = renderEmailHtml(
    `Test email from ${site.name}`,
    "This is a test. If you’re reading this, email delivery works and you can send real newsletters. 🎉",
  );
  const { sent, errors } = await sendToAll([to], `Test — ${site.name}`, html);

  if (sent === 1) {
    return NextResponse.json({ ok: true, message: `Test sent to ${to}. Check your inbox.` });
  }
  return NextResponse.json(
    { ok: false, error: errors[0] || "The test failed to send." },
    { status: 502 },
  );
}
