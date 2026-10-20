import { BadRequestException } from '@nestjs/common';
import type { match as matchTable } from '../db/schema/match';
import type { ClockCommandDto } from './gameday.dto';
import { canStartPeriod, clockRemaining } from './gameday-rules';

type Match = typeof matchTable.$inferSelect;

// Explicit quarter and match boundaries are independent of the clock value.
export function clockTransition(
  match: Match,
  dto: ClockCommandDto,
  userId: string,
  now: Date,
): Partial<typeof matchTable.$inferInsert> {
  const remaining = clockRemaining(
    match.clockRemainingSeconds,
    match.clockRunning,
    match.clockStartedAt,
    now,
  );
  const stopped = {
    clockRemainingSeconds: remaining,
    clockRunning: false,
    clockStartedAt: null,
  };
  const clockIsRunning = match.clockRunning && remaining > 0;
  const active = match.status === 'live' || match.status === 'suspended';
  const requireActive = () => {
    if (!active)
      throw new BadRequestException(
        'Start the game before operating its clock; ended games cannot be changed',
      );
  };
  switch (dto.action) {
    case 'set_start_countdown':
    case 'clear_start_countdown': {
      if (
        !['scheduled', 'ready'].includes(match.status) ||
        match.currentPeriod !== 0
      )
        throw new BadRequestException(
          'A start countdown can be set only before the game starts',
        );
      if (
        dto.action === 'set_start_countdown' &&
        ![5, 10, 15, 20].includes(dto.countdownMinutes ?? 0)
      )
        throw new BadRequestException('Select 5, 10, 15, or 20 minutes');
      return {
        startCountdownEndsAt:
          dto.action === 'clear_start_countdown'
            ? null
            : new Date(now.getTime() + dto.countdownMinutes! * 60_000),
      };
    }
    case 'start_period':
    case 'start_next_period':
      if (!canStartPeriod(match.status, match.currentPeriod))
        throw new BadRequestException(
          'There is no next quarter for this match',
        );
      return {
        currentPeriod: match.currentPeriod + 1,
        status: 'live',
        periodEndedAt: null,
        clockRemainingSeconds: match.periodDurationSeconds,
        clockRunning: dto.action === 'start_next_period',
        clockStartedAt: dto.action === 'start_next_period' ? now : null,
      };
    case 'start_clock':
    case 'resume':
      requireActive();
      return {
        status: 'live',
        periodEndedAt: null,
        clockRemainingSeconds: remaining,
        clockRunning: true,
        clockStartedAt: now,
      };
    case 'stop_clock':
      requireActive();
      return stopped;
    case 'adjust_clock':
      requireActive();
      if (
        !Number.isInteger(dto.remainingSeconds) ||
        dto.remainingSeconds! < 0 ||
        dto.remainingSeconds! > 86400
      )
        throw new BadRequestException(
          'Remaining time must be between 0 and 86400 seconds',
        );
      return {
        clockRemainingSeconds: dto.remainingSeconds,
        clockRunning: clockIsRunning && dto.remainingSeconds! > 0,
        clockStartedAt:
          clockIsRunning && dto.remainingSeconds! > 0 ? now : null,
      };
    case 'end_period':
      requireActive();
      return { ...stopped, status: 'live', periodEndedAt: now };
    case 'end_game':
      requireActive();
      return {
        ...stopped,
        status: 'final',
        resultConfirmedAt: now,
        resultConfirmedBy: userId,
        startCountdownEndsAt: null,
      };
    case 'suspend':
      requireActive();
      if (!dto.reason?.trim())
        throw new BadRequestException('A suspension reason is required');
      return { ...stopped, status: 'suspended' };
    default:
      throw new BadRequestException('Unknown clock command');
  }
}
