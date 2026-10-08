import "server-only";
import { renderParagraphs } from "./markdown";
import { site } from "./site";

/**
 * Email sending over Resend's HTTP API — a single `fetch` POST, no SMTP and no
 * SDK, so the exact same code runs locally (`npm run dev`) and on Cloudflare
 * Workers (which cannot open SMTP sockets). Credentials come from environment
 * variables, never hard-coded:
 *   RESEND_API_KEY  — from https://resend.com/api-keys
 *   NEWSLETTER_FROM — a verified sender, e.g. "SteadyTicker <hello@your-domain>"
 *                     (use "onboarding@resend.dev" to test before a domain is
 *                     verified — Resend only delivers that to your own address)
 * If either is unset, sending is disabled: the newsletter offers a mailto BCC
 * fallback and verification codes print to the server console (see
 * readerDelivery.ts). Newsletter sends are only ever triggered by the author
 * from /admin.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.NEWSLETTER_FROM);
}

/**
 * Post a single message to Resend. Never throws — returns ok:false with a
 * human-readable reason so every caller can degrade gracefully.
 */
async function resendSend(msg: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NEWSLETTER_FROM;
  if (!key || !from) return { ok: false, error: "Email not configured" };
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
      }),
    });
    if (!res.ok) {
      // Resend returns { name, message } on error; surface the message.
      let detail = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { message?: string };
        if (body?.message) detail = body.message;
      } catch {
        /* non-JSON body — keep the status code */
      }
      return { ok: false, error: detail };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** Small pause so a batch of sends stays under Resend's rate limit. */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Wrap the author's markdown body in a simple, readable HTML email. */
export function renderEmailHtml(subject: string, bodyMarkdown: string): string {
  const paras = renderParagraphs(bodyMarkdown)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p}</p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f4f2ec;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#fffefb;border:1px solid #e8e4db;border-radius:14px;padding:28px;font-family:Georgia,'Times New Roman',serif;color:#1b1a17">
    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8b867b;font-family:Arial,sans-serif">${site.name}</div>
    <h1 style="font-size:22px;margin:8px 0 18px;line-height:1.25">${escapeHtml(subject)}</h1>
    ${paras}
    <hr style="border:none;border-top:1px solid #e8e4db;margin:24px 0"/>
    <p style="font-size:12px;color:#8b867b;font-family:Arial,sans-serif;line-height:1.5">
      You’re getting this because you subscribed to ${site.name}. Independent, educational research — not investment advice.
      To unsubscribe, just reply with “unsubscribe”.
    </p>
  </div></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Send one personal email per recipient (each gets their own `to`, never a
 * shared thread). Returns per-recipient tallies. Sent sequentially with a small
 * pause to respect Resend's default 2-requests/second limit; the newsletter
 * runs from the author's local machine, so this is never on a Worker's clock.
 */
export async function sendToAll(
  recipients: string[],
  subject: string,
  html: string,
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (let i = 0; i < recipients.length; i++) {
    const to = recipients[i];
    const res = await resendSend({ to, subject, html });
    if (res.ok) {
      sent++;
    } else {
      failed++;
      errors.push(`${to}: ${res.error ?? "failed"}`);
    }
    if (i < recipients.length - 1) await sleep(600);
  }
  return { sent, failed, errors };
}

/** Fallback for when email isn't configured: a mailto link that BCCs everyone. */
export function buildMailtoBcc(
  recipients: string[],
  subject: string,
  bodyMarkdown: string,
): string {
  const bcc = recipients.join(",");
  const params = new URLSearchParams({ bcc, subject, body: bodyMarkdown });
  return `mailto:?${params.toString()}`;
}

/** The verification-code email shown to a new reader. Plain, branded, no links. */
export function renderVerificationHtml(firstName: string, code: string): string {
  const name = escapeHtml(firstName || "there");
  return `<!doctype html><html><body style="margin:0;background:#f4f2ec;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#fffefb;border:1px solid #e8e4db;border-radius:14px;padding:28px;font-family:Georgia,'Times New Roman',serif;color:#1b1a17">
    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8b867b;font-family:Arial,sans-serif">${site.name}</div>
    <h1 style="font-size:22px;margin:8px 0 14px;line-height:1.25">Confirm your email</h1>
    <p style="margin:0 0 16px;line-height:1.6">Hi ${name}, here is your verification code:</p>
    <div style="margin:0 0 18px;font-family:'SFMono-Regular',Consolas,monospace;font-size:34px;letter-spacing:10px;font-weight:700;color:#22415c;background:#f4f2ec;border:1px solid #e8e4db;border-radius:10px;padding:16px 10px;text-align:center">${escapeHtml(
      code,
    )}</div>
    <p style="margin:0 0 16px;line-height:1.6;font-family:Arial,sans-serif;font-size:14px;color:#57534b">
      Enter it on the sign-up page to finish creating your account. It expires in 15 minutes.
      If you didn’t try to sign up for ${site.name}, you can ignore this email — no account is created until the code is used.
    </p>
    <hr style="border:none;border-top:1px solid #e8e4db;margin:24px 0"/>
    <p style="font-size:12px;color:#8b867b;font-family:Arial,sans-serif;line-height:1.5">
      ${site.name} — independent, educational research. Not investment advice.
    </p>
  </div></body></html>`;
}

/**
 * Email a single verification code via Resend. Mirrors the newsletter sender.
 * Returns ok:false (never throws) so the caller can fall back to logging the
 * code in development.
 */
export async function sendVerificationCode(
  to: string,
  firstName: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: "Email not configured" };
  return resendSend({
    to,
    subject: `Your ${site.name} verification code: ${code}`,
    html: renderVerificationHtml(firstName, code),
  });
}
