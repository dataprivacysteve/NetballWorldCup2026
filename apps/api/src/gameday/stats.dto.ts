import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { VersionedCommandDto } from './gameday.dto';

export const STATS_EVENT_TYPES = [
  'goal_made',
  'goal_miss',
  'centre_pass',
  'pass_received',
  'gain',
  'intercept',
  'turnover',
  'deflection',
  'rebound',
  'penalty',
  'timeout',
] as const;
export type StatsEventType = (typeof STATS_EVENT_TYPES)[number];

export class RecordStatsEventDto extends VersionedCommandDto {
  @IsIn(STATS_EVENT_TYPES) statisticType!: StatsEventType;
  @IsIn(['A', 'B']) teamSide!: 'A' | 'B';
  @IsOptional() @IsUUID() playerId?: string;
  @IsOptional()
  @IsIn(['contact', 'obstruction', 'held_ball', 'offside', 'other'])
  penaltyType?: 'contact' | 'obstruction' | 'held_ball' | 'offside' | 'other';
  @IsOptional() @IsString() @MaxLength(240) note?: string;
}

export class CorrectStatsEventDto extends VersionedCommandDto {
  @IsUUID() eventId!: string;
  @IsString() @MinLength(3) @MaxLength(240) reason!: string;
}
