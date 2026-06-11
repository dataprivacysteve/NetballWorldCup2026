import {
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class ReturnRosterDto {
  @IsOptional() @IsString() note?: string;
}

export class ScanDto {
  @IsString() @MinLength(1) token!: string;
}

export class SetWindowDto {
  // ISO date-time to set the cutoff, or null to clear it (re-open).
  @IsOptional()
  @ValidateIf((o) => o.closesAt !== null)
  @IsDateString()
  closesAt?: string | null;
}
