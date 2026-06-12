import type { CSSProperties } from "react";
import { nationTheme } from "../lib/config";

// Nation crest. Renders the flag (config-driven, federation-agnostic) at the
// requested pixel size; falls back to an ISO monogram for unknown codes. No
// hooks, so it renders in both server and client trees.
export function Crest({
  code,
  size = 48,
  round = false,
}: {
  code: string;
  size?: number;
  round?: boolean;
}) {
  const t = nationTheme(code);
  const base: CSSProperties = { width: size, height: size, flex: "0 0 auto" };
  if (t.flag) {
    return (
      <span className={`crest${round ? " round" : ""}`} style={base}>
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
