/**
 * Central site + brand configuration.
 * Everything a rename would touch lives here — change the name in ONE place.
 */

export const site = {
  name: "SteadyTicker",
  tagline: "Independent research, in the open.",
  description:
    "Independent, transparent research on companies with interesting growth opportunities, unusual competitive advantages, and potentially overlooked fundamentals.",
  author: "Daniel Reynolds",
  /** Global "sample data" banner. Off now that the site runs on real research. */
  demo: false,
  /** Public base URL — drives canonical links, sitemap, and Open Graph. */
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://steadyticker.com",
  /**
   * Where the footer "Advertise" link drafts an email to. Not a secret — a
   * mailto address is visible in the page source to any visitor anyway — but
   * it's an env var rather than hard-coded so it's one line to set per
   * environment. The link only renders once this is non-empty (see
   * SiteFooter), so an unset value just hides the feature rather than
   * pointing at nothing.
   */
  advertiseEmail: process.env.NEXT_PUBLIC_ADVERTISE_EMAIL || "",
} as const;

export interface NavItem {
  label: string;
  href: string;
}

export const primaryNav: NavItem[] = [
  { label: "Discover", href: "/" },
  { label: "Journal", href: "/journal" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "About", href: "/about" },
];
