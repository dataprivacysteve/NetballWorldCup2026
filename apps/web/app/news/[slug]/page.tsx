import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "../../components/Header";
import { publicApi } from "../../lib/api";

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await publicApi.newsArticle(slug);
  return article
    ? { title: article.title + " · Netball Americas", description: article.summary }
    : { title: "News article · Netball Americas" };
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [article, tournament, experience] = await Promise.all([
    publicApi.newsArticle(slug),
    publicApi.tournament(),
    publicApi.experience(),
  ]);
  if (!article) notFound();

  const published = article.publishedAt
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "America/Barbados",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(article.publishedAt))
    : "Official update";

  return (
    <>
      <Header
        logoSrc={tournament?.brandReverseLogoUrl}
        shopUrl={experience?.merchandiseUrl}
      />
      <main className="news-detail">
        <div className="wrap">
          <a className="news-back" href="/#news">
            ← Back to Latest
          </a>
          <article className="news-detail-card">
            {article.imageUrl && (
              <div className="news-detail-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={article.imageUrl} alt="" />
              </div>
            )}
            <div className="news-detail-body">
              <p className="news-kicker">Tournament newsroom</p>
              <h1 className="disp">{article.title}</h1>
              <p className="news-date">{published}</p>
              <p className="news-summary">{article.summary}</p>
              {article.body && (
                <div className="news-copy">
                  {article.body.split(/\n{2,}/).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              )}
            </div>
          </article>
        </div>
      </main>
    </>
  );
}
