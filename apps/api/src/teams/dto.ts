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
  MinLength,
} from 'class-validator';

export class RegisterDelegationDto {
  // Chosen from GET /eligible-countries.
  @IsString() @Length(2, 3) countryCode!: string;
  @IsString() @MinLength(2) associationName!: string;
  @IsString() @MinLength(2) headOfDelegation!: string;
  @IsOptional() @IsString() headCoach?: string;
  // The HOD's login + primary contact, and the password that unlocks roster
  // access once the OC approves.
  @IsEmail() contactEmail!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @MinLength(5) contactPhone!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) expectedSquadSize?: number;
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
}

export class CreatePlayerDto {
  @IsString() @MinLength(1) firstName!: string;
  @IsString() @MinLength(1) lastName!: string;
  // YYYY-MM-DD. Required so under-18 status (and thus the consent requirement)
  // can be derived. DOB-for-age only — not the Section 11 identity DOB.
  @IsDateString() dateOfBirth!: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) jerseyNumber?: number;
}

export class UpdatePlayerDto {
  @IsOptional() @IsString() @MinLength(1) firstName?: string;
  @IsOptional() @IsString() @MinLength(1) lastName?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) jerseyNumber?: number;
}

export class CreateConsentDto {
  @IsIn(['player', 'guardian']) type!: 'player' | 'guardian';
  @IsBoolean() consentGiven!: boolean;
  @IsString() @MinLength(2) consentingPartyName!: string;
  @IsOptional() @IsString() relationship?: string;
}
