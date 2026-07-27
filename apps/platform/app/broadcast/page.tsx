"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  api,
  type AdminMatch,
  type MatchBroadcast,
} from "../lib/api";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.netballamericas.test";
const empty = (matchId: string): MatchBroadcast => ({
  matchId,
  provider: null,
  externalId: null,
  watchUrl: null,
  embedUrl: null,
  replayUrl: null,
  status: "unassigned",
  featured: false,
  updatedAt: null,
});

export default function BroadcastPage() {
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [selected, setSelected] = useState("");
  const [record, setRecord] = useState<MatchBroadcast | null>(null);
  const [feed, setFeed] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([api.me(), api.matches()]).then(([me, rows]) => {
      if (!me?.user?.isAdmin) return window.location.replace("/");
      setMatches(rows);
      setSelected(rows[0]?.id ?? "");
    });
  }, []);

  const load = useCallback(async () => {
    if (!selected) return;
    setRecord(await api.matchBroadcast(selected));
  }, [selected]);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initial);
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(
          `${API}/public/broadcast/matches/${selected}/live.json`,
          { cache: "no-store" },
        );
        if (response.ok && active) setFeed((await response.json()) as Record<string, unknown>);
      } catch {
        if (active) setFeed(null);
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selected]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!record) return;
    setMessage(null);
    const { matchId: _matchId, updatedAt: _updatedAt, ...body } = record;
    void _matchId;
    void _updatedAt;
    setRecord(await api.updateMatchBroadcast(selected, body));
    setMessage("Broadcast configuration saved.");
  }

  const fixture = matches.find((match) => match.id === selected);
  const value = record ?? (selected ? empty(selected) : null);
  return (
    <main className="min-h-screen bg-bg px-5 py-8 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-navy">Module 13 · Broadcast operations</p>
            <h1 className="mt-1 font-display text-4xl font-bold">Stream &amp; data feeds</h1>
            <p className="mt-2 text-sm text-ink-muted">Link each neutral Team A/Team B fixture once. The public site and vMix read the same scoring ledger.</p>
          </div>
          <Link href="/" className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-navy">Back to LOC console</Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <form onSubmit={save} className="enterprise-panel space-y-4 p-6">
            <label className="block text-sm font-semibold">Fixture
              <select className="enterprise-input mt-1 w-full" value={selected} onChange={(event) => setSelected(event.target.value)}>
                {matches.map((match) => <option key={match.id} value={match.id}>{match.teamACode} v {match.teamBCode} · {match.roundLabel ?? "Fixture"}</option>)}
              </select>
            </label>
            {value && <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Provider" value={value.provider ?? ""} onChange={(provider) => setRecord({ ...value, provider })} />
                <Field label="External stream ID" value={value.externalId ?? ""} onChange={(externalId) => setRecord({ ...value, externalId })} />
              </div>
              <Field label="Public watch URL" value={value.watchUrl ?? ""} onChange={(watchUrl) => setRecord({ ...value, watchUrl })} />
              <Field label="Safe embed URL" value={value.embedUrl ?? ""} onChange={(embedUrl) => setRecord({ ...value, embedUrl })} />
              <Field label="Replay URL" value={value.replayUrl ?? ""} onChange={(replayUrl) => setRecord({ ...value, replayUrl })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold">Lifecycle
                  <select className="enterprise-input mt-1 w-full" value={value.status} onChange={(event) => setRecord({ ...value, status: event.target.value as MatchBroadcast["status"] })}>
                    {(["unassigned", "scheduled", "live", "ended", "archived"] as const).map((status) => <option key={status}>{status}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 self-end rounded-lg border border-line bg-white p-3 text-sm font-semibold">
                  <input type="checkbox" checked={value.featured} onChange={(event) => setRecord({ ...value, featured: event.target.checked })} /> Feature on public site
                </label>
              </div>
              <button className="enterprise-button rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white">Save broadcast</button>
              {message && <p role="status" className="text-sm text-ok">{message}</p>}
            </>}
          </form>

          <section className="space-y-5">
            <div className="enterprise-panel p-6">
              <p className="font-mono text-[0.63rem] font-bold uppercase tracking-wider text-ink-muted">Live feed preview</p>
              <h2 className="mt-1 font-display text-2xl font-bold">{fixture ? `${fixture.teamAName} v ${fixture.teamBName}` : "Select a fixture"}</h2>
              {feed ? <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
                <div><p className="font-mono text-xs text-ink-muted">{String(feed.TeamAAbbr)}</p><b className="font-display text-5xl text-navy">{String(feed.TeamAScore)}</b></div>
                <div><p className="font-mono text-xs text-gold-deep">{String(feed.Quarter)}</p><strong className="font-mono text-xl">{String(feed.Clock)}</strong></div>
                <div><p className="font-mono text-xs text-ink-muted">{String(feed.TeamBAbbr)}</p><b className="font-display text-5xl text-navy">{String(feed.TeamBScore)}</b></div>
              </div> : <p className="mt-4 text-sm text-ink-muted">Feed becomes available once the fixture is ready for broadcast.</p>}
            </div>
            {selected && <div className="enterprise-panel p-6 text-sm">
              <h2 className="font-display text-xl font-bold">vMix pull sources</h2>
              <p className="mt-2 text-ink-muted">Update interval: 1000 ms. XPath: <code>/gameday/match</code>.</p>
              <a className="mt-3 block break-all text-navy underline" href={`${API}/public/broadcast/matches/${selected}/live.xml`}>{API}/public/broadcast/matches/{selected}/live.xml</a>
              <a className="mt-2 block break-all text-navy underline" href={`${API}/public/broadcast/matches/${selected}/live.json`}>{API}/public/broadcast/matches/{selected}/live.json</a>
            </div>}
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-semibold">{label}<input className="enterprise-input mt-1 w-full" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
