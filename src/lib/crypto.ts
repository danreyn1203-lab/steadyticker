import "server-only";

/**
 * Crypto primitives built on the Web Crypto API (`globalThis.crypto`) rather
 * than node:crypto. Web Crypto behaves identically in Node 18+ and in the
 * Cloudflare Workers runtime, so the same code runs in `next dev` and on the
 * deployed Worker — and testing locally genuinely validates the Worker path.
 * node:crypto's scrypt and createHmac are NOT guaranteed on Workers, which is
 * why everything auth-related funnels through here.
 *
 * Interop note: HMAC-SHA256 here is byte-identical to node's
 * createHmac("sha256").digest(), so session cookies signed by the old code
 * still verify. Password hashing moves from scrypt to PBKDF2 (scrypt has no
 * Web Crypto equivalent) — a different hash format, which only matters for a
 * fresh account store.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// --- base64url (no Buffer; btoa/atob exist in Node and Workers) ------------

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(input: string): Uint8Array {
  const pad = (4 - (input.length % 4)) % 4;
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** base64url-encode a UTF-8 string. */
export function b64urlEncode(input: string): string {
  return bytesToB64url(encoder.encode(input));
}

/** Decode a base64url string back to its UTF-8 text. */
export function b64urlDecodeToString(input: string): string {
  return decoder.decode(b64urlToBytes(input));
}

// --- hex -------------------------------------------------------------------

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// --- randomness ------------------------------------------------------------

/** A v4 UUID. */
export function randomUUID(): string {
  return crypto.randomUUID();
}

/** `nBytes` of cryptographically-strong randomness, hex-encoded. */
export function randomHex(nBytes: number): string {
  const b = new Uint8Array(nBytes);
  crypto.getRandomValues(b);
  return bytesToHex(b);
}

/** A uniform random integer in [0, max), without modulo bias. */
export function randomIntBelow(max: number): number {
  if (!Number.isInteger(max) || max <= 0 || max > 0xffffffff) {
    throw new RangeError("max must be an integer in (0, 2^32]");
  }
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % max;
}

// --- HMAC-SHA256 -----------------------------------------------------------

async function hmac(key: string, payload: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(payload));
  return new Uint8Array(sig);
}

/** HMAC-SHA256(key, payload) as base64url — matches the old cookie signatures. */
export async function hmacSha256B64url(key: string, payload: string): Promise<string> {
  return bytesToB64url(await hmac(key, payload));
}

/** HMAC-SHA256(key, payload) as hex. */
export async function hmacSha256Hex(key: string, payload: string): Promise<string> {
  return bytesToHex(await hmac(key, payload));
}

// --- password hashing (PBKDF2) ---------------------------------------------

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_BYTES = 64;

/** Derive a password hash (hex) from a password and a hex salt, via PBKDF2. */
export async function pbkdf2Hex(password: string, saltHex: string): Promise<string> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    PBKDF2_KEY_BYTES * 8,
  );
  return bytesToHex(new Uint8Array(bits));
}

// --- constant-time comparison ----------------------------------------------

/**
 * Constant-time equality for two strings of the same character set (hex,
 * base64url, ASCII). Returns false immediately on a length mismatch, matching
 * the old `a.length === b.length && timingSafeEqual(a, b)` guards.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
