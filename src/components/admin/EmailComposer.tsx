"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import type { Subscriber, Broadcast } from "@/lib/subscribers";

const inputCls =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";

type SendResult = {
  ok: boolean;
  via?: string;
  message?: string;
  mailto?: string;
  error?: string;
};

export function EmailComposer({
  subscribers,
  broadcasts,
  configured,
}: {
  subscribers: Subscriber[];
  broadcasts: Broadcast[];
  configured: boolean;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [showList, setShowList] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function sendTest() {
    if (!testTo.trim()) {
      setTestMsg({ ok: false, text: "Enter an address first." });
      return;
    }
    setTestBusy(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      const data = await res.json();
      setTestMsg({ ok: !!data.ok, text: data.ok ? data.message : data.error });
    } catch {
      setTestMsg({ ok: false, text: "Network error." });
    } finally {
      setTestBusy(false);
    }
  }

  async function send() {
    if (!subject.trim() || !body.trim()) {
      setResult({ ok: false, error: "Add a subject and a message first." });
      return;
    }
    if (
      !confirm(
        `Send “${subject}” to ${subscribers.length} subscriber${subscribers.length === 1 ? "" : "s"}?`,
      )
    )
      return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data: SendResult = await res.json();
      setResult(data);
      if (data.ok && data.via === "resend") router.refresh();
    } catch {
      setResult({ ok: false, error: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(email: string) {
    if (!confirm(`Remove ${email}?`)) return;
    await fetch("/api/subscribers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4">
        <div>
          <p className="text-sm font-medium text-ink">
            {subscribers.length} subscriber{subscribers.length === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-ink-muted">
            {configured
              ? "Resend is configured — messages send from your verified domain."
              : "Email not configured — you’ll get a mailto fallback to send from your mail app."}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            configured ? "bg-pos-soft text-pos" : "bg-warn-soft text-warn",
          )}
        >
          {configured ? "Resend ready" : "Fallback mode"}
        </span>
      </div>

      {/* Test email */}
      <div className="rounded-lg border border-line bg-surface p-4">
        <p className="text-sm font-medium text-ink">Send a test to yourself</p>
        <p className="text-xs text-ink-muted">
          Confirm your email settings work before emailing everyone.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="you@email.com"
            className={cn(inputCls, "flex-1")}
          />
          <button
            type="button"
            onClick={sendTest}
            disabled={testBusy}
            className={cn(
              "inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-sunken",
              testBusy && "cursor-not-allowed opacity-60",
            )}
          >
            {testBusy ? "Sending…" : "Send test"}
          </button>
        </div>
        {testMsg && (
          <p className={cn("mt-2 text-sm", testMsg.ok ? "text-pos" : "text-neg")}>
            {testMsg.text}
          </p>
        )}
      </div>

      {/* Subscriber list */}
      {subscribers.length > 0 && (
        <div className="rounded-lg border border-line bg-surface p-4">
          <button
            type="button"
            onClick={() => setShowList((v) => !v)}
            className="text-sm font-medium text-brand hover:underline"
          >
            {showList ? "Hide" : "Show"} subscriber list
          </button>
          {showList && (
            <ul className="mt-3 divide-y divide-line">
              {subscribers.map((s) => (
                <li key={s.email} className="flex items-center justify-between gap-3 py-2">
                  <span className="tnum text-sm text-ink">{s.email}</span>
                  <button
                    type="button"
                    onClick={() => remove(s.email)}
                    className="text-xs font-medium text-neg hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Composer */}
      <div className="space-y-4 rounded-lg border border-line bg-surface p-5">
        <label className="block">
          <span className="block text-sm font-medium text-ink">Subject</span>
          <input
            className={cn(inputCls, "mt-1.5")}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="New research: Colgate-Palmolive"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-ink">Message</span>
          <span className="block text-xs text-ink-muted">
            Markdown: **bold**, *italic*, [text](https://…). Blank line = new paragraph.
          </span>
          <textarea
            className={cn(inputCls, "mt-1.5 resize-y")}
            rows={9}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Just published my write-up on Colgate…\n\nRead it here: https://…"}
          />
        </label>

        {result && (
          <div
            className={cn(
              "rounded-md p-3 text-sm",
              result.ok ? "bg-pos-soft text-ink" : "bg-neg-soft text-ink",
            )}
          >
            <p>{result.ok ? result.message : result.error}</p>
            {result.mailto && (
              <a
                href={result.mailto}
                className="mt-2 inline-flex items-center rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-on-brand hover:bg-brand-hover"
              >
                Open in your mail app →
              </a>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-ink-muted">
            Sends to all {subscribers.length} subscriber
            {subscribers.length === 1 ? "" : "s"} at once.
          </p>
          <button
            type="button"
            onClick={send}
            disabled={busy || subscribers.length === 0}
            className={cn(
              "inline-flex h-10 items-center rounded-md bg-brand px-5 text-sm font-medium text-on-brand hover:bg-brand-hover",
              (busy || subscribers.length === 0) && "cursor-not-allowed opacity-60",
            )}
          >
            {busy ? "Sending…" : "Send to all"}
          </button>
        </div>
      </div>

      {/* History */}
      {broadcasts.length > 0 && (
        <div className="rounded-lg border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Recent sends</h2>
          <ul className="mt-3 divide-y divide-line">
            {broadcasts.slice(0, 8).map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-ink">{b.subject}</span>
                  <span className="ml-2 text-xs text-ink-muted">
                    {new Date(b.sentAt).toLocaleDateString()} · {b.recipients} recipients · {b.via}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
