import { NextResponse } from "next/server";
import { authenticate, stageVerificationCode } from "@/lib/readers";
import { deliverVerificationCode } from "@/lib/readerDelivery";
import {
  createReaderToken,
  readerCookieOptions,
  READER_COOKIE,
  createPendingToken,
  pendingCookieOptions,
  READER_PENDING_COOKIE,
} from "@/lib/readerAuth";

/**
 * Public: sign in with email + password.
 * - Wrong email OR wrong password → one generic error (no account enumeration).
 * - Correct but not-yet-verified → re-send a code, set the pending cookie, and
 *   tell the client to go verify.
 * - Correct and verified → set the reader session.
 */
export async function POST(request: Request) {
  if (tooManyFrom(clientKey(request))) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts from here just now. Try again shortly." },
      { status: 429 },
    );
  }

  let email = "";
  let password = "";
  try {
    const body = await request.json();
    email = typeof body?.email === "string" ? body.email : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const auth = await authenticate(email, password);
  if (!auth.ok || !auth.reader) {
    return NextResponse.json(
      { ok: false, error: "That email and password don’t match." },
      { status: 401 },
    );
  }

  // Signed up but never verified → route them through the code step.
  if (!auth.verified) {
    const staged = await stageVerificationCode(auth.reader.id);
    const delivery = staged.ok && staged.reader && staged.code
      ? await deliverVerificationCode(staged.reader.email, staged.reader.firstName, staged.code)
      : { sent: false, devCode: undefined as string | undefined };

    const res = NextResponse.json({
      ok: true,
      needsVerification: true,
      email: auth.reader.email,
      sent: delivery.sent,
      devCode: delivery.devCode,
    });
    res.cookies.set(
      READER_PENDING_COOKIE,
      await createPendingToken(auth.reader.id),
      pendingCookieOptions(),
    );
    return res;
  }

  const res = NextResponse.json({
    ok: true,
    needsVerification: false,
    firstName: auth.reader.firstName,
  });
  res.cookies.set(READER_COOKIE, await createReaderToken(auth.reader.id), readerCookieOptions());
  return res;
}

// --- crude in-memory throttle (resets on restart) -------------------------
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 10;
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
