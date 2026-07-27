"use client";

import { useEffect, useState } from "react";

type Feed = {
  MatchId: string;
  Status: string;
  Quarter: string;
  Clock: string;
  TeamAAbbr: string;
  TeamAName: string;
  TeamAScore: number;
  TeamBAbbr: string;
  TeamBName: string;
  TeamBScore: number;
  Venue: string;
  Court: string;
  Provisional: boolean;
  UpdatedAt: string;
};

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.netballamericas.test";

export function LiveScore({ delayedMessage }: { delayedMessage?: string | null }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    let active = true;
    let failures = 0;
    const load = async () => {
      try {
        const response = await fetch(`${API}/public/broadcast/live.json`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Feed unavailable");
        const next = (await response.json()) as Feed;
        if (active) {
          setFeed(next);
          setDelayed(false);
          failures = 0;
        }
      } catch {
        failures += 1;
        if (active && failures >= 3) setDelayed(true);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!feed) {
    return (
      <div className="live-score-empty">
        {delayed ? delayedMessage ?? "Live updates are temporarily delayed." : "Live match feed will appear here."}
      </div>
    );
  }
  return (
    <div className="live-score" aria-live="polite">
      <div className="live-score-meta">
        <span>{feed.Status}</span>
        <b>{feed.Quarter}</b>
        <strong>{feed.Clock}</strong>
      </div>
      <div className="live-score-sides">
        <div>
          <small>{feed.TeamAAbbr}</small>
          <span>{feed.TeamAName}</span>
          <b>{feed.TeamAScore}</b>
        </div>
        <em>–</em>
        <div>
          <small>{feed.TeamBAbbr}</small>
          <span>{feed.TeamBName}</span>
          <b>{feed.TeamBScore}</b>
        </div>
      </div>
      <p>{feed.Venue}{feed.Court ? ` · ${feed.Court}` : ""}{feed.Provisional ? " · Provisional" : " · Confirmed"}</p>
      {delayed && <div className="live-delay">{delayedMessage ?? "Live updates are temporarily delayed."}</div>}
    </div>
  );
}
