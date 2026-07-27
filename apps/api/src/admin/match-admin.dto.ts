import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const MATCH_STATUSES = ['scheduled', 'postponed', 'cancelled'] as const;

export class CreateVenueDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(240) address?: string;
  @IsOptional() @IsString() @MaxLength(80) timezone?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class CreateCourtDto {
  @IsString() @MaxLength(80) name!: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

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
  teamADelegationId!: string;

  @IsUUID()
  teamBDelegationId!: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string; // ISO 8601

  @IsOptional()
  @IsUUID()
  courtId?: string;

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
  @IsUUID()
  courtId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  roundLabel?: string;

  @IsOptional()
  @IsIn(MATCH_STATUSES)
  status?: (typeof MATCH_STATUSES)[number];

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpsertMatchBroadcastDto {
  @IsOptional() @IsString() @MaxLength(80) provider?: string;
  @IsOptional() @IsString() @MaxLength(160) externalId?: string;
  @IsOptional() @IsString() @MaxLength(1000) watchUrl?: string;
  @IsOptional() @IsString() @MaxLength(1000) embedUrl?: string;
  @IsOptional() @IsString() @MaxLength(1000) replayUrl?: string;
  @IsIn(['unassigned', 'scheduled', 'live', 'ended', 'archived'])
  status!: 'unassigned' | 'scheduled' | 'live' | 'ended' | 'archived';
  @IsOptional() @IsBoolean() featured?: boolean;
}

export class CreateEdgeNodeDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsUUID() venueId?: string;
}
