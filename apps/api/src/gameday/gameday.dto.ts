import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const GAME_DAY_ROLES = [
  'match_supervisor',
  'scorer',
  'timekeeper',
  'stats_lineup',
  'result_approver',
] as const;
export type GameDayRole = (typeof GAME_DAY_ROLES)[number];

export class CreateGameDayAccountDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(2) displayName!: string;
  @IsString() @MinLength(12) password!: string;
  @IsIn(GAME_DAY_ROLES) role!: GameDayRole;
}

export class AssignGameDayOfficialDto {
  @IsUUID() appUserId!: string;
  @IsIn(GAME_DAY_ROLES) role!: GameDayRole;
}

export class VersionedCommandDto {
  @IsInt() @Min(0) expectedVersion!: number;
}

export class GoalDto extends VersionedCommandDto {
  @IsIn(['A', 'B']) teamSide!: 'A' | 'B';
  @IsOptional() @IsUUID() playerId?: string;
}

export class CentrePassDto extends VersionedCommandDto {
  @IsIn(['A', 'B']) teamSide!: 'A' | 'B';
}

export class IncidentDto extends VersionedCommandDto {
  @IsIn(['injury', 'warning', 'suspension', 'technical', 'other'])
  incidentType!: 'injury' | 'warning' | 'suspension' | 'technical' | 'other';
  @IsOptional() @IsIn(['A', 'B']) teamSide?: 'A' | 'B';
  @IsOptional() @IsUUID() playerId?: string;
  @IsString() @MinLength(3) note!: string;
}

export class StatisticDto extends VersionedCommandDto {
  @IsUUID() playerId!: string;
  @IsIn([
    'goal_attempt',
    'intercept',
    'gain',
    'turnover',
    'deflection',
    'rebound',
    'penalty',
  ])
  statisticType!:
    | 'goal_attempt'
    | 'intercept'
    | 'gain'
    | 'turnover'
    | 'deflection'
    | 'rebound'
    | 'penalty';
}

export class CorrectGoalDto extends VersionedCommandDto {
  @IsUUID() eventId!: string;
  @IsString() @MinLength(3) reason!: string;
}

export class ClockCommandDto extends VersionedCommandDto {
  @IsIn([
    'start_period',
    'start_clock',
    'stop_clock',
    'end_period',
    'suspend',
    'resume',
  ])
  action!:
    | 'start_period'
    | 'start_clock'
    | 'stop_clock'
    | 'end_period'
    | 'suspend'
    | 'resume';
  @IsOptional() @IsString() reason?: string;
}

export class PositionChangeDto extends VersionedCommandDto {
  @IsUUID() playerId!: string;
  @IsOptional()
  @IsIn([
    'Goal Shooter',
    'Goal Attack',
    'Wing Attack',
    'Centre',
    'Wing Defence',
    'Goal Defence',
    'Goal Keeper',
  ])
  position?: string | null;
  @IsString() @MinLength(3) reason!: string;
}

export class ConfirmResultDto extends VersionedCommandDto {
  @IsString() @MinLength(3) confirmationNote!: string;
}

export class TeamSheetPlayerDto {
  @IsUUID() playerId!: string;
  @IsOptional()
  @IsIn([
    'Goal Shooter',
    'Goal Attack',
    'Wing Attack',
    'Centre',
    'Wing Defence',
    'Goal Defence',
    'Goal Keeper',
  ])
  startingPosition?: string | null;
  @IsOptional() @IsBoolean() captain?: boolean;
}

export class SaveTeamSheetDto extends VersionedCommandDto {
  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(15)
  @ValidateNested({ each: true })
  @Type(() => TeamSheetPlayerDto)
  players!: TeamSheetPlayerDto[];
}
