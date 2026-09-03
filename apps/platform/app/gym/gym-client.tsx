"use client";

import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.netballamericas.test";
type Mode = "automatic" | "arena" | "lineup" | "live";
type ViewMode = "arena" | "lineup" | "live";

function isOngoingMatch(status?: string) {
  return ["live", "suspended"].includes((status ?? "").toLowerCase());
}

export default function GymDisplayRouter() {
  const [configuredMode, setConfiguredMode] = useState<Mode>("automatic");
  const [effectiveMode, setEffectiveMode] = useState<ViewMode>("arena");
  const [displayedMode, setDisplayedMode] = useState<ViewMode>("arena");
  const [stingerActive, setStingerActive] = useState(false);
  const [connected, setConnected] = useState(true);
  const displayedModeRef = useRef<ViewMode>("arena");

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const modeResponse = await fetch(`${API}/public/gym-display-mode`, { cache: "no-store" });
        if (!modeResponse.ok) throw new Error(`Mode returned ${modeResponse.status}`);
        const { mode } = (await modeResponse.json()) as { mode: Mode };
        let effective: ViewMode = mode === "automatic" ? "arena" : mode;
        if (mode === "automatic") {
          const feedResponse = await fetch(`${API}/live.json`, { cache: "no-store" });
          if (feedResponse.ok) {
            const feed = (await feedResponse.json()) as {
              Status?: string;
            };
            effective = isOngoingMatch(feed.Status) ? "live" : "arena";
          }
        }
        if (!cancelled) {
          setConfiguredMode(mode);
          setEffectiveMode(effective);
          setConnected(true);
        }
      } catch {
        if (!cancelled) setConnected(false);
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (effectiveMode === displayedModeRef.current) return;
    setStingerActive(true);
    const revealTimer = window.setTimeout(() => {
      displayedModeRef.current = effectiveMode;
      setDisplayedMode(effectiveMode);
    }, 1_040);
    const finishTimer = window.setTimeout(() => setStingerActive(false), 3_000);
    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(finishTimer);
    };
  }, [effectiveMode]);

  const source =
    displayedMode === "live"
      ? "/display"
      : displayedMode === "lineup"
        ? "/lineup"
        : "/arena";
  return (
    <main className="fixed inset-0 z-[100] overflow-hidden bg-[#071022]">
      <iframe key={source} src={source} title="Gymnasium projector output" className="h-full w-full border-0" allowFullScreen />
      {stingerActive && (
        <div className="sportsbb-stinger" role="presentation" aria-hidden="true">
          <div className="sportsbb-stinger__beam sportsbb-stinger__beam--top" />
          <div className="sportsbb-stinger__beam sportsbb-stinger__beam--bottom" />
          <div className="sportsbb-stinger__lockup">
            <div className="sportsbb-stinger__split">
              <div className="sportsbb-stinger__triangle sportsbb-stinger__triangle--bna">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/event-brand/barbados-loc-logo.png" alt="" />
              </div>
              <div className="sportsbb-stinger__triangle sportsbb-stinger__triangle--sportsbb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/event-brand/sportsbb-logo-transp.png" alt="" />
              </div>
              <span className="sportsbb-stinger__diagonal" />
            </div>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 rounded-full border border-white/15 bg-[#071022]/75 px-3 py-1.5 font-mono text-[0.55rem] font-bold uppercase tracking-[0.12em] text-white/65 backdrop-blur">
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
        {configuredMode === "automatic" ? `Auto · ${displayedMode}` : displayedMode}
      </div>
    </main>
  );
}


