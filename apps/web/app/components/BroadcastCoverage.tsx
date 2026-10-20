"use client";

import { useState } from "react";
import type { Match } from "../lib/api";
import { automaticBroadcast, coverageDays } from "../lib/broadcast-coverage";
import { useCountdownNow } from "./Countdown";
import { LiveScore } from "./LiveScore";

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Barbados",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00-04:00`));
}

export function BroadcastCoverage({
  broadcasts,
  results,
  delayedMessage,
}: {
  broadcasts: Match[];
  results: Match[];
  delayedMessage?: string | null;
}) {
  const now = useCountdownNow();
  const [selectedId, setSelectedId] = useState("");
  const all = [
    ...new Map(
      [
        ...broadcasts,
        ...results.filter((match) => match.broadcast.replayUrl),
      ].map((match) => [match.id, match]),
    ).values(),
  ];
  const days = coverageDays(all);
  const replays = coverageDays(
    results.filter(
      (match) => match.status === "final" && match.broadcast.replayUrl,
    ),
  );
  const selected =
    all.find((match) => match.id === selectedId) ??
    automaticBroadcast(all, now);
  const replay = selected?.status === "final";
  const live = selected && ["live", "suspended"].includes(selected.status);
  const url = replay
    ? (selected.broadcast.replayUrl ?? selected.broadcast.watchUrl)
    : selected?.broadcast.watchUrl;
  const selectedDay = days.find((day) =>
    day.matches.some((match) => match.id === selected?.id),
  );
  const dayMatches = [...(selectedDay?.matches ?? [])].sort((a,b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!));

  return (
    <>
      <section className="sec" id="watch">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="disp">
              <small>Broadcast</small>Watch Live &amp; Replays
            </h2>
          </div>
          {!!days.length && (
            <div className="coverage-day-control">
              <label htmlFor="broadcast-day">Broadcast day</label>
              <select
                id="broadcast-day"
                value={selectedId && selectedDay ? selectedDay.match.id : ""}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                <option value="">Automatic · current coverage</option>
                {days.map((day) => (
                  <option key={day.key} value={day.match.id}>
                    {dateLabel(day.date)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="watch">
            <div className="watch-main">
            <div className="watch-stage">
              <span className="live">
                {replay ? "Replay" : live ? "● Live" : "Upcoming coverage"}
              </span>
              {selected?.broadcast.embedUrl ? (
                <iframe
                  key={selected.broadcast.embedUrl}
                  src={selected.broadcast.embedUrl}
                  title={`${selectedDay ? dateLabel(selectedDay.date) : "Match"} · ${replay ? "replay" : "coverage"}`}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <LiveScore delayedMessage={delayedMessage} />
              )}
            </div>
            <div className="watch-caption">
              <span>Full-day coverage · SportsBB</span>
              <a href={url ?? '#schedule'} target={url ? '_blank' : undefined} rel={url ? 'noopener noreferrer' : undefined}>{replay ? 'Watch Replay on YouTube' : url ? live ? 'Watch Live on YouTube' : 'Open stream on YouTube' : 'View schedule'} ↗</a>
            </div>
            </div>
            <aside className="watch-info" aria-label="Selected day's matches">
              <LiveScore delayedMessage={delayedMessage} compact />
              <h3 className="disp">
                {selectedDay ? dateLabel(selectedDay.date) : "Centre Court"}
              </h3>
              <div className="coverage-fixture-heading"><span>{replay ? 'Results' : 'Match schedule'}</span><span>Barbados · AST</span></div>
              <ol className="coverage-fixtures">{dayMatches.map(match => <li key={match.id} className={`coverage-game${['live','suspended'].includes(match.status) ? ' is-live' : ''}`}>
                <time dateTime={match.scheduledAt!}>{new Intl.DateTimeFormat('en-GB',{timeZone:'America/Barbados',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(match.scheduledAt!))}</time>
                <div className="coverage-game-teams"><span>{match.teamA.name}</span><span>{match.teamB.name}</span></div>
                <div className="coverage-game-result">{match.status==='final' ? <><strong>{match.teamA.score}–{match.teamB.score}</strong><small>Final</small></> : ['live','suspended','awaiting_confirmation'].includes(match.status) ? <><strong>{match.teamA.score ?? 0}–{match.teamB.score ?? 0}</strong><small>{match.status==='live'?'Live':match.status==='suspended'?'Paused':'Provisional'}</small></> : <small>Upcoming</small>}</div>
              </li>)}</ol>
              <p className="coverage-session-note">{replay ? 'Full-day recording. Use the video controls to find your match.' : 'One stream covers all the games listed here.'}</p>
            </aside>
          </div>
        </div>
      </section>
      <section className="sec" id="replays">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="disp">
              <small>Catch up</small>Past Games
            </h2>
          </div>
          {replays.length ? (
            <div className="coverage-replay-grid">
              {replays.map((day) => (
                <article key={day.key} className="coverage-replay-day">
                  <h3>{dateLabel(day.date)}</h3>
                  <p className="coverage-recording-note">Full-day recording</p>
                  <ul>
                    {day.matches.map((match) => (
                      <li key={match.id}>
                        <span>
                          {match.teamA.name} v {match.teamB.name}
                        </span>
                        <strong>
                          {match.teamA.score} – {match.teamB.score}
                        </strong>
                      </li>
                    ))}
                  </ul>
                  <button
                    className="btn btn-gold"
                    type="button"
                    onClick={() => {
                      setSelectedId(day.match.id);
                      document
                        .getElementById("watch")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }}
                  >
                    Play Day Recording
                  </button>
                  <a
                    href={day.match.broadcast.replayUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Watch on YouTube ↗
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <p className="coverage-recording-note">
              Replays will appear here as recordings become available.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
