import type { Metadata } from "next";
import Link from "next/link";
import { getAllArticles } from "@/lib/articles/store";
import { isAuthor } from "@/lib/auth";
import { Container } from "@/components/layout/Container";
import { ArticleCard } from "@/components/article/ArticleCard";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Journal",
  description: "Long-form, sourced research write-ups — the full thesis behind each idea.",
};

export default async function JournalPage() {
  const [articles, author] = await Promise.all([getAllArticles(), isAuthor()]);

  return (
    <Container className="py-14 sm:py-20">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">Research journal</p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-ink">
            Research notes
          </h1>
          <p className="mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-ink-soft">
            Full write-ups — the whole thesis, the evidence, the charts, and the
            risks. Every factual claim is tied to a source you can open.
          </p>
        </div>
        {author && (
          <Link
            href="/admin"
            className="shrink-0 text-sm font-medium text-brand hover:underline"
          >
            Author tools →
          </Link>
        )}
      </div>

      {articles.length === 0 ? (
        <div className="mt-10 rounded-lg border border-line bg-surface p-12 text-center">
          <p className="text-ink-soft">No research notes have been published yet.</p>
          <Button href="/" className="mt-6">
            Back to Discover
          </Button>
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <ArticleCard key={a.slug} article={a} editable={author} />
          ))}
        </div>
      )}
    </Container>
  );
}
