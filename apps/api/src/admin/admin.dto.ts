import { IsDateString, IsOptional, IsString, ValidateIf } from 'class-validator';

export class ReturnRosterDto {
  @IsOptional() @IsString() note?: string;
}

export class SetWindowDto {
  // ISO date-time to set the cutoff, or null to clear it (re-open).
  @IsOptional()
  @ValidateIf((o) => o.closesAt !== null)
  @IsDateString()
  closesAt?: string | null;
}
