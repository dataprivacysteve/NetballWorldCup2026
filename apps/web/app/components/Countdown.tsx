"use client";

import { useEffect, useState } from "react";

function parts(targetMs: number): [number, number, number, number] {
  let s = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
  const d = Math.floor(s / 86400);
  s %= 86400;
  const h = Math.floor(s / 3600);
  s %= 3600;
  const m = Math.floor(s / 60);
  s %= 60;
  return [d, h, m, s];
}
const pad = (n: number) => String(n).padStart(2, "0");

// Live countdown. `units` drives the gold tip-off bar; `inline` is the compact
// timer in the Next Game header. Renders a stable placeholder on the server /
// first paint, then ticks on the client (no hydration mismatch).
export function Countdown({
  target,
  mode,
}: {
  target: string | null;
  mode: "units" | "inline";
}) {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    if (!target) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!target || nowMs === null) {
    return mode === "inline" ? (
      <span className="bar-cd">Coming up</span>
    ) : (
      <div className="cd" />
    );
  }

  const [d, h, m, s] = parts(new Date(target).getTime());

  if (mode === "inline") {
    return (
      <span className="bar-cd">
        <b>{pad(d)}</b>d<b>{pad(h)}</b>h<b>{pad(m)}</b>m<b>{pad(s)}</b>s
      </span>
    );
  }

  const units: [string, number][] = [
    ["Days", d],
    ["Hrs", h],
    ["Min", m],
    ["Sec", s],
  ];
  return (
    <div className="cd">
      {units.map(([t, n]) => (
        <div className="u" key={t}>
          <div className="n">{pad(n)}</div>
          <div className="t">{t}</div>
        </div>
      ))}
    </div>
  );
}
