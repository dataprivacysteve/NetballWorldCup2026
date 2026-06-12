"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { nationTheme, flagSrc } from "../lib/config";

// Nation crest. Prefers the committed flag image
// (apps/web/public/flags/<code>.svg); if that file is missing it falls back to
// the config emoji, then an ISO monogram — so the site never shows a broken
// image. Federation-agnostic: swap the flag files + config for a new event.
export function Crest({
  code,
  size = 48,
  round = false,
}: {
  code: string;
  size?: number;
  round?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const t = nationTheme(code);
  const base: CSSProperties = { width: size, height: size, flex: "0 0 auto" };
  const cls = `crest${round ? " round" : ""}`;

  if (!imgFailed) {
    return (
      <span className={cls} style={base}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={flagSrc(code)}
          alt={code}
          onError={() => setImgFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </span>
    );
  }
  if (t.flag) {
    return (
      <span className={cls} style={base}>
        <span style={{ fontSize: Math.round(size * 0.62), lineHeight: 1 }}>
          {t.flag}
        </span>
      </span>
    );
  }
  return (
    <span
      className={`crest iso${round ? " round" : ""}`}
      style={{ ...base, fontSize: Math.round(size * 0.3) }}
    >
      {code}
    </span>
  );
}
