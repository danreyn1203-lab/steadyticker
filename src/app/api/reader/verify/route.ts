import { NextResponse } from "next/server";
import { checkVerificationCode } from "@/lib/readers";
import {
  getPendingReader,
  createReaderToken,
  readerCookieOptions,
  READER_COOKIE,
  READER_PENDING_COOKIE,
} from "@/lib/readerAuth";

/**
 * Public: finish sign-up (or sign-in) by entering the emailed code. The pending
 * cookie says which account. On success the account is verified + subscribed,
 * the pending cookie is cleared, and a real reader session is set.
 */
export async function POST(request: Request) {
  const pending = await getPendingReader();
  if (!pending) {
    return NextResponse.json(
      { ok: false, expired: true, error: "Your verification session expired. Please sign in again." },
      { status: 401 },
    );
  }

  let code = "";
  try {
    const body = await request.json();
    code = typeof body?.code === "string" ? body.code : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const result = await checkVerificationCode(pending.id, code);
  if (!result.ok || !result.reader) {
    return NextResponse.json(
      { ok: false, error: result.error, retry: result.retry ?? false },
      { status: 400 },
    );
  }

  const res = NextResponse.json({ ok: true, firstName: result.reader.firstName });
  res.cookies.set(READER_COOKIE, await createReaderToken(result.reader.id), readerCookieOptions());
  res.cookies.set(READER_PENDING_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
