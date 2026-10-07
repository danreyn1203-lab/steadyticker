import { NextResponse } from "next/server";
import { createReaderAccount } from "@/lib/readers";
import { deliverVerificationCode } from "@/lib/readerDelivery";
import { createPendingToken, pendingCookieOptions, READER_PENDING_COOKIE } from "@/lib/readerAuth";

/**
 * Public: start a reader account. Creates an UNVERIFIED account with a hashed
 * password and emails a 6-digit code. The caller is handed a short-lived
 * "pending" cookie and sent to /verify; the account isn't usable (and isn't
 * subscribed) until the code is entered.
 */
export async function POST(request: Request) {
  if (tooManyFrom(clientKey(request))) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts from here just now. Try again shortly." },
      { status: 429 },
    );
  }

  let firstName = "";
  let email = "";
  let password = "";
  try {
    const body = await request.json();
    firstName = typeof body?.firstName === "string" ? body.firstName : "";
    email = typeof body?.email === "string" ? body.email : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const result = await createReaderAccount({ firstName, email, password, source: "signup-page" });
  if (!result.ok || !result.reader || !result.code) {
    const status = result.reason === "exists" ? 409 : 400;
    return NextResponse.json(
      { ok: false, error: result.error, reason: result.reason },
      { status },
    );
  }

  const delivery = await deliverVerificationCode(
    result.reader.email,
    result.reader.firstName,
    result.code,
  );

  const res = NextResponse.json({
    ok: true,
    needsVerification: true,
    email: result.reader.email,
    firstName: result.reader.firstName,
    sent: delivery.sent,
    devCode: delivery.devCode,
  });
  res.cookies.set(
    READER_PENDING_COOKIE,
    await createPendingToken(result.reader.id),
    pendingCookieOptions(),
  );
  return res;
}

// --- crude in-memory throttle (resets on restart) -------------------------
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 12;
const hits = new Map<string, number[]>();

function clientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function tooManyFrom(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}
