import "server-only";
import {
  randomUUID,
  randomHex,
  randomIntBelow,
  constantTimeEqual,
  hmacSha256Hex,
  pbkdf2Hex,
} from "@/lib/crypto";
import { readDoc, writeDoc } from "@/lib/kv";
import { addSubscriber, removeSubscriber, isValidEmail } from "@/lib/subscribers";

/**
 * Reader accounts — the people who sign up on the public site.
 *
 * An account is a first name, an email, and a password. Passwords are hashed
 * with PBKDF2 (a per-account random salt) and only the hash is stored — never
 * the password itself. The store is a JSON document via src/lib/kv.ts — a
 * Cloudflare KV namespace in production, a local JSON file in development.
 *
 * Email ownership is proved with a short code: a new account is created
 * UNVERIFIED and is only subscribed and allowed to sign in once the code that
 * was emailed to it is entered. That is the "proof" step — it stops someone
 * signing up with an address that isn't theirs.
 *
 * This is deliberately NOT the author account. The author has no row here and
 * no reader session can ever reach the author tools (see src/lib/readerAuth.ts
 * and src/lib/auth.ts — different cookies, different signing keys, different
 * roles).
 */

export interface Reader {
  id: string;
  firstName: string;
  email: string;
  /** PBKDF2 hash (hex) of the password + passwordSalt. */
  passwordHash: string;
  /** Random per-account salt (hex). */
  passwordSalt: string;
  /** True once the emailed code has been entered. */
  verified: boolean;
  /** ISO timestamp the account was created. */
  joinedAt: string;
  /** Where they signed up from, e.g. "signup-page". */
  source: string;

  // --- verification (transient; cleared once verified) ---
  /** HMAC of the current code; the plaintext code is never stored. */
  verifyCodeHash?: string;
  /** ms-epoch expiry of the current code. */
  verifyExpires?: number;
  /** Wrong tries against the current code. */
  verifyAttempts?: number;
}

/** Everything safe to expose outside the server (never the hash/salt/code). */
export interface PublicReader {
  id: string;
  firstName: string;
  email: string;
  joinedAt: string;
  verified: boolean;
}

/** Codes are 6 digits and live for 15 minutes; 5 wrong tries burns a code. */
const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200; // bound the hashing work — don't hash arbitrarily long input

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export async function getReaders(): Promise<Reader[]> {
  const data = await readDoc<{ readers?: Reader[] }>("readers", {});
  return Array.isArray(data.readers) ? data.readers : [];
}

async function writeReaders(readers: Reader[]): Promise<void> {
  await writeDoc("readers", { readers });
}

export function toPublic(r: Reader): PublicReader {
  return {
    id: r.id,
    firstName: r.firstName,
    email: r.email,
    joinedAt: r.joinedAt,
    verified: r.verified,
  };
}

export async function findReaderByEmail(emailRaw: string): Promise<Reader | null> {
  const email = emailRaw.trim().toLowerCase();
  const readers = await getReaders();
  return readers.find((r) => r.email === email) ?? null;
}

