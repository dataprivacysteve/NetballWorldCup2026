"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  api,
  type NewsConfig,
  type PublicExperienceConfig,
  type SponsorConfig,
} from "../../lib/api";

const blankExperience: Omit<PublicExperienceConfig, "tournamentId" | "updatedAt"> = {
  heroImageUrl: null,
  heroStrapline: null,
  ticketsUrl: null,
  merchandiseUrl: null,
  merchandiseImageUrl: null,
  aboutText: null,
  contactEmail: null,
  delayedUpdatesMessage: "Live updates are temporarily delayed.",
};

export default function PublicControlPage() {
  const [experience, setExperience] = useState(blankExperience);
  const [sponsors, setSponsors] = useState<SponsorConfig[]>([]);
  const [news, setNews] = useState<NewsConfig[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [me, data] = await Promise.all([api.me(), api.publicExperience()]);
    if (me?.user?.platformRole !== "sportsbb_admin") return window.location.replace("/control");
    const configured = data.experience;
    setExperience(configured ? {
      heroImageUrl: configured.heroImageUrl,
      heroStrapline: configured.heroStrapline,
      ticketsUrl: configured.ticketsUrl,
      merchandiseUrl: configured.merchandiseUrl,
      merchandiseImageUrl: configured.merchandiseImageUrl,
      aboutText: configured.aboutText,
      contactEmail: configured.contactEmail,
      delayedUpdatesMessage: configured.delayedUpdatesMessage,
    } : blankExperience);
    setSponsors(data.sponsors);
    setNews(data.news);
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(
      () => void load().catch((reason: unknown) => setError((reason as Error).message)),
      0,
    );
    return () => window.clearTimeout(initial);
  }, [load]);

  async function saveExperience(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api.updatePublicExperience(experience);
      setNotice("Public experience configuration saved.");
      await load();
    } catch (reason) { setError((reason as Error).message); }
  }

  return <main className="min-h-screen bg-bg px-5 py-8 text-ink"><div className="mx-auto max-w-6xl">
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-navy">Module 12 · Public experience</p><h1 className="mt-1 font-display text-4xl font-bold">Tournament publishing</h1><p className="mt-2 text-sm text-ink-muted">Configure content and destinations without changing page code. Tournament logos remain governed by the main event configuration.</p></div><Link href="/control" className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-navy">Back to control plane</Link></div>
    {error && <p role="alert" className="mb-5 rounded-xl border border-bad-line bg-bad-soft p-3 text-sm text-bad">{error}</p>}{notice && <p role="status" className="mb-5 rounded-xl border border-ok-line bg-ok-soft p-3 text-sm text-ok">{notice}</p>}
    <form onSubmit={saveExperience} className="enterprise-panel grid gap-4 p-6 md:grid-cols-2">
      <h2 className="font-display text-2xl font-bold md:col-span-2">Experience and destinations</h2>
      <Field label="Hero image URL" value={experience.heroImageUrl ?? ""} onChange={(heroImageUrl) => setExperience({ ...experience, heroImageUrl })} />
      <Field label="Hero strapline" value={experience.heroStrapline ?? ""} onChange={(heroStrapline) => setExperience({ ...experience, heroStrapline })} />
      <Field label="Ticket destination" value={experience.ticketsUrl ?? ""} onChange={(ticketsUrl) => setExperience({ ...experience, ticketsUrl })} />
      <Field label="Merchandise destination" value={experience.merchandiseUrl ?? ""} onChange={(merchandiseUrl) => setExperience({ ...experience, merchandiseUrl })} />
      <Field label="Merchandise image URL" value={experience.merchandiseImageUrl ?? ""} onChange={(merchandiseImageUrl) => setExperience({ ...experience, merchandiseImageUrl })} />
      <Field label="Public contact email" value={experience.contactEmail ?? ""} onChange={(contactEmail) => setExperience({ ...experience, contactEmail })} />
      <label className="block text-sm font-semibold md:col-span-2">About the qualifier<textarea className="enterprise-input mt-1 min-h-28 w-full" value={experience.aboutText ?? ""} onChange={(event) => setExperience({ ...experience, aboutText: event.target.value })} /></label>
      <Field label="Delayed live-update message" value={experience.delayedUpdatesMessage} onChange={(delayedUpdatesMessage) => setExperience({ ...experience, delayedUpdatesMessage })} wide />
      <button className="enterprise-button w-fit rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white md:col-span-2">Save public configuration</button>
    </form>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><SponsorManager rows={sponsors} reload={load} /><NewsManager rows={news} reload={load} /></div>
  </div></main>;
}

function SponsorManager({ rows, reload }: { rows: SponsorConfig[]; reload: () => Promise<void> }) {
  const [name, setName] = useState(""); const [tier, setTier] = useState<SponsorConfig["tier"]>("supporter"); const [logoUrl, setLogoUrl] = useState(""); const [destinationUrl, setDestinationUrl] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); await api.saveSponsor({ name, tier, logoUrl, destinationUrl, active: true }); setName(""); setLogoUrl(""); setDestinationUrl(""); await reload(); }
  return <section className="enterprise-panel p-6"><h2 className="font-display text-2xl font-bold">Partners</h2><form onSubmit={submit} className="mt-4 space-y-3"><Field label="Partner name" value={name} onChange={setName} /><label className="block text-sm font-semibold">Tier<select className="enterprise-input mt-1 w-full" value={tier} onChange={(event) => setTier(event.target.value as SponsorConfig["tier"])}>{["gold", "silver", "bronze", "supporter"].map((value) => <option key={value}>{value}</option>)}</select></label><Field label="Logo URL" value={logoUrl} onChange={setLogoUrl} /><Field label="Destination URL" value={destinationUrl} onChange={setDestinationUrl} /><button className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white">Add partner</button></form><div className="mt-5 divide-y divide-line">{rows.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><b>{row.name}</b><p className="text-xs uppercase text-ink-muted">{row.tier}</p></div><button onClick={() => void api.deleteSponsor(row.id).then(reload)} className="text-xs font-semibold text-bad">Remove</button></div>)}</div></section>;
}

function NewsManager({ rows, reload }: { rows: NewsConfig[]; reload: () => Promise<void> }) {
  const [title, setTitle] = useState(""); const [summary, setSummary] = useState(""); const [published, setPublished] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); await api.saveNews({ slug: title, title, summary, published }); setTitle(""); setSummary(""); setPublished(false); await reload(); }
  return <section className="enterprise-panel p-6"><h2 className="font-display text-2xl font-bold">Newsroom</h2><form onSubmit={submit} className="mt-4 space-y-3"><Field label="Headline" value={title} onChange={setTitle} /><label className="block text-sm font-semibold">Summary<textarea className="enterprise-input mt-1 min-h-24 w-full" value={summary} onChange={(event) => setSummary(event.target.value)} required /></label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Publish immediately</label><button className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white">Add article</button></form><div className="mt-5 divide-y divide-line">{rows.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><b>{row.title}</b><p className="text-xs text-ink-muted">{row.published ? "Published" : "Draft"}</p></div><button onClick={() => void api.deleteNews(row.id).then(reload)} className="text-xs font-semibold text-bad">Remove</button></div>)}</div></section>;
}

function Field({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) { return <label className={`block text-sm font-semibold ${wide ? "md:col-span-2" : ""}`}>{label}<input className="enterprise-input mt-1 w-full" value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
