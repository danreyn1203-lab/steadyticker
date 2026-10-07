import "server-only";
import { cookies } from "next/headers";
import {
  hmacSha256B64url,
  b64urlEncode,
  b64urlDecodeToString,
  constantTimeEqual,
} from "@/lib/crypto";

/**
 * Minimal single-author auth. There is one author (the site owner). The
 * email, password and signing secret come from environment variables — never
 * hard-code secrets (§67). A signed, httpOnly cookie marks an authenticated
 * session; the secret never reaches the client. This is enough to gate editing
 * on a single-author research site; it is not a multi-user account system.
 *
 * Signing uses Web Crypto HMAC-SHA256 (see src/lib/crypto.ts) so it runs on
 * Cloudflare Workers as well as locally; the signature is byte-identical to the
 * old node:crypto version, so existing sessions keep working.
 *
 * To change the login, edit AUTHOR_EMAIL / AUTHOR_PASSWORD in .env.local and
 * restart the server — the credentials live only there, never in the code.
 */

export const SESSION_COOKIE = "author_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  return (
    process.env.AUTHOR_SESSION_SECRET ||
    // Dev fallback so the app runs before .env.local is set. Set a real value!
    "dev-insecure-secret-change-me"
  );
}

function sign(payload: string): Promise<string> {
  return hmacSha256B64url(secret(), payload);
}

/** Create a signed session token that expires in MAX_AGE seconds. */
export async function createToken(): Promise<string> {
  const payload = b64urlEncode(
    JSON.stringify({ role: "author", exp: Date.now() + MAX_AGE * 1000 }),
  );
  return `${payload}.${await sign(payload)}`;
}

async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  if (!constantTimeEqual(sig, await sign(payload))) return false;
  try {
    const data = JSON.parse(b64urlDecodeToString(payload));
    return data.role === "author" && typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

/** True when the current request carries a valid author session. */
export async function isAuthor(): Promise<boolean> {
  const store = await cookies();
  return verifyToken(store.get(SESSION_COOKIE)?.value);
}

/** Constant-time password check against the configured author password. */
export function checkPassword(input: string): boolean {
  const expected = process.env.AUTHOR_PASSWORD;
  if (!expected) return false; // no password configured → editing stays locked
  return constantTimeEqual(input, expected);
}

/**
 * Check an email + password against the configured author credentials.
 * The password is compared in constant time. The email is only a label (not a
 * secret), so a plain case-insensitive match is fine; if AUTHOR_EMAIL isn't set
 * the email step is skipped, so a password-only setup keeps working.
 */
export function checkCredentials(email: string, password: string): boolean {
  if (!checkPassword(password)) return false;
  const expectedEmail = process.env.AUTHOR_EMAIL;
  if (!expectedEmail) return true; // no email configured → password alone
  return email.trim().toLowerCase() === expectedEmail.trim().toLowerCase();
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  };
}
