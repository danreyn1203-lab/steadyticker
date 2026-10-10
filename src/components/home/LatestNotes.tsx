import { getAllArticles } from "@/lib/articles/store";
import { isAuthor } from "@/lib/auth";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ArticleCard } from "@/components/article/ArticleCard";
import { Button } from "@/components/ui/Button";
import { ArrowRight } from "@/components/ui/icons";

export async function LatestNotes() {
  const [articles, author] = await Promise.all([getAllArticles(), isAuthor()]);
  if (articles.length === 0) return null;

  return (
    <section>
      <SectionHeading
        eyebrow="Research notes"
        title="The full write-ups"
        description="Long-form, sourced research — the whole thesis, the charts, and the risks in one place."
        action={
          <Button href="/journal" variant="secondary" size="sm">
            View journal
            <ArrowRight width={15} height={15} />
          </Button>
        }
      />
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {articles.slice(0, 3).map((a) => (
          <ArticleCard key={a.slug} article={a} editable={author} />
        ))}
      </div>
    </section>
  );
}
