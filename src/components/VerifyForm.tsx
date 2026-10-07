"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * Enter the 6-digit code that was emailed. The account to verify is held in a
 * server-side pending cookie, so this form only needs the code. (In local dev
 * without an email provider the code is printed to the server console by the API.)
 */
export function VerifyForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the code field on mount (DOM side effect only — no state change).
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/reader/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push("/profile");
        router.refresh();
        return;
      }
      if (data.expired) {
        setError("Your verification window expired. Please sign in again to get a new code.");
      } else {
        setError(data.error || "That didn’t work.");
      }
    } catch {
      setError("Network error — try again.");
    }
    setBusy(false);
  }

  async function resend() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/reader/resend", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setNotice(
          data.sent
            ? "Sent — check your inbox for a new code."
            : "A new code was generated.",
        );
      } else {
        setError(data.error || "Couldn’t resend.");
      }
    } catch {
      setError("Network error — try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} noValidate>
      {email && (
        <p className="text-sm text-ink-soft">
          We sent a 6-digit code to{" "}
          <span className="font-medium text-ink">{email}</span>. Enter it below —
          it expires in 15 minutes.
        </p>
      )}

      <label htmlFor="verify-code" className="mt-5 block text-sm font-medium text-ink">
        Verification code
      </label>
      <input
        id="verify-code"
        ref={inputRef}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="123456"
        className="tnum mt-2 h-14 w-full rounded-md border border-line-strong bg-surface px-3 text-center text-2xl tracking-[0.5em] text-ink outline-none focus:border-brand"
      />

      {error && <p className="mt-3 text-sm text-neg">{error}</p>}
      {notice && <p className="mt-3 text-sm text-pos">{notice}</p>}

      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className={cn(
          "mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-brand px-5 text-[0.95rem] font-medium text-on-brand transition-colors hover:bg-brand-hover",
          (busy || code.length !== 6) && "cursor-not-allowed opacity-60",
        )}
      >
        {busy ? "Checking…" : "Confirm & finish"}
      </button>

      <button
        type="button"
        onClick={resend}
        disabled={busy}
        className="mt-3 w-full text-center text-sm font-medium text-ink-soft hover:text-ink disabled:opacity-60"
      >
        Didn’t get it? Resend the code
      </button>
    </form>
  );
}
