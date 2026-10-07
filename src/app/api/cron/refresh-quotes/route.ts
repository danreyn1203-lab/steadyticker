import { NextResponse } from "next/server";
import { constantTimeEqual } from "@/lib/crypto";
import { isAuthor } from "@/lib/auth";
import { TRACKED_TICKERS } from "@/lib/holdings";
import { getFeatured } from "@/lib/articles/featured";
import { refreshQuotes } from "@/lib/quotes";

export const dynamic = "force-dynamic";

/**
 * Daily price refresh hook.
 *
 * Nothing *needs* to call this: src/lib/quotes.ts refreshes on demand the
 * first time a page renders after its 6-hour TTL expires. This route exists so
 * a scheduler (a Vercel cron, a GitHub Action, `curl` from launchd) can warm
 * the cache at a predictable time each morning instead.
 *
 * Auth: a `CRON_SECRET` bearer token if one is configured, or a signed-in
 * author. Never open — an open refresh endpoint is a free way to get the site
 * rate-limited upstream.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const presented = request.headers.get("authorization") ?? "";
  const bearerOk = Boolean(secret) && safeEqual(presented, `Bearer ${secret}`);

  if (!bearerOk && !(await isAuthor())) {
    return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 401 });
  }

  // The homepage spotlight ticker is editable, so pull it in at refresh time.
  const featured = await getFeatured();
  const tickers = Array.from(
    new Set([
      ...TRACKED_TICKERS,
      ...(featured?.ticker ? [featured.ticker.toUpperCase()] : []),
    ]),
  );
  const quotes = await refreshQuotes(tickers);
  return NextResponse.json({
    ok: true,
    refreshed: quotes.map((q) => ({
      ticker: q.ticker,
      price: q.price,
      asOf: q.asOf,
    })),
    failed: tickers.filter(
      (t) => !quotes.some((q) => q.ticker === t.toUpperCase()),
    ),
  });
}

function safeEqual(a: string, b: string): boolean {
  return constantTimeEqual(a, b);
}
