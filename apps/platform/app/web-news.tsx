"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type NewsConfig } from "./lib/api";

const PUBLIC_SITE =
  (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ?? "https://www.netballamericas.org").replace(/\/+$/, "");

const input =
  "enterprise-input w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm text-ink";
const label =
  "mb-1 block font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-ink-muted";
const panel = "enterprise-panel";
const primary =
  "enterprise-button inline-flex items-center justify-center rounded-lg bg-gold px-4 py-2 text-sm font-bold text-navy-deep disabled:opacity-50";
const ghost =
  "enterprise-button inline-flex items-center justify-center rounded-lg border border-line-strong bg-white px-3 py-2 text-sm font-semibold text-ink-soft disabled:opacity-50";

type Draft = {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  imageUrl: string;
  published: boolean;
};

const emptyDraft: Draft = {
  slug: "",
  title: "",
  summary: "",
  body: "",
  imageUrl: "",
  published: true,
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function WebNews() {
  const [articles, setArticles] = useState<NewsConfig[] | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setArticles(await api.newsArticles());
  }, []);

  useEffect(() => {
    void load().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : "Website news could not load."),
    );
  }, [load]);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  function reset() {
    setDraft(emptyDraft);
    setImageFile(null);
    setSlugTouched(false);
  }

  function edit(article: NewsConfig) {
    setDraft({
      id: article.id,
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      body: article.body ?? "",
      imageUrl: article.imageUrl ?? "",
      published: article.published,
    });
    setImageFile(null);
    setSlugTouched(true);
    setError(null);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const slug = slugify(draft.slug || draft.title);
    if (!slug) {
      setError("Enter a title or web address slug.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const shouldPublish = draft.published;
      let saved = await api.saveNews({
        id: draft.id,
        slug,
        title: draft.title.trim(),
        summary: draft.summary.trim(),
        body: draft.body.trim() || null,
        imageUrl: draft.imageUrl || null,
        published: imageFile ? false : shouldPublish,
      });
      if (imageFile) {
        saved = await api.uploadNewsImage(saved.id, imageFile);
        if (shouldPublish) {
          saved = await api.saveNews({
            id: saved.id,
            slug: saved.slug,
            title: saved.title,
            summary: saved.summary,
            body: saved.body,
            imageUrl: saved.imageUrl,
            published: true,
          });
        }
      }
      setNotice(
        saved.published
          ? saved.title + " is published in the website newsroom."
          : saved.title + " was saved as a draft.",
      );
      reset();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The news article could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(article: NewsConfig) {
    if (!window.confirm("Delete " + article.title + " and its image?")) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteNews(article.id);
      if (draft.id === article.id) reset();
      setNotice(article.title + " was removed.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The news article could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={label}>Public communications</p>
          <h1 className="font-display text-3xl font-bold text-ink">Website News</h1>
          <p className="mt-2 max-w-3xl text-sm text-ink-muted">
            Create official tournament updates for the Latest section of the public website.
          </p>
        </div>
        <a
          href={`${PUBLIC_SITE}/#news`}
          target="_blank"
          rel="noreferrer"
          className={ghost}
        >
          Preview website newsroom
        </a>
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-bad-line bg-bad-soft p-3 text-sm text-bad">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl border border-ok-line bg-ok-soft p-3 text-sm text-ok">
          {notice}
        </p>
      )}

      <form onSubmit={save} className={panel + " space-y-5 p-5 sm:p-6"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">
              {draft.id ? "Edit news article" : "Create news article"}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Published articles appear in Latest within 30 seconds.
            </p>
          </div>
          {draft.id && (
            <button type="button" className={ghost} onClick={reset}>
              Cancel editing
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className={label}>Headline</span>
            <input
              className={input}
              required
              minLength={3}
              value={draft.title}
              onChange={(event) => {
                const title = event.target.value;
                setDraft({
                  ...draft,
                  title,
                  slug: slugTouched ? draft.slug : slugify(title),
                });
              }}
              placeholder="Tournament announcement"
            />
          </label>
          <label className="md:col-span-2">
            <span className={label}>Web address</span>
            <div className="flex items-center rounded-lg border border-line-strong bg-white">
              <span className="pl-3 text-sm text-ink-muted">/news/</span>
              <input
                className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-ink outline-none"
                required
                value={draft.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setDraft({ ...draft, slug: slugify(event.target.value) });
                }}
              />
            </div>
          </label>
          <label className="md:col-span-2">
            <span className={label}>Card summary</span>
            <textarea
              className={input}
              required
              minLength={3}
              rows={3}
              value={draft.summary}
              onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
              placeholder="A short public summary for the Latest card."
            />
          </label>
          <label className="md:col-span-2">
            <span className={label}>Full update (optional)</span>
            <textarea
              className={input}
              rows={7}
              value={draft.body}
              onChange={(event) => setDraft({ ...draft, body: event.target.value })}
              placeholder="Full announcement or media update."
            />
          </label>
        </div>

        <div>
          <p className={label}>News image</p>
          <p className="mb-3 text-sm text-ink-muted">
            Recommended: 1200 × 750 px. JPEG, PNG and WebP are normalized automatically.
          </p>
          <label className="group block cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-gold bg-white transition hover:border-navy focus-within:ring-2 focus-within:ring-gold">
            {(previewUrl || (draft.published && draft.imageUrl)) && (
              <div className="flex h-64 items-center justify-center bg-navy-deep p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl ?? draft.imageUrl}
                  alt="News image preview"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}
            <div className="flex items-center gap-4 p-4 group-hover:bg-gold/10">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-navy text-xl text-gold">
                ↑
              </span>
              <span>
                <span className="block text-sm font-bold text-ink">
                  {imageFile ? "Replace news image" : "Choose news image"}
                </span>
                <span className="mt-1 block text-xs text-ink-muted">
                  {imageFile ? "Ready to upload: " + imageFile.name : "Select an image from this computer"}
                </span>
              </span>
            </div>
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
            />
          </label>
          {draft.imageUrl && !draft.published && !imageFile && (
            <p className="mt-2 text-xs text-ink-muted">
              This draft already has a stored image. It becomes publicly visible only when published.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-line pt-5">
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(event) => setDraft({ ...draft, published: event.target.checked })}
            />
            {draft.published ? "Publish article immediately" : "Keep as draft"}
          </label>
          <button className={primary} disabled={busy}>
            {busy
              ? "Saving…"
              : draft.published
                ? draft.id
                  ? "Save & publish changes"
                  : "Publish article"
                : "Save draft"}
          </button>
        </div>
      </form>

      <section>
        <h2 className={label}>Managed news articles ({articles?.length ?? 0})</h2>
        <div className={panel + " divide-y divide-line"}>
          {articles === null ? (
            <p className="p-5 text-sm text-ink-muted">Loading website news…</p>
          ) : articles.length === 0 ? (
            <p className="p-5 text-sm text-ink-muted">
              No articles yet. Create the first official update above.
            </p>
          ) : (
            articles.map((article) => (
              <article
                key={article.id}
                className="grid gap-4 p-5 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-lg border border-line bg-navy-deep">
                  {article.imageUrl && article.published ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={article.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="px-2 text-center text-xs text-white/55">
                      {article.imageUrl ? "Draft image stored" : "No image"}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-bold text-ink">{article.title}</h3>
                    <span className={article.published ? "rounded-full bg-ok-soft px-2 py-1 text-xs font-bold text-ok" : "rounded-full bg-bg-soft px-2 py-1 text-xs font-bold text-ink-muted"}>
                      {article.published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{article.summary}</p>
                  <p className="mt-2 font-mono text-[0.65rem] text-ink-muted">
                    /news/{article.slug}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={ghost} onClick={() => edit(article)} disabled={busy}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className={ghost + " text-bad"}
                    onClick={() => void remove(article)}
                    disabled={busy}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
