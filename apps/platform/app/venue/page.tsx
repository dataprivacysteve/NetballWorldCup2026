"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, type EdgeNode, type MatchVenue } from "../lib/api";

function status(node: EdgeNode) {
  if (!node.active) return { label: "Disabled", cls: "text-ink-muted" };
  if (!node.lastSeenAt) return { label: "Awaiting configuration", cls: "text-warn" };
  const age = Date.now() - new Date(node.lastSeenAt).getTime();
  if (age < 90_000) return { label: "Online", cls: "text-ok" };
  return { label: "Offline", cls: "text-bad" };
}

export default function VenuePage() {
  const [nodes, setNodes] = useState<EdgeNode[]>([]);
  const [venues, setVenues] = useState<MatchVenue[]>([]);
  const [name, setName] = useState("Qualifier venue edge");
  const [venueId, setVenueId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [me, nextNodes, nextVenues] = await Promise.all([api.me(), api.edgeNodes(), api.matchVenues()]);
    if (!me?.user?.isAdmin) return window.location.replace("/");
    setNodes(nextNodes);
    setVenues(nextVenues);
    setVenueId((current) => current || nextVenues[0]?.id || "");
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(
      () => void load().catch((reason: unknown) => setError((reason as Error).message)),
      0,
    );
    const timer = window.setInterval(() => void load(), 15_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api.createEdgeNode(name, venueId || undefined);
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  return <main className="min-h-screen bg-bg px-5 py-8 text-ink">
    <div className="mx-auto max-w-6xl">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div><p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-navy">Module 10 · Venue resilience</p><h1 className="mt-1 font-display text-4xl font-bold">Edge synchronization</h1><p className="mt-2 text-sm text-ink-muted">Prepare a venue-scoped GameDay node without changing the online registration and LOC platform.</p></div>
        <Link href="/" className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-navy">Back to LOC console</Link>
      </div>
      {error && <p role="alert" className="mb-5 rounded-xl border border-bad-line bg-bad-soft p-3 text-sm text-bad">{error}</p>}
      <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
        <form onSubmit={create} className="enterprise-panel space-y-4 p-6">
          <h2 className="font-display text-2xl font-bold">Register venue node</h2>
          <label className="block text-sm font-semibold">Node name<input className="enterprise-input mt-1 w-full" value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label className="block text-sm font-semibold">Venue<select className="enterprise-input mt-1 w-full" value={venueId} onChange={(event) => setVenueId(event.target.value)}><option value="">All venues (rehearsal only)</option>{venues.map((venue) => <option value={venue.id} key={venue.id}>{venue.name}</option>)}</select></label>
          <button className="enterprise-button rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white">Register node</button>
          <p className="text-xs leading-5 text-ink-muted">The node ID is safe to display. The shared synchronization secret is supplied later through the server secret store in Module 14.</p>
        </form>
        <section className="enterprise-panel overflow-hidden">
          <div className="border-b border-line p-5"><h2 className="font-display text-2xl font-bold">Venue nodes</h2><p className="text-sm text-ink-muted">Heartbeat, bootstrap and push timestamps update automatically once a server is configured.</p></div>
          {nodes.length === 0 ? <p className="p-6 text-sm text-ink-muted">No venue node registered.</p> : <div className="divide-y divide-line">{nodes.map((node) => { const current = status(node); return <div key={node.id} className="p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{node.name}</p><p className="font-mono text-[0.65rem] text-ink-muted">{node.id}</p></div><strong className={`text-sm ${current.cls}`}>{current.label}</strong></div><dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><Metric label="Venue" value={node.venue ?? "All"} /><Metric label="Last seen" value={node.lastSeenAt ? new Date(node.lastSeenAt).toLocaleString() : "Never"} /><Metric label="Last pull" value={node.lastPullAt ? new Date(node.lastPullAt).toLocaleString() : "Never"} /><Metric label="Last push" value={node.lastPushAt ? new Date(node.lastPushAt).toLocaleString() : "Never"} /></dl>{node.active && <button onClick={() => void api.deactivateEdgeNode(node.id).then(load)} className="mt-4 text-xs font-semibold text-bad hover:underline">Disable node</button>}</div>;})}</div>}
        </section>
      </div>
      <section className="enterprise-panel mt-6 p-6"><h2 className="font-display text-2xl font-bold">Server handoff contract</h2><ol className="mt-4 grid gap-3 text-sm text-ink-soft md:grid-cols-2"><li>1. Configure <code>EDGE_SYNC_SECRET</code> on cloud and venue services.</li><li>2. Set the venue node ID as <code>EDGE_NODE_ID</code>.</li><li>3. Pull the scoped bootstrap package before doors open.</li><li>4. Heartbeat every 30 seconds and show loss of cloud connectivity.</li><li>5. Export ordered ledger events from the venue database.</li><li>6. Retry the same batch ID until cloud acknowledgement.</li><li>7. Reconcile cloud and venue versions before closing the match.</li><li>8. Retain the paper match record as the official fallback.</li></ol></section>
    </div>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div><dt className="font-mono uppercase tracking-wider text-ink-muted">{label}</dt><dd className="mt-1 font-semibold text-ink">{value}</dd></div>; }
