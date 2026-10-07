import "server-only";
import { cookies } from "next/headers";
import {
  hmacSha256B64url,
  b64urlEncode,
  b64urlDecodeToString,
  constantTimeEqual,
} from "@/lib/crypto";
import { findReaderById, type Reader } from "@/lib/readers";

/**
 * Reader sessions — completely separate from the author session in src/lib/auth.ts.
 *
 * The separation is the point: a reader cookie is a DIFFERENT cookie name,
 * signed with a DIFFERENT key (the shared secret domain-separated by a purpose
 * string), and carries role "reader". So a reader token cannot be replayed as
 * an author token — the signature won't verify, and even if it did, isAuthor()
 * requires role "author". Nobody who signs up can reach the author's dashboard,
 * research editing, or subscriber list.
 *
 * Accounts have passwords (see src/lib/readers.ts), so this session cookie is a
 * real credential: holding it means you proved the password and the emailed
 * code. A separate short-lived PENDING cookie carries someone through the
 * verification step before they have a full session.
 *
 * Signing uses Web Crypto HMAC-SHA256 (src/lib/crypto.ts) so it runs on
 * Cloudflare Workers; signatures are byte-identical to the old node:crypto code.
 */

export const READER_COOKIE = "reader_session";
const MAX_AGE = 60 * 60 * 24 * 180; // 180 days — readers shouldn't have to re-enter

/** The in-between cookie while someone is verifying their email. Short-lived. */
export const READER_PENDING_COOKIE = "reader_pending";
const PENDING_MAX_AGE = 60 * 30; // 30 minutes to enter the code

function key(): string {
  const base =
    process.env.AUTHOR_SESSION_SECRET ||
    // Dev fallback so the app runs before .env.local is set. Set a real value!
    "dev-insecure-secret-change-me";
  // Domain separation: a reader signature is never a valid author signature.
  return `${base}|reader-session-v1`;
}

function sign(payload: string): Promise<string> {
  return hmacSha256B64url(key(), payload);
}

function pendingKey(): string {
  const base =
    process.env.AUTHOR_SESSION_SECRET || "dev-insecure-secret-change-me";
  return `${base}|reader-pending-v1`;
}

function signPending(payload: string): Promise<string> {
  return hmacSha256B64url(pendingKey(), payload);
}

export async function createReaderToken(readerId: string): Promise<string> {
  const payload = b64urlEncode(
    JSON.stringify({ role: "reader", id: readerId, exp: Date.now() + MAX_AGE * 1000 }),
  );
  return `${payload}.${await sign(payload)}`;
}

async function readerIdFromToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!constantTimeEqual(sig, await sign(payload))) return null;
  try {
    const data = JSON.parse(b64urlDecodeToString(payload));
    if (data.role !== "reader") return null;
    if (typeof data.exp !== "number" || data.exp <= Date.now()) return null;
    return typeof data.id === "string" ? data.id : null;
  } catch {
    return null;
  }
}

/**
 * The signed-in reader, or null. Returns null for a deleted account, so
 * "leave" takes effect immediately even if the cookie is still around.
 */
export async function getReader(): Promise<Reader | null> {
  const store = await cookies();
  const id = await readerIdFromToken(store.get(READER_COOKIE)?.value);
  if (!id) return null;
  return findReaderById(id);
}

export function readerCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  };
}

// --- pending verification -------------------------------------------------

export async function createPendingToken(readerId: string): Promise<string> {
  const payload = b64urlEncode(
    JSON.stringify({
      role: "reader-pending",
      id: readerId,
      exp: Date.now() + PENDING_MAX_AGE * 1000,
    }),
  );
  return `${payload}.${await signPending(payload)}`;
}

async function pendingIdFromToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!constantTimeEqual(sig, await signPending(payload))) return null;
  try {
    const data = JSON.parse(b64urlDecodeToString(payload));
    if (data.role !== "reader-pending") return null;
    if (typeof data.exp !== "number" || data.exp <= Date.now()) return null;
    return typeof data.id === "string" ? data.id : null;
  } catch {
    return null;
  }
}

/** The reader currently mid-verification (from the pending cookie), or null. */
export async function getPendingReader(): Promise<Reader | null> {
  const store = await cookies();
  const id = await pendingIdFromToken(store.get(READER_PENDING_COOKIE)?.value);
  if (!id) return null;
  return findReaderById(id);
}

export function pendingCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_MAX_AGE,
  };
}
