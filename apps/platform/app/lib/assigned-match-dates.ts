// Use the competition's local day even when an operator's device is abroad.
const TIME_ZONE = "America/Barbados";
const dayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayLabel = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function timestamp(value: string | null) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : Infinity;
}

export function assignedMatchSchedule(value: string | null) {
  const time = timestamp(value);
  return time === Infinity
    ? { key: "tbc", date: "Date to be confirmed", time: "Time TBC" }
    : {
        key: dayKey.format(time),
        date: dayLabel.format(time),
        time: timeLabel.format(time),
      };
}

export function groupAssignedMatches<T extends { scheduledAt: string | null }>(
  matches: T[],
) {
  const groups = new Map<string, { key: string; date: string; matches: T[] }>();
  const ordered = [...matches].sort((a, b) => {
    const aTime = timestamp(a.scheduledAt);
    const bTime = timestamp(b.scheduledAt);
    return aTime === bTime ? 0 : aTime < bTime ? -1 : 1;
  });
  for (const match of ordered) {
    const schedule = assignedMatchSchedule(match.scheduledAt);
    let group = groups.get(schedule.key);
    if (!group) {
      group = { key: schedule.key, date: schedule.date, matches: [] };
      groups.set(schedule.key, group);
    }
    group.matches.push(match);
  }
  return [...groups.values()];
}