export async function findReaderById(id: string): Promise<Reader | null> {
  const readers = await getReaders();
  return readers.find((r) => r.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Keep names short, single-line, and free of markup. */
export function cleanFirstName(input: string): string {
  return input
    .replace(/[\p{C}<>]/gu, "") // control chars and angle brackets
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

export function isValidFirstName(name: string): boolean {
  return cleanFirstName(name).length >= 1;
}

export function passwordProblem(password: string): string | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return `Use at least ${MIN_PASSWORD} characters for your password.`;
  }
  if (password.length > MAX_PASSWORD) {
    return "That password is too long.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Password + code crypto
// ---------------------------------------------------------------------------

async function hashPassword(password: string, salt: string): Promise<string> {
  return pbkdf2Hex(password, salt);
}

async function passwordMatches(reader: Reader, password: string): Promise<boolean> {
  if (!reader.passwordHash || !reader.passwordSalt) return false;
  let candidate: string;
  try {
    candidate = await pbkdf2Hex(password, reader.passwordSalt);
  } catch {
    return false;
  }
  return constantTimeEqual(reader.passwordHash, candidate);
}

function generateCode(): string {
  return String(randomIntBelow(1_000_000)).padStart(6, "0");
}

/** HMAC the code with the server secret so a leaked store isn't trivially reversible. */
function codeHash(readerId: string, code: string): Promise<string> {
  const secret =
    process.env.AUTHOR_SESSION_SECRET || "dev-insecure-secret-change-me";
  return hmacSha256Hex(`${secret}|reader-verify-v1`, `${readerId}:${code}`);
}

async function freshCode(
  readerId: string,
): Promise<{ code: string; hash: string; expires: number }> {
  const code = generateCode();
  return {
    code,
    hash: await codeHash(readerId, code),
    expires: Date.now() + CODE_TTL_MS,
  };
}

// ---------------------------------------------------------------------------
// Sign up / verify / authenticate
// ---------------------------------------------------------------------------

export interface CreateResult {
  ok: boolean;
  reader?: Reader;
  /** The plaintext code to email — present only on success. */
  code?: string;
  /** Machine-readable reason on failure. */
  reason?: "invalid" | "exists";
  error?: string;
}

/**
 * Create (or re-create) an UNVERIFIED account and stage a verification code.
 * - A brand-new email -> a new account.
 * - An existing but still-unverified email -> the account is updated in place
 *   (name + password reset) and a fresh code staged, so an abandoned sign-up
 *   can be restarted without being locked out.
 * - An already-verified email -> refused; they should sign in instead.
 */
export async function createReaderAccount({
  firstName: firstNameRaw,
  email: emailRaw,
  password,
  source = "signup-page",
}: {
  firstName: string;
  email: string;
  password: string;
  source?: string;
}): Promise<CreateResult> {
  const firstName = cleanFirstName(firstNameRaw);
  const email = emailRaw.trim().toLowerCase();

  if (!firstName) return { ok: false, reason: "invalid", error: "Please add a first name." };
  if (!isValidEmail(email)) {
    return { ok: false, reason: "invalid", error: "That doesn’t look like a valid email." };
  }
  const pwProblem = passwordProblem(password);
  if (pwProblem) return { ok: false, reason: "invalid", error: pwProblem };

  const readers = await getReaders();
  const existing = readers.find((r) => r.email === email);

  if (existing?.verified) {
    return {
      ok: false,
      reason: "exists",
      error: "An account with that email already exists — sign in instead.",
    };
  }

  const salt = randomHex(16);
  const passwordHash = await hashPassword(password, salt);

  if (existing) {
    // Resume an abandoned sign-up: overwrite name/password, re-stage a code.
    existing.firstName = firstName;
    existing.passwordHash = passwordHash;
    existing.passwordSalt = salt;
    const { code, hash, expires } = await freshCode(existing.id);
    existing.verifyCodeHash = hash;
    existing.verifyExpires = expires;
    existing.verifyAttempts = 0;
    await writeReaders(readers);
    return { ok: true, reader: existing, code };
  }

  const id = randomUUID();
  const { code, hash, expires } = await freshCode(id);
  const reader: Reader = {
    id,
    firstName,
    email,
    passwordHash,
    passwordSalt: salt,
    verified: false,
    joinedAt: new Date().toISOString(),
    source,
    verifyCodeHash: hash,
    verifyExpires: expires,
    verifyAttempts: 0,
  };
  readers.push(reader);
  await writeReaders(readers);
  return { ok: true, reader, code };
}

/** Re-stage a fresh code for a pending account (resend / sign-in-needs-verify). */
export async function stageVerificationCode(
  readerId: string,
): Promise<{ ok: boolean; reader?: Reader; code?: string }> {
  const readers = await getReaders();
  const reader = readers.find((r) => r.id === readerId);
  if (!reader) return { ok: false };
  const { code, hash, expires } = await freshCode(reader.id);
  reader.verifyCodeHash = hash;
  reader.verifyExpires = expires;
  reader.verifyAttempts = 0;
  await writeReaders(readers);
  return { ok: true, reader, code };
}

export interface VerifyResult {
  ok: boolean;
  reader?: Reader;
  error?: string;
  /** True when the code was wrong but more tries remain. */
  retry?: boolean;
}

/**
 * Check a code for a pending account. On success the account is marked verified,
 * the code is cleared, and the email is added to the newsletter list (confirmed
 * opt-in). Expired or over-tried codes must be resent.
 */
export async function checkVerificationCode(
  readerId: string,
  codeRaw: string,
): Promise<VerifyResult> {
  const code = String(codeRaw ?? "").trim();
  const readers = await getReaders();
  const reader = readers.find((r) => r.id === readerId);
  if (!reader) return { ok: false, error: "We couldn’t find that sign-up. Please start again." };

  if (reader.verified) return { ok: true, reader }; // idempotent

  if (!reader.verifyCodeHash || !reader.verifyExpires) {
    return { ok: false, error: "No code is waiting. Ask for a new one." };
  }
  if (Date.now() > reader.verifyExpires) {
    return { ok: false, error: "That code has expired. Ask for a new one." };
  }
  if ((reader.verifyAttempts ?? 0) >= MAX_VERIFY_ATTEMPTS) {
    return { ok: false, error: "Too many tries. Ask for a new code." };
  }

  const good = constantTimeEqual(reader.verifyCodeHash, await codeHash(reader.id, code));

  if (!good) {
    reader.verifyAttempts = (reader.verifyAttempts ?? 0) + 1;
    await writeReaders(readers);
    const left = MAX_VERIFY_ATTEMPTS - reader.verifyAttempts;
    return {
      ok: false,
      retry: left > 0,
      error:
        left > 0
          ? `That code isn’t right. ${left} ${left === 1 ? "try" : "tries"} left.`
          : "That code isn’t right, and you’re out of tries. Ask for a new one.",
    };
  }

  reader.verified = true;
  delete reader.verifyCodeHash;
  delete reader.verifyExpires;
  delete reader.verifyAttempts;
  await writeReaders(readers);

  // Verified email -> confirmed opt-in to the research newsletter.
  await addSubscriber(reader.email);

  return { ok: true, reader };
}

export interface AuthResult {
  ok: boolean;
  reader?: Reader;
  verified?: boolean;
}

/**
 * Check an email + password. Returns ok:false for both "no such email" and
 * "wrong password" (callers show one generic message, so the form never reveals
 * which emails have accounts). `verified` tells a successful caller whether the
 * account still needs to pass the code step.
 */
export async function authenticate(
  emailRaw: string,
  password: string,
): Promise<AuthResult> {
  const reader = await findReaderByEmail(emailRaw);
  if (!reader) return { ok: false };
  const good = await passwordMatches(reader, password);
  if (!good) return { ok: false };
  return { ok: true, reader, verified: reader.verified };
}

/** Delete a reader's account and take them off the email list. */
export async function deleteReader(id: string): Promise<void> {
  const readers = await getReaders();
  const reader = readers.find((r) => r.id === id);
  if (!reader) return;
  await writeReaders(readers.filter((r) => r.id !== id));
  await removeSubscriber(reader.email);
}

// ---------------------------------------------------------------------------
// Author dashboard stats (counts only, no behaviour tracking)
// ---------------------------------------------------------------------------

export interface ReaderStats {
  total: number;
  verified: number;
  last7Days: number;
  last30Days: number;
  /** ISO timestamp of the most recent sign-up, or null. */
  newestAt: string | null;
  /** Sign-ups per ISO week, oldest first — for the dashboard trend. */
  perWeek: { weekStart: string; count: number }[];
  /** Most recent sign-ups, newest first — sanitised (never hashes/codes). */
  recent: PublicReader[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Monday of the week containing `d`, as YYYY-MM-DD (UTC). */
function weekStart(d: Date): string {
  const utc = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const shift = (utc.getUTCDay() + 6) % 7; // Monday = 0
  utc.setUTCDate(utc.getUTCDate() - shift);
  return utc.toISOString().slice(0, 10);
}

export async function getReaderStats(weeks = 8): Promise<ReaderStats> {
  const readers = await getReaders();
  const now = Date.now();

  const sorted = [...readers].sort(
    (a, b) => Date.parse(b.joinedAt) - Date.parse(a.joinedAt),
  );

  const buckets = new Map<string, number>();
  for (let i = weeks - 1; i >= 0; i--) {
    buckets.set(weekStart(new Date(now - i * 7 * DAY_MS)), 0);
  }
  for (const r of readers) {
    const t = Date.parse(r.joinedAt);
    if (Number.isNaN(t)) continue;
    const key = weekStart(new Date(t));
    if (buckets.has(key)) buckets.set(key, buckets.get(key)! + 1);
  }

  const within = (days: number) =>
    readers.filter((r) => {
      const t = Date.parse(r.joinedAt);
      return !Number.isNaN(t) && now - t <= days * DAY_MS;
    }).length;

  return {
    total: readers.length,
    verified: readers.filter((r) => r.verified).length,
    last7Days: within(7),
    last30Days: within(30),
    newestAt: sorted[0]?.joinedAt ?? null,
    perWeek: [...buckets].map(([week, count]) => ({ weekStart: week, count })),
    recent: sorted.slice(0, 12).map(toPublic),
  };
}
