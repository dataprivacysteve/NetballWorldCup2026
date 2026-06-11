import { Type } from 'class-transformer';
import {
  IsBoolean,
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
  @IsString() @MinLength(2) name!: string;
  @IsString() @Length(2, 3) countryCode!: string;
  @IsEmail() managerEmail!: string;
  @IsString() @MinLength(2) managerName!: string;
}

export class UpdateDelegationDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() @Length(2, 3) countryCode?: string;
}

export class CreatePlayerDto {
  @IsString() @MinLength(2) fullName!: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) jerseyNumber?: number;
  @IsOptional() @IsBoolean() requiresGuardianConsent?: boolean;
}

export class UpdatePlayerDto {
  @IsOptional() @IsString() @MinLength(2) fullName?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) jerseyNumber?: number;
  @IsOptional() @IsBoolean() requiresGuardianConsent?: boolean;
}

export class CreateConsentDto {
  @IsIn(['player', 'guardian']) type!: 'player' | 'guardian';
  @IsBoolean() consentGiven!: boolean;
  @IsString() @MinLength(2) consentingPartyName!: string;
  @IsOptional() @IsString() relationship?: string;
}
