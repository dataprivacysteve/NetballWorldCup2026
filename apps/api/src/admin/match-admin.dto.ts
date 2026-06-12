import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

const MATCH_STATUSES = ['scheduled', 'live', 'final', 'postponed'] as const;

export class CreateStageDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsIn(['group', 'knockout'])
  kind?: 'group' | 'knockout';

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class EntryDto {
  @IsUUID()
  delegationId!: string;
}

export class CreateMatchDto {
  @IsOptional()
  @IsUUID()
  stageId?: string;

  @IsUUID()
  homeDelegationId!: string;

  @IsUUID()
  awayDelegationId!: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string; // ISO 8601

  @IsOptional()
  @IsString()
  @MaxLength(120)
  venue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  court?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  roundLabel?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateMatchDto {
  @IsOptional()
  @IsUUID()
  stageId?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  venue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  court?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  roundLabel?: string;

  @IsOptional()
  @IsIn(MATCH_STATUSES)
  status?: (typeof MATCH_STATUSES)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  homeScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  awayScore?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
