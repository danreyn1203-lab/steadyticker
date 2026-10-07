import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthor } from "@/lib/auth";
import { getSubscribers, getBroadcasts } from "@/lib/subscribers";
import { emailConfigured } from "@/lib/email";
import { Container } from "@/components/layout/Container";
import { EmailComposer } from "@/components/admin/EmailComposer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Email",
  robots: { index: false, follow: false },
};

export default async function AdminEmailPage() {
  if (!(await isAuthor())) redirect("/admin");

  const [subscribers, broadcasts] = await Promise.all([
    getSubscribers(),
    getBroadcasts(),
  ]);

  return (
    <Container className="max-w-3xl py-10">
      <Link href="/admin" className="text-sm font-medium text-ink-soft hover:text-ink">
        ← Back to dashboard
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-ink">
        Subscribers &amp; email
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        Send one message to everyone at once. Sending uses your own Resend account
        (set in <code className="rounded bg-surface-sunken px-1">.env.local</code>).
        If it isn’t configured, you’ll get a ready-to-send email in your mail app
        instead.
      </p>
      <div className="mt-8">
        <EmailComposer
          subscribers={subscribers}
          broadcasts={broadcasts}
          configured={emailConfigured()}
        />
      </div>
    </Container>
  );
}
