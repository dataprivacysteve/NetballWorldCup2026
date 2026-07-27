import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  Max,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDelegationDto {
  // Chosen from GET /eligible-countries.
  @IsString() @Length(2, 3) countryCode!: string;
  @IsString() @MinLength(2) teamName!: string;
  @IsString() @MinLength(2) associationName!: string;
  @IsString() @MinLength(2) headOfDelegation!: string;
  @IsOptional() @IsString() headCoach?: string;
  @IsString() @MinLength(2) contactName!: string;
  // The HOD's login + primary contact, and the password that unlocks roster
  // access once the OC approves.
  @IsEmail() contactEmail!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @MinLength(5) contactPhone!: string;
  @IsString() @MinLength(2) contactRoleTitle!: string;
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(18)
  expectedSquadSize!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) travellingParty?: number;
  @IsOptional() @IsDateString() arrivalDate?: string;
  @IsOptional() @IsDateString() departureDate?: string;
  @IsOptional() @IsString() notes?: string;
  // Must be true — the data-processing acknowledgement (Barbados DPA 2019-29).
  @IsBoolean() dpaConsent!: boolean;
}

export class UpdateDelegationDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() @Length(2, 3) countryCode?: string;
  @IsOptional() @IsString() @MinLength(2) associationName?: string;
  @IsOptional() @IsString() @MinLength(2) headOfDelegation?: string;
  @IsOptional() @IsString() headCoach?: string;
  @IsOptional() @IsString() @MinLength(2) contactName?: string;
  @IsOptional() @IsString() @MinLength(5) contactPhone?: string;
  @IsOptional() @IsString() @MinLength(2) contactRoleTitle?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(18)
  expectedSquadSize?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) travellingParty?: number;
  @IsOptional() @IsDateString() arrivalDate?: string;
  @IsOptional() @IsDateString() departureDate?: string;
  @IsOptional() @IsString() notes?: string;
}

export class CreatePlayerDto {
  @IsString() @MinLength(1) firstName!: string;
  @IsOptional() @IsString() middleNames?: string;
  @IsString() @MinLength(1) lastName!: string;
  @IsString() @Length(2, 3) nationality!: string;
  @IsString() @MinLength(1) biography!: string;
  // YYYY-MM-DD. Required for players so under-18 consent can be derived.
  // Officials do not provide DOB unless a future configured category requires it.
  @ValidateIf(
    (dto: CreatePlayerDto) =>
      dto.category === 'player' || dto.dateOfBirth !== undefined,
  )
  @IsDateString()
  dateOfBirth?: string;
  @IsIn(['player', 'official', 'technical', 'media', 'broadcast'])
  category!: 'player' | 'official' | 'technical' | 'media' | 'broadcast';
  // For players, a netball position (validated server-side); for others, a
  // free-text title (e.g. "Head Coach").
  @IsOptional() @IsString() role?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) jerseyNumber?: number;
  @IsOptional()
  @IsIn(['active', 'reserve'])
  rosterType?: 'active' | 'reserve';
  @IsOptional()
  @IsIn(['team_manager', 'coach', 'primary_care', 'other'])
  officialRole?: 'team_manager' | 'coach' | 'primary_care' | 'other';
  @IsOptional() @IsString() otherOfficialTitle?: string;
  @IsOptional() @IsBoolean() isHeadOfDelegation?: boolean;
  @IsOptional() @IsBoolean() benchEligible?: boolean;
  @IsBoolean() nationalityMatchesTeam!: boolean;
  @IsBoolean() eligibilityConfirmed!: boolean;
  @IsOptional() @IsString() eligibilityReference?: string;
}

export class UpdatePlayerDto {
  @IsOptional() @IsString() @MinLength(1) firstName?: string;
  @IsOptional() @IsString() middleNames?: string;
  @IsOptional() @IsString() @MinLength(1) lastName?: string;
  @IsOptional() @IsString() @Length(2, 3) nationality?: string;
  @IsOptional() @IsString() @MinLength(1) biography?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional()
  @IsIn(['player', 'official', 'technical', 'media', 'broadcast'])
  category?: 'player' | 'official' | 'technical' | 'media' | 'broadcast';
  @IsOptional() @IsString() role?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) jerseyNumber?: number;
  @IsOptional()
  @IsIn(['active', 'reserve'])
  rosterType?: 'active' | 'reserve';
  @IsOptional()
  @IsIn(['team_manager', 'coach', 'primary_care', 'other'])
  officialRole?: 'team_manager' | 'coach' | 'primary_care' | 'other';
  @IsOptional() @IsString() otherOfficialTitle?: string;
  @IsOptional() @IsBoolean() isHeadOfDelegation?: boolean;
  @IsOptional() @IsBoolean() benchEligible?: boolean;
  @IsOptional() @IsBoolean() nationalityMatchesTeam?: boolean;
  @IsOptional() @IsBoolean() eligibilityConfirmed?: boolean;
  @IsOptional() @IsString() eligibilityReference?: string;
}

export class CreateConsentDto {
  @IsIn(['player', 'guardian']) type!: 'player' | 'guardian';
  @IsBoolean() consentGiven!: boolean;
  @IsString() @MinLength(2) consentingPartyName!: string;
  @ValidateIf(
    (dto: CreateConsentDto) =>
      dto.type === 'guardian' || dto.relationship !== undefined,
  )
  @IsString()
  @MinLength(2)
  relationship?: string;
  @IsOptional() @IsString() consentingPartyPhone?: string;
}

export class IdentityUploadDto {
  @IsIn(['passport', 'national_id'])
  documentType!: 'passport' | 'national_id';
  @IsString() @Length(2, 3) issuingCountry!: string;
  @IsString() @Length(2, 3) nationality!: string;
  @ValidateIf(
    (dto: IdentityUploadDto) =>
      dto.documentType === 'passport' || dto.expiresOn !== undefined,
  )
  @IsDateString()
  expiresOn?: string;
}
