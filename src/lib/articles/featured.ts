import "server-only";
import { promises as fs } from "fs";
import path from "path";
import featuredFallback from "@/content/featured.json";
import { isReadOnlyRuntime } from "@/lib/kv";

/**
 * "This week's closest look" — a single editable spotlight shown on the
 * homepage. Stored as JSON so the author can edit it from /admin, same as
 * articles. Separate from the demo discovery data.
 */
export interface Featured {
  eyebrow: string;
  ticker: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
  /** Fallback price, shown only when the live quote sources (src/lib/quotes.ts) can't price `ticker`. */
  price: number;
  currency?: string;
  /** Fallback price note, shown with the fallback price. */
  priceNote?: string;
  whyWatching: string; // markdown
  tags: string[];
  catalystLabel?: string;
  catalyst?: string; // markdown
  owns: boolean;
  positionNote?: string;
  note?: string; // e.g. "Full write-up coming soon"
  ctaHref?: string;
  ctaLabel?: string;
  disclaimer?: string;
}

const FILE = path.join(process.cwd(), "src", "content", "featured.json");

export async function getFeatured(): Promise<Featured | null> {
  // Filesystem first (fresh local edits), static import as the Workers fallback.
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Featured;
  } catch {
    return (featuredFallback as Featured) ?? null;
  }
}

export async function saveFeatured(data: Featured): Promise<void> {
  if (isReadOnlyRuntime()) {
    throw new Error(
      "Editing is only available locally (npm run dev); the published site is read-only.",
    );
  }
  if (!data.ticker || !data.name || !data.whyWatching) {
    throw new Error("Featured spotlight needs at least a ticker, name and thesis.");
  }
  await fs.writeFile(FILE, JSON.stringify(data, null, 2), "utf8");
}
