"use client";

import { useEffect, useRef, useState } from "react";
import type { GameDayState } from "../lib/api";
import { countdownAlertClass } from "../../../../packages/shared/countdown";

type ClockOptions = { remainingSeconds?: number; countdownMinutes?: number };
export function clockLabel(seconds: number) {
  const value = Math.max(0, seconds);
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function TimekeeperControls({
  match,
  disabled,
  run,
}: {
  match: GameDayState["match"];
  disabled: boolean;
  run: (action: string, options?: ClockOptions) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [time, setTime] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<
    "start_game" | "end_game" | null
  >(null);
  const confirmationDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = confirmationDialog.current;
    if (!dialog) return;
    if (confirmation && !dialog.open) dialog.showModal();
    else if (!confirmation && dialog.open) dialog.close();
  }, [confirmation]);
  const beforeGame =
    ["scheduled", "ready"].includes(match.status) && match.currentPeriod === 0;
  const active = ["live", "suspended"].includes(match.status);
  const button =
    "min-h-14 rounded-xl border border-white/20 px-5 py-3 font-bold disabled:opacity-40";
  const primary = `${button} bg-[#f5c84c] text-[#0b1029]`;
  const publicCountdown = match.startCountdownRemainingSeconds;

  return (
    <section className="space-y-5 rounded-2xl border border-white/10 bg-[#11183b] p-6">
      <h2 className="font-display text-xl font-bold">Timekeeper controls</h2>
      <p className="rounded-xl bg-white/5 p-4 text-sm text-white/75">
        {active
          ? "Scoring enabled — pausing the clock and ending a quarter do not close scoring."
          : beforeGame
            ? "Scoring locked — Start Game opens scoring."
            : "Game ended — scoring is closed."}
      </p>
      {beforeGame && (
        <>
          <div
            className="rounded-xl border border-[#f5c84c]/30 bg-white/5 p-5 text-center"
            aria-live="polite"
          >
            <p className="text-xs uppercase tracking-widest text-white/60">
              Public display
            </p>
            <p className="mt-2 font-bold">
              {publicCountdown === null
                ? "Waiting for game start"
                : publicCountdown === 0
                  ? "Awaiting Start Game"
                  : "Game starts in"}
            </p>
            {publicCountdown !== null && (
              <p
                className={`my-3 font-mono text-5xl font-bold text-[#f5c84c] tabular-nums ${countdownAlertClass(publicCountdown)}`}
              >
                {clockLabel(publicCountdown)}
              </p>
            )}
            {match.startCountdownEndsAt && (
              <p className="text-sm text-white/65">
                Expected start{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  timeZone: "America/Barbados",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(match.startCountdownEndsAt))}{" "}
                AST
              </p>
            )}
          </div>
          <div>
            <h3 className="mb-3 font-bold">Time until game starts</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[5, 10, 15, 20].map((minutes) => (
                <button
                  key={minutes}
                  className={button}
                  disabled={disabled}
                  onClick={() =>
                    void run("set_start_countdown", {
                      countdownMinutes: minutes,
                    })
                  }
                >
                  {minutes} min
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-white/55">
              Select a duration to start or replace the public countdown.
              Reaching zero does not start the game.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className={primary}
              disabled={disabled}
              onClick={() => setConfirmation("start_game")}
            >
              Start Game
            </button>
            <button
              className={button}
              disabled={disabled}
              onClick={() => void run("clear_start_countdown")}
            >
              Clear Countdown
            </button>
          </div>
        </>
      )}
      {active && (
        <>
          <p className="text-sm text-white/65">
            {match.periodEndedAt
              ? `Quarter ${match.currentPeriod} ended by the timekeeper.`
              : "You control when to end or advance the quarter. The countdown does not lock the controls."}
          </p>
          {match.intervalRemainingSeconds !== null && (
            <div className="rounded-xl border border-[#f5c84c]/30 p-5 text-center">
              <p className="text-sm font-bold">
                {match.currentPeriod === 2 ? "Half-time" : "Quarter interval"} ·
                Next quarter in
              </p>
              <p
                className={`mt-2 font-mono text-4xl text-[#f5c84c] tabular-nums ${countdownAlertClass(match.intervalRemainingSeconds)}`}
              >
                {clockLabel(match.intervalRemainingSeconds)}
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              className={primary}
              disabled={disabled}
              onClick={() =>
                void run(
                  match.periodEndedAt && match.currentPeriod < 4
                    ? "start_next_period"
                    : match.clockRunning
                      ? "stop_clock"
                      : match.status === "suspended"
                        ? "resume"
                        : "start_clock",
                )
              }
            >
              {match.periodEndedAt && match.currentPeriod < 4
                ? "Start Next Quarter"
                : match.clockRunning
                  ? "Pause Clock"
                  : "Resume Clock"}
            </button>
            <button
              className={button}
              disabled={disabled}
              onClick={() => {
                setTime(clockLabel(match.clockRemainingSeconds));
                setInputError(null);
                setEditing(true);
              }}
            >
              Adjust Clock
            </button>
            {match.periodEndedAt && match.currentPeriod < 4 && (
              <button
                className={button}
                disabled={disabled}
                onClick={() => void run("resume")}
              >
                Resume Current Quarter
              </button>
            )}
          </div>
          {editing && (
            <form
              className="space-y-3 rounded-xl bg-white/5 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                const value = /^(\d{1,4}):([0-5]\d)$/.exec(time.trim());
                const seconds = value
                  ? Number(value[1]) * 60 + Number(value[2])
                  : -1;
                if (seconds < 0 || seconds > 86400) {
                  setInputError("Enter minutes:seconds, up to 1440:00.");
                  return;
                }
                void run("adjust_clock", { remainingSeconds: seconds });
                setEditing(false);
              }}
            >
              <label className="block text-sm" htmlFor="remaining-clock">
                Remaining time (minutes:seconds)
              </label>
              <div className="flex flex-wrap gap-3">
                <input
                  id="remaining-clock"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  className="w-32 rounded-lg border border-white/20 bg-[#0b1029] p-3 font-mono text-white"
                  autoFocus
                />
                <button className={primary} disabled={disabled}>
                  Apply
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={disabled}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
              {inputError && (
                <p role="alert" className="text-sm text-red-200">
                  {inputError}
                </p>
              )}
            </form>
          )}
          <div className="flex flex-wrap gap-3 border-t border-white/10 pt-5">
            <button
              className={button}
              disabled={disabled}
              onClick={() => void run("end_period")}
            >
              End Quarter
            </button>
            {match.currentPeriod < 4 && (
              <button
                className={primary}
                disabled={disabled}
                onClick={() => void run("start_period")}
              >
                Next Quarter
              </button>
            )}
            <button
              className={`${button} border-red-300/30 text-red-200`}
              disabled={disabled}
              onClick={() => setConfirmation("end_game")}
            >
              End Game
            </button>
          </div>
        </>
      )}
      <dialog
        ref={confirmationDialog}
        aria-labelledby="timekeeper-confirm-title"
        aria-describedby="timekeeper-confirm-description"
        onCancel={() => setConfirmation(null)}
        className="m-auto w-[90vw] max-w-md rounded-2xl border border-white/15 bg-[#11183b] p-6 text-white shadow-2xl backdrop:bg-black/70"
      >
        <h3
          id="timekeeper-confirm-title"
          className="font-display text-2xl font-bold"
        >
          {confirmation === "end_game" ? "End this game?" : "Start this game?"}
        </h3>
        <p
          id="timekeeper-confirm-description"
          className="mt-3 text-sm leading-6 text-white/70"
        >
          {confirmation === "end_game"
            ? "Scoring will close and the result will be final."
            : "Quarter 1 and the match clock will begin, and scoring will open."}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className={button}
            disabled={disabled}
            onClick={() => setConfirmation(null)}
          >
            {confirmation === "end_game" ? "Keep Game Open" : "Cancel"}
          </button>
          <button
            type="button"
            className={
              confirmation === "end_game"
                ? `${button} border-red-300/30 bg-red-500/15 text-red-100`
                : primary
            }
            disabled={disabled || !confirmation}
            onClick={() => {
              if (!confirmation) return;
              const action = confirmation;
              setConfirmation(null);
              void run(action);
            }}
          >
            {confirmation === "end_game"
              ? "Confirm End Game"
              : "Confirm Start Game"}
          </button>
        </div>
      </dialog>
    </section>
  );
}
