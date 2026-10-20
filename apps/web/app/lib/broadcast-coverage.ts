import type { Match } from "./api";

export function broadcastDay(match: Pick<Match, "scheduledAt">): string {
  if (!match.scheduledAt) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Barbados",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(match.scheduledAt));
}

export function automaticBroadcast(
  matches: Match[],
  now: number | null,
): Match | null {
  const available = matches.filter(
    (match) =>
      !["cancelled", "postponed"].includes(match.status) &&
      (match.broadcast.watchUrl ||
        match.broadcast.embedUrl ||
        match.broadcast.replayUrl),
  );
  const byTime = (a: Match, b: Match) =>
    Date.parse(a.scheduledAt ?? "") - Date.parse(b.scheduledAt ?? "");
  const live = available.filter((match) =>
    ["live", "suspended", "awaiting_confirmation"].includes(match.status),
  );
  if (live.length)
    return live.sort(
      (a, b) =>
        Number(b.broadcast.featured) - Number(a.broadcast.featured) ||
        byTime(b, a),
    )[0];
  if (now !== null) {
    const today = broadcastDay({ scheduledAt: new Date(now).toISOString() });
    const todayMatches = available.filter(
      (match) => broadcastDay(match) === today,
    );
    if (todayMatches.length)
      return (
        todayMatches.find((match) =>
          ["ready", "scheduled"].includes(match.status),
        ) ?? todayMatches.sort(byTime).at(-1)!
      );
  }
  const future = available.filter(
    (match) =>
      ["scheduled", "ready"].includes(match.status) &&
      (now === null ||
        (match.scheduledAt && Date.parse(match.scheduledAt) > now)),
  );
  return (
    future.sort(byTime)[0] ??
    available
      .filter((match) => match.status === "final")
      .sort((a, b) => byTime(b, a))[0] ??
    null
  );
}

export function coverageDays(matches: Match[]) {
  const days = new Map<
    string,
    { key: string; date: string; match: Match; matches: Match[] }
  >();
  for (const match of matches) {
    const url = match.broadcast.replayUrl ?? match.broadcast.watchUrl;
    if (
      !url ||
      !match.scheduledAt ||
      ["cancelled", "postponed"].includes(match.status)
    )
      continue;
    const date = broadcastDay(match);
    const key = `${date}|${url}`;
    const existing = days.get(key);
    if (existing) {
      if (!existing.matches.some((item) => item.id === match.id))
        existing.matches.push(match);
    } else days.set(key, { key, date, match, matches: [match] });
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
