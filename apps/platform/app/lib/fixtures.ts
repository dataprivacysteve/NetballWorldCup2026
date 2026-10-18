import type { AdminMatch } from "./api";

function fixtureTime(match: AdminMatch): number {
  const time = match.scheduledAt ? Date.parse(match.scheduledAt) : NaN;
  return Number.isFinite(time) ? time : Infinity;
}

export function visibleFixtures(
  matches: AdminMatch[],
  now: number,
  showPast = false,
): AdminMatch[] {
  return matches
    .filter((match) => {
      if (showPast) return true;
      if (match.status === "final" || match.status === "cancelled") return false;
      if (["live", "suspended", "awaiting_confirmation"].includes(match.status))
        return true;
      return fixtureTime(match) >= now;
    })
    .sort((a, b) => {
      const aTime = fixtureTime(a);
      const bTime = fixtureTime(b);
      return aTime === bTime ? a.sortOrder - b.sortOrder : aTime < bTime ? -1 : 1;
    });
}
