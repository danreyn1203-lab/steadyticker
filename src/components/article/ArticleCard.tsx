import Link from "next/link";
import type { Article } from "@/lib/articles/types";
import { formatDateShort } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ArrowRight, Pencil } from "@/components/ui/icons";

export function ArticleCard({
  article,
  editable = false,
}: {
  article: Article;
  /** Show the author-only edit pencil. Pass `isAuthor()` from the page. */
  editable?: boolean;
}) {
  return (
    <Card as="article" hover className="relative h-full">
      {editable && (
        <Link
          href={`/journal/${article.slug}/edit`}
          aria-label={`Edit ${article.headline}`}
          title="Edit this article"
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-md border border-line-strong bg-surface text-ink-soft shadow-sm transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <Pencil width={14} height={14} />
        </Link>
      )}
      <Link
        href={`/journal/${article.slug}`}
        className="flex h-full flex-col p-6"
      >
        <div className="flex flex-wrap gap-1.5 pr-8">
          {(article.tickers ?? article.tags).slice(0, 3).map((t) => (
            <Badge key={t} tone="brand">
              {t}
            </Badge>
          ))}
        </div>
        <h3 className="mt-4 font-serif text-xl font-semibold leading-snug text-ink">
          {article.headline}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">
          {article.summary}
        </p>
        <div className="mt-5 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-muted">
          <span>
            {article.author} · {formatDateShort(article.publishedAt)}
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-brand">
            Read <ArrowRight width={13} height={13} />
          </span>
        </div>
      </Link>
    </Card>
  );
}
