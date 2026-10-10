import Link from "next/link";
import { Container } from "./Container";
import { site } from "@/lib/site";

const sourceCategories = [
  "SEC EDGAR / company filings",
  "Company investor relations",
  "Official earnings releases",
  "Reputable financial data providers",
  "Professional research",
  "Industry sources",
];

/** A mailto: link with a ready-made subject + body — no account or send on our end. */
function advertiseMailto(): string {
  const subject = `Advertising on ${site.name}`;
  const body = [
    `Hi ${site.author},`,
    "",
    "I'm interested in advertising on your site. Here are the details:",
    "",
    "Company/brand:",
    "What you'd like to advertise:",
    "Budget / timeframe:",
    "",
    "Thanks!",
  ].join("\n");
  return `mailto:${site.advertiseEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-on-brand font-serif text-base">
                {site.name.charAt(0)}
              </span>
              <span className="font-serif text-lg font-semibold text-ink">
                {site.name}
              </span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
              {site.tagline} Free research, radical transparency, no hype. Every
              factual claim is tied to a source.
            </p>
          </div>

          <div>
            <h3 className="eyebrow mb-3">Explore</h3>
            <ul className="space-y-2 text-sm">
              {[
                ["Discover", "/"],
                ["Journal", "/journal"],
                ["Methodology", "/methodology"],
                ["Portfolio", "/portfolio"],
                ["About", "/about"],
                ["Sign up", "/signup"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-ink-soft transition-colors hover:text-ink"
                  >
                    {label}
                  </Link>
                </li>
              ))}
              {site.advertiseEmail && (
                <li>
                  <a
                    href={advertiseMailto()}
                    className="text-ink-soft transition-colors hover:text-ink"
                  >
                    Advertise
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="eyebrow mb-3">Where research comes from</h3>
            <ul className="space-y-2 text-sm text-ink-soft">
              {sourceCategories.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-line pt-6">
          <p className="text-xs leading-relaxed text-ink-muted">
            <strong className="font-semibold text-ink-soft">Disclaimer.</strong>{" "}
            {site.name} is an independent research project for educational and
            informational purposes only. Nothing here is investment advice, a
            recommendation, or an offer to buy or sell any security. Ratings and
            research signals are the author&rsquo;s own judgment — they do not
            predict returns. Ownership disclosures reflect personal conviction,
            not a forecast. Figures are dated and sourced, but can change — always
            verify against the primary source and do your own research.
          </p>
          <p className="mt-4 text-xs text-ink-muted">
            © {new Date().getFullYear()} {site.name}. Built as an independent
            project.
          </p>
        </div>
      </Container>
    </footer>
  );
}
