"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.netballamericas.test";
const QUALIFIER_LOGO = "/event-brand/NWC_SYD2027_Logo_Landscape_Full_Colour_Negative_RGB_Regional_Qualifier_Americas.png";

type Sponsor = {
  id: string;
  name: string;
  displayImageUrl: string | null;
  displayEnabled: boolean;
  displaySeconds: number;
};

export default function SponsorDisplay() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [index, setIndex] = useState(0);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const response = await fetch(`${API}/public/experience`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Sponsor feed returned ${response.status}`);
        const data = (await response.json()) as { sponsors?: Sponsor[] };
        if (!cancelled) {
          setSponsors((data.sponsors ?? []).filter((item) => item.displayEnabled && item.displayImageUrl));
          setConnected(true);
        }
      } catch {
        if (!cancelled) setConnected(false);
      }
    }
    void refresh();
    const poll = window.setInterval(() => void refresh(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    if (sponsors.length < 2) return;
    const sponsor = sponsors[index % sponsors.length];
    const timer = window.setTimeout(
      () => setIndex((current) => (current + 1) % sponsors.length),
      Math.max(5, sponsor.displaySeconds) * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [index, sponsors]);

  const sponsor = sponsors.length > 0 ? sponsors[index % sponsors.length] : null;

  return (
    <main className="relative grid h-screen min-h-[36rem] cursor-none place-items-center overflow-hidden bg-[#061127] p-[clamp(2rem,5vw,6rem)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(27,66,135,.7),transparent_55%),linear-gradient(135deg,rgba(244,196,48,.06),transparent_35%)]" />
      {sponsor?.displayImageUrl ? (
        <section className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-[clamp(1.5rem,3vw,3.5rem)] border-2 border-white/15 bg-white shadow-[0_3rem_8rem_rgba(0,0,0,.4)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={sponsor.id} src={sponsor.displayImageUrl} alt={sponsor.name} className="h-full w-full object-contain" />
        </section>
      ) : (
        <section className="relative z-10 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={QUALIFIER_LOGO} alt="Regional Qualifier Americas" className="w-[min(58rem,78vw)] object-contain" />
          <p className="mt-10 font-display text-[clamp(2rem,4vw,5rem)] font-black">Official partner presentation</p>
          <p className="mt-4 font-mono text-[clamp(.9rem,1.2vw,1.4rem)] font-bold uppercase tracking-[.16em] text-white/50">Campaign artwork will appear here</p>
        </section>
      )}
      <div className="pointer-events-none absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full border border-white/15 bg-[#071022]/80 px-3 py-1.5 font-mono text-[0.6rem] font-bold uppercase tracking-[.12em] text-white/65">
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
        Partner screen
      </div>
    </main>
  );
}
