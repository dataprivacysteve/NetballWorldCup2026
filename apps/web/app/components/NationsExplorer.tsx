"use client";

import { countryDisplayCode } from "@gameday/countries";

import { useState } from "react";
import { Crest } from "./Crest";
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
                {countryDisplayCode(n.countryCode)}
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
                {squad.members.length}{" "}
                {squad.members.length === 1 ? "player" : "players"} · {active}
              </div>
            </div>
          </div>
          <div className="players">
            {squad.members.map((p) => (
              <article className={`pl${p.photoAssetPath ? "" : " pl-no-photo"}`} key={`${active}:${p.firstName}:${p.lastName}`}>
                <div className="num">{p.jerseyNumber ?? "–"}</div>
                {p.photoAssetPath ? (
                  <img
                    className="av athlete-photo"
                    src={
                      p.photoAssetPath.startsWith("public/players/")
                        ? `${(process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.netballamericas.test").replace(/\/$/, "")}/${p.photoAssetPath}`
                        : `/${p.photoAssetPath}`
                    }
                    alt={`${p.firstName} ${p.lastName}, ${p.role ?? "squad member"}`}
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                      event.currentTarget.closest("article")?.classList.add("pl-no-photo");
                    }}
                  />
                ) : null}
                <div className="player-copy">
                  <div className="pn">
                    {p.firstName} {p.lastName}
                    {p.isCaptain && <span className="cap">C</span>}
                  </div>
                  <div className="pp">
                    {p.category === "player" && p.role
                      ? `Primary: ${p.role}`
                      : (p.role ?? p.category)}
                  </div>
                  {p.biography && <p className="bio">{p.biography}</p>}
                </div>
              </article>
            ))}
          </div>
          <div className="squad-note">
            Listed positions are primary preferences, not fixed match
            assignments. Match-day selection remains subject to tournament
            eligibility.
          </div>
        </div>
      )}
    </>
  );
}
