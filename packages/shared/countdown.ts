// Preparation countdowns only: never apply this cue to the playing clock.
export function countdownAlertClass(
  remaining: number | string | null | undefined,
): string {
  let seconds: number | null | undefined;
  if (typeof remaining === "string") {
    const clock = /^(\d+):([0-5]\d)$/.exec(remaining);
    seconds = clock ? Number(clock[1]) * 60 + Number(clock[2]) : null;
  } else seconds = remaining;
  return typeof seconds === "number" &&
    Number.isFinite(seconds) &&
    seconds > 0 &&
    seconds <= 60
    ? "ready-countdown-alert"
    : "";
}
