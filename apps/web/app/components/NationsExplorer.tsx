"use client";

import { useState } from "react";
import { Crest } from "./Crest";
import { nationTheme } from "../lib/config";
import type { Nation, Squad } from "../lib/api";

// Nations grid -> squad reveal. All squads are pre-fetched server-side and
// passed in, so selecting a nation is instant and the page makes no client API
// calls. Squad fields are the DPA-safe set (name/role/jersey/captain).
export function NationsExplorer({
  nations,
  squads,
}: {
  nations: Nation[];
  squads: Record<string, Squad | null>;
}) {
  const [active, setActive] = useState(nations[0]?.countryCode ?? "");
  const squad = squads[active] ?? null;

  return (
    <>
      <div className="nat-grid">
        {nations.map((n) => (
          <div
            key={n.countryCode}
            className={`nat${n.countryCode === active ? " active" : ""}`}
            onClick={() => setActive(n.countryCode)}
          >
            <Crest code={n.countryCode} size={60} />
            <div>
              <div className="nm">{n.name}</div>
              <div className="iso">
                {n.countryCode}
                {n.group ? ` · ${n.group}` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>

      {squad && (
        <div className="squad">
          <div className="squad-head">
            <Crest code={squad.nation.countryCode} size={64} />
            <div>
              <div className="h-nm">{squad.nation.name}</div>
              <div className="h-meta">
                {squad.members.length} accredited · {active}
              </div>
            </div>
          </div>
          <div className="players">
            {squad.members.map((p, i) => (
              <div className="pl" key={i}>
                <div className="num">{p.jerseyNumber ?? "–"}</div>
                <div
                  className="av"
                  style={{
                    background: nationTheme(active).color,
                    color: "#fff",
                  }}
                >
                  {p.firstName.charAt(0)}
                  {p.lastName.charAt(0)}
                </div>
                <div>
                  <div className="pn">
                    {p.firstName.charAt(0)}. {p.lastName}
                    {p.isCaptain && <span className="cap">C</span>}
                  </div>
                  <div className="pp">
                    {p.category === "player" && p.role
                      ? `Primary: ${p.role}`
                      : (p.role ?? p.category)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="squad-note">
            Listed positions are primary preferences, not fixed match
            assignments. Squads remain subject to accreditation.
          </div>
        </div>
      )}
    </>
  );
}
