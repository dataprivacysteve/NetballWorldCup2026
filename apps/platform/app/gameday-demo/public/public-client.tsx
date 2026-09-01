"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  DEMO_CHANNEL,
  DEMO_STATE_KEY,
  initialPublicDemoState,
  type PublicDemoState,
} from "../demo-state";

const teams = {
  home: { code: "BRB", name: "Barbados", flag: "/flags/barbados.svg" },
  away: { code: "JAM", name: "Jamaica", flag: "/flags/jamaica.svg" },
} as const;

function clockLabel(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function readState() {
  try {
    const value = window.localStorage.getItem(DEMO_STATE_KEY);
    return value ? (JSON.parse(value) as PublicDemoState) : initialPublicDemoState;
  } catch {
    return initialPublicDemoState;
  }
}

function TeamMark({ side }: { side: "home" | "away" }) {
  const team = teams[side];
  return (
    <span
      title={team.name}
      className="relative grid h-16 w-24 place-items-center overflow-hidden rounded-lg border-2 border-white/25 bg-white/5 shadow-2xl sm:h-24 sm:w-36"
    >
      <Image src={team.flag} alt={`${team.name} flag`} fill sizes="(min-width: 640px) 144px, 96px" className="object-cover" priority />
    </span>
  );
}

export default function AudienceScreen() {
  const [state, setState] = useState(initialPublicDemoState);

  useEffect(() => {
    const initial = window.setTimeout(() => setState(readState()), 0);
    const channel = new BroadcastChannel(DEMO_CHANNEL);
    channel.onmessage = (event: MessageEvent<PublicDemoState>) => setState(event.data);
    const onStorage = (event: StorageEvent) => {
      if (event.key === DEMO_STATE_KEY) setState(readState());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearTimeout(initial);
      channel.close();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#071022] p-5 text-white sm:p-10">
      <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-[#1b2a6b]/55 blur-3xl" />
      <div className="absolute -bottom-40 -right-32 h-[30rem] w-[30rem] rounded-full bg-[#f4c430]/15 blur-3xl" />

      <section className="relative w-full max-w-[110rem]">
        <header className="mb-8 flex items-center justify-between border-b border-white/15 pb-5">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#f4c430] font-display text-2xl font-black text-[#071022]">N</div>
            <div>
              <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[#f4c430]">Netball Americas · Live</p>
              <p className="font-display text-xl font-bold sm:text-3xl">Americas Regional Qualifier</p>
            </div>
          </div>
          <span className={`rounded-full px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.12em] ${state.status === "final" ? "bg-white/10 text-white/65" : "bg-red-500 text-white shadow-[0_0_35px_rgba(239,68,68,.45)]"}`}>
            {state.status === "final" ? "Final" : `● Live · Q${state.quarter}`}
          </span>
        </header>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-10">
          {(["home", "away"] as const).map((side, index) => {
            const team = teams[side];
            return (
              <div key={side} className={`${index ? "col-start-3 row-start-1 text-right" : "text-left"}`}>
                <div className={`flex items-center gap-4 sm:gap-7 ${index ? "justify-end" : ""}`}>
                  {!index && <TeamMark side={side} />}
                  <div>
                    <p className="font-display text-2xl font-black sm:text-5xl lg:text-7xl">{team.name}</p>
                    <p className="mt-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/45 sm:text-base">
                      {state.centrePass === side ? "● Centre pass" : "National team"}
                    </p>
                  </div>
                  {!!index && <TeamMark side={side} />}
                </div>
                <p className="mt-14 font-mono text-[6rem] font-black leading-none text-[#f4c430] sm:mt-20 sm:text-[10rem] lg:text-[15rem]">
                  {state.scores[side]}
                </p>
              </div>
            );
          })}

          <div className="col-start-2 row-start-1 min-w-28 text-center sm:min-w-52">
            <p className="font-mono text-lg font-black uppercase tracking-[0.14em] text-[#f4c430] sm:text-3xl">
              {state.status === "final" ? "Full time" : `Quarter ${state.quarter}`}
            </p>
            <p className="mt-3 font-mono text-4xl font-black sm:text-7xl lg:text-8xl">
              {state.status === "final" ? "FT" : clockLabel(state.clock)}
            </p>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4 text-center sm:mt-16 sm:px-8 sm:py-6">
          <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] text-white/35">Last play</p>
          <p className="mt-2 font-display text-xl font-bold text-[#f4c430] sm:text-4xl">{state.lastPlay}</p>
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-white/35 sm:text-sm">
          <span>G. Sobers Gymnasium · Group A</span>
          <span>Provisional live score · official result is the signed scoresheet</span>
          <span className="font-mono">Local audience screen</span>
        </footer>
      </section>
    </main>
  );
}
