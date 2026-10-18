"use client";

import { usePublicPoll } from "./usePublicPoll";

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

export function LiveScore({
  delayedMessage,
}: {
  delayedMessage?: string | null;
}) {
  const { data: feed, delayed } = usePublicPoll<Feed | null>(
    "/public/broadcast/live.json",
    null,
    1_000,
  );

  if (!feed) {
    return (
      <div className="live-score-empty">
        {delayed
          ? (delayedMessage ?? "Live updates are temporarily delayed.")
          : "Live match feed will appear here."}
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
      <p>{feed.Provisional ? "Provisional" : "Confirmed"}</p>
      {delayed && (
        <div className="live-delay">
          {delayedMessage ?? "Live updates are temporarily delayed."}
        </div>
      )}
    </div>
  );
}
