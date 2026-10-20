"use client";

import { useId, useState, type ReactNode } from "react";

type Entry = { id: string; day: string; label: string; content: ReactNode };

export function MatchDayList({
  entries,
  kind,
  initialDay,
}: {
  entries: Entry[];
  kind: "fixtures" | "results";
  initialDay?: string;
}) {
  const selectId = useId();
  const [selected, setSelected] = useState("");
  const days = Array.from(new Map(entries.map((entry) => [entry.day, entry.label])));
  const activeDay = days.some(([day]) => day === selected) ? selected : days.some(([day]) => day === initialDay) ? initialDay : days[0]?.[0];
  const visible = entries.filter((entry) => entry.day === activeDay);

  if (!entries.length) {
    return <div className="sr-card"><div className="empty">{kind === "fixtures" ? "No upcoming fixtures." : "No results yet."}</div></div>;
  }

  return (
    <div className="sr-card">
      <div className="match-day-controls">
        <label htmlFor={selectId}>Match day</label>
        <select id={selectId} value={activeDay} onChange={(event) => setSelected(event.target.value)}>
          {days.map(([day, label]) => <option key={day} value={day}>{label}</option>)}
        </select>
        <span>{entries.length} {kind}</span>
      </div>
      <div aria-live="polite" aria-atomic="true">
        <p className="match-day-summary">{visible.length} {visible.length === 1 ? "match" : "matches"} · {visible[0]?.label}</p>
        {visible.map((entry) => <div key={entry.id}>{entry.content}</div>)}
      </div>
    </div>
  );
}
