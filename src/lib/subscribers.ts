import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Email subscription store + broadcast history. Local JSON (no external DB).
 * Subscribers are captured from the public form; broadcasts are composed and
 * sent from the author dashboard. Actual sending uses an email provider when
 * configured (see src/lib/email.ts) — this file only stores data.
 */

export interface Subscriber {
  email: string;
  subscribedAt: string;
}

export interface Broadcast {
  id: string;
  sentAt: string;
  subject: string;
  body: string;
  recipients: number;
  via: string; // "resend" | "mailto" | "none"
}

const SUBS = path.join(process.cwd(), "src", "content", "subscribers.json");
const CASTS = path.join(process.cwd(), "src", "content", "broadcasts.json");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 254;
}

export async function getSubscribers(): Promise<Subscriber[]> {
  try {
    const data = JSON.parse(await fs.readFile(SUBS, "utf8"));
    return Array.isArray(data.subscribers) ? data.subscribers : [];
  } catch {
    return [];
  }
}

async function writeSubscribers(subs: Subscriber[]): Promise<void> {
  await fs.writeFile(SUBS, JSON.stringify({ subscribers: subs }, null, 2), "utf8");
}

export async function addSubscriber(
  emailRaw: string,
): Promise<{ ok: boolean; already?: boolean; error?: string }> {
  const email = emailRaw.trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: "That doesn’t look like a valid email." };
  const subs = await getSubscribers();
  if (subs.some((s) => s.email === email)) return { ok: true, already: true };
  subs.push({ email, subscribedAt: new Date().toISOString() });
  await writeSubscribers(subs);
  return { ok: true };
}

export async function removeSubscriber(emailRaw: string): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  const subs = await getSubscribers();
  await writeSubscribers(subs.filter((s) => s.email !== email));
}

export async function getBroadcasts(): Promise<Broadcast[]> {
  try {
    const data = JSON.parse(await fs.readFile(CASTS, "utf8"));
    return Array.isArray(data.broadcasts) ? data.broadcasts : [];
  } catch {
    return [];
  }
}

export async function addBroadcast(
  b: Omit<Broadcast, "id" | "sentAt">,
): Promise<Broadcast> {
  const broadcasts = await getBroadcasts();
  const entry: Broadcast = { ...b, id: randomUUID(), sentAt: new Date().toISOString() };
  broadcasts.unshift(entry);
  await fs.writeFile(
    CASTS,
    JSON.stringify({ broadcasts: broadcasts.slice(0, 100) }, null, 2),
    "utf8",
  );
  return entry;
}
