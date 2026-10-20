import 'reflect-metadata';
import { validate } from 'class-validator';
import type { match } from '../db/schema/match';
import { ClockCommandDto } from './gameday.dto';
import { clockTransition } from './clock-transition';
import { canChangeScore, intervalRemainingSeconds } from './gameday-rules';

const now = new Date('2026-10-20T22:00:00Z');
const userId = '00000000-0000-4000-8000-000000000001';
function fixture(overrides: Partial<typeof match.$inferSelect> = {}) {
  return {
    status: 'live',
    currentPeriod: 1,
    periodDurationSeconds: 900,
    clockRemainingSeconds: 60,
    clockRunning: false,
    clockStartedAt: null,
    periodEndedAt: null,
    startCountdownEndsAt: null,
    ...overrides,
  } as typeof match.$inferSelect;
}
function command(
  action: ClockCommandDto['action'],
  extra: Partial<ClockCommandDto> = {},
): ClockCommandDto {
  return { expectedVersion: 0, action, ...extra };
}

describe('timekeeper boundaries', () => {
  it('can end a paused quarter at 1:00, keep scoring open, then prepare a paused next quarter', () => {
    const original = fixture();
    const ended = {
      ...original,
      ...clockTransition(original, command('end_period'), userId, now),
    };
    expect(ended).toMatchObject({
      status: 'live',
      clockRemainingSeconds: 60,
      clockRunning: false,
      periodEndedAt: now,
    });
    expect(canChangeScore(ended.status)).toBe(true);
    expect(
      intervalRemainingSeconds(ended.currentPeriod, ended.periodEndedAt, now),
    ).toBe(240);
    const prepared = {
      ...ended,
      ...clockTransition(ended, command('start_period'), userId, now),
    };
    expect(prepared).toMatchObject({
      currentPeriod: 2,
      clockRemainingSeconds: 900,
      clockRunning: false,
      periodEndedAt: null,
    });
    expect(
      clockTransition(prepared, command('start_clock'), userId, now),
    ).toMatchObject({ clockRunning: true, clockStartedAt: now });
  });

  it('keeps zero separate from quarter end and allows correction and resume', () => {
    const expired = fixture({
      clockRunning: true,
      clockRemainingSeconds: 60,
      clockStartedAt: new Date(now.getTime() - 120000),
    });
    expect(
      clockTransition(expired, command('start_period'), userId, now),
    ).toMatchObject({ currentPeriod: 2, clockRunning: false });
    expect(canChangeScore(expired.status)).toBe(true);
    expect(intervalRemainingSeconds(1, expired.periodEndedAt, now)).toBeNull();
    const corrected = clockTransition(
      expired,
      command('adjust_clock', { remainingSeconds: 90 }),
      userId,
      now,
    );
    expect(corrected).toMatchObject({
      clockRemainingSeconds: 90,
      clockRunning: false,
      clockStartedAt: null,
    });
  });

  it('allows starting the next quarter immediately during an unfinished interval', () => {
    const interval = fixture({ periodEndedAt: now });
    expect(intervalRemainingSeconds(1, now, now)).toBe(240);
    expect(
      clockTransition(interval, command('start_next_period'), userId, now),
    ).toMatchObject({
      currentPeriod: 2,
      periodEndedAt: null,
      clockRemainingSeconds: 900,
      clockRunning: true,
      clockStartedAt: now,
    });
    expect(
      clockTransition(
        interval,
        command('adjust_clock', { remainingSeconds: 120 }),
        userId,
        now,
      ),
    ).toMatchObject({ clockRemainingSeconds: 120, clockRunning: false });
    expect(
      clockTransition(interval, command('resume'), userId, now),
    ).toMatchObject({ periodEndedAt: null, clockRunning: true });
  });

  it('allows manual advancement from a running quarter and repeated pause commands', () => {
    expect(
      clockTransition(
        fixture({ clockRunning: true, clockStartedAt: now }),
        command('start_next_period'),
        userId,
        now,
      ),
    ).toMatchObject({ currentPeriod: 2, clockRunning: true });
    expect(
      clockTransition(fixture(), command('stop_clock'), userId, now),
    ).toMatchObject({ clockRunning: false });
    expect(
      clockTransition(
        fixture({ clockRemainingSeconds: 0 }),
        command('resume'),
        userId,
        now,
      ),
    ).toMatchObject({ clockRemainingSeconds: 0, clockRunning: true });
  });

  it('ending quarter 4 does not end the game; only End Game closes scoring', () => {
    const original = fixture({ currentPeriod: 4 });
    const endedQuarter = {
      ...original,
      ...clockTransition(original, command('end_period'), userId, now),
    };
    expect(canChangeScore(endedQuarter.status)).toBe(true);
    expect(() =>
      clockTransition(endedQuarter, command('start_period'), userId, now),
    ).toThrow();
    const final = {
      ...endedQuarter,
      ...clockTransition(endedQuarter, command('end_game'), userId, now),
    };
    expect(final).toMatchObject({
      status: 'final',
      resultConfirmedAt: now,
      resultConfirmedBy: userId,
      clockRunning: false,
    });
    expect(canChangeScore(final.status)).toBe(false);
    for (const action of [
      'start_clock',
      'end_period',
      'adjust_clock',
      'set_start_countdown',
      'end_game',
    ] as const)
      expect(() =>
        clockTransition(
          final,
          command(action, { remainingSeconds: 60, countdownMinutes: 5 }),
          userId,
          now,
        ),
      ).toThrow();
  });

  it('preserves 4-minute quarter breaks and 8-minute halftime, including after expiry', () => {
    const later = new Date(now.getTime() + 5000);
    expect(intervalRemainingSeconds(1, now, later)).toBe(235);
    expect(intervalRemainingSeconds(2, now, later)).toBe(475);
    expect(intervalRemainingSeconds(3, now, later)).toBe(235);
    expect(intervalRemainingSeconds(4, now, later)).toBeNull();
    expect(
      intervalRemainingSeconds(1, now, new Date(now.getTime() + 600000)),
    ).toBe(0);
  });

  it.each([5, 10, 15, 20])(
    'sets a %i-minute countdown without changing the schedule or starting the game',
    (minutes) => {
      const scheduled = fixture({ status: 'scheduled', currentPeriod: 0 });
      expect(
        clockTransition(
          scheduled,
          command('set_start_countdown', { countdownMinutes: minutes }),
          userId,
          now,
        ),
      ).toEqual({
        startCountdownEndsAt: new Date(now.getTime() + minutes * 60000),
      });
    },
  );

  it('replaces and clears a countdown for a delayed game, even after the original countdown expired', () => {
    const original = fixture({
      status: 'ready',
      currentPeriod: 0,
      startCountdownEndsAt: new Date(now.getTime() - 1000),
    });
    expect(
      clockTransition(
        original,
        command('set_start_countdown', { countdownMinutes: 20 }),
        userId,
        now,
      ),
    ).toEqual({ startCountdownEndsAt: new Date('2026-10-20T22:20:00Z') });
    expect(
      clockTransition(original, command('clear_start_countdown'), userId, now),
    ).toEqual({ startCountdownEndsAt: null });
    expect(canChangeScore(original.status)).toBe(false);
    expect(() =>
      clockTransition(
        fixture(),
        command('set_start_countdown', { countdownMinutes: 5 }),
        userId,
        now,
      ),
    ).toThrow();
  });

  it('rejects absent or invalid command values at the HTTP boundary', async () => {
    for (const values of [
      command('set_start_countdown'),
      command('set_start_countdown', { countdownMinutes: 7 }),
      command('set_start_countdown', {
        countdownMinutes: null as unknown as number,
      }),
      command('adjust_clock'),
      command('adjust_clock', { remainingSeconds: -1 }),
    ]) {
      expect(
        (await validate(Object.assign(new ClockCommandDto(), values))).length,
      ).toBeGreaterThan(0);
    }
    expect(
      await validate(
        Object.assign(
          new ClockCommandDto(),
          command('adjust_clock', { remainingSeconds: 0 }),
        ),
      ),
    ).toEqual([]);
  });
});
