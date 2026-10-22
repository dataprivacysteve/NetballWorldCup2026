"use client";

import { countryDisplayCode } from "@gameday/countries";

import { usePublicPoll } from "./usePublicPoll";
import { countdownAlertClass } from "../../../../packages/shared/countdown";

type Feed = {
  MatchId: string;
  Status: string;
  Quarter: string;
  Clock: string;
  GameStartCountdown: string | null;
  IntervalClock: string | null;
  PeriodEnded: boolean;
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

export function LiveScore({
  delayedMessage,
  compact = false,
}: {
  delayedMessage?: string | null;
  compact?: boolean;
}) {
  const { data: feed, delayed } = usePublicPoll<Feed | null>(
    "/public/broadcast/live.json",
    null,
    1_000,
  );

  if (!feed) {
    if (compact) return null;
    return (
      <div className="live-score-empty">
        {delayed
          ? (delayedMessage ?? "Live updates are temporarily delayed.")
          : "Live match feed will appear here."}
      </div>
    );
  }
  return (
    <div className={`live-score${compact ? " live-score-compact" : ""}`} aria-live="polite">
      {compact && <div className="live-score-heading">{feed.Status === 'FINAL' ? 'Latest result' : ['SCHEDULED','READY'].includes(feed.Status) ? 'Next match score' : 'Live match score'}</div>}
      <div className="live-score-meta">
        <span>{feed.Status}</span>
        <b>
          {["SCHEDULED", "READY"].includes(feed.Status)
            ? "Game starts in"
            : feed.PeriodEnded
              ? "Quarter ended"
              : feed.Quarter}
        </b>
        <strong
          className={countdownAlertClass(
            ["SCHEDULED", "READY"].includes(feed.Status)
              ? feed.GameStartCountdown
              : feed.PeriodEnded && feed.Status !== "FINAL"
                ? feed.IntervalClock
                : null,
          )}
        >
          {["SCHEDULED", "READY"].includes(feed.Status)
            ? (feed.GameStartCountdown ?? "Awaiting start")
            : (feed.IntervalClock ?? feed.Clock)}
        </strong>
      </div>
      <div className="live-score-sides">
        <div>
          <small>{countryDisplayCode(feed.TeamAAbbr)}</small>
          <span>{feed.TeamAName}</span>
          <b>{feed.TeamAScore}</b>
        </div>
        <em>–</em>
        <div>
          <small>{countryDisplayCode(feed.TeamBAbbr)}</small>
          <span>{feed.TeamBName}</span>
          <b>{feed.TeamBScore}</b>
        </div>
      </div>
      <p>{feed.Provisional ? "Provisional" : "Confirmed"}</p>
      {delayed && (
        <div className="live-delay">
          {delayedMessage ?? "Live updates are temporarily delayed."}
        </div>
      )}
    </div>
  );
}
