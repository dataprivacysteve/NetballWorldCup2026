import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  MinLength,
  IsBoolean,
  IsUUID,
} from 'class-validator';

const PERSON_CATEGORIES = [
  'player',
  'official',
  'technical',
  'media',
  'broadcast',
] as const;

const OFFICIAL_ROLES = [
  'team_manager',
  'coach',
  'primary_care',
  'other',
] as const;

export class UpdateLaunchConfigurationDto {
  @IsOptional() @IsString() @MinLength(3) name?: string;
  @IsOptional() @IsString() @MinLength(2) shortName?: string;
  @IsOptional() @IsString() @MinLength(3) timezone?: string;
  @IsOptional() @IsDateString() startsOn?: string;
  @IsOptional() @IsDateString() endsOn?: string;
  @IsOptional() @IsDateString() eligibilityDate?: string;
  @IsOptional() @IsDateString() registrationOpensAt?: string | null;
  @IsOptional() @IsDateString() registrationClosesAt?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  activePlayerMinimum?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  activePlayerMaximum?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  reserveMaximum?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  benchMaximum?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(20)
  @Max(2000)
  biographyMinimumCharacters?: number;

  @IsOptional()
  @IsArray()
  @IsIn(OFFICIAL_ROLES, { each: true })
  requiredOfficialRoles?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(PERSON_CATEGORIES, { each: true })
  identityRequiredCategories?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(PERSON_CATEGORIES, { each: true })
  consentRequiredCategories?: string[];

  @IsOptional() @IsString() eligibilityRegulationReference?: string;
  @IsOptional() @IsObject() accessZoneMatrix?: Record<string, string[]>;
  @IsOptional() @IsString() brandPrimaryLogoUrl?: string;
  @IsOptional() @IsString() brandReverseLogoUrl?: string;
}

export class CreateEligibleCountryDto {
  @IsString() @Length(2, 3) code!: string;
  @IsString() @MinLength(2) name!: string;
}

export class UpdateEligibleCountryDto {
  @IsString() @MinLength(2) name!: string;
}

export class UpdatePublicExperienceDto {
  @IsOptional() @IsString() heroImageUrl?: string;
  @IsOptional() @IsString() heroStrapline?: string;
  @IsOptional() @IsString() ticketsUrl?: string;
  @IsOptional() @IsString() merchandiseUrl?: string;
  @IsOptional() @IsString() merchandiseImageUrl?: string;
  @IsOptional() @IsString() aboutText?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() delayedUpdatesMessage?: string;
}

export class SaveSponsorDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @MinLength(2) name!: string;
  @IsIn(['gold', 'silver', 'bronze', 'supporter']) tier!: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() destinationUrl?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class SaveNewsArticleDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @MinLength(2) slug!: string;
  @IsString() @MinLength(3) title!: string;
  @IsString() @MinLength(3) summary!: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsBoolean() published?: boolean;
}
