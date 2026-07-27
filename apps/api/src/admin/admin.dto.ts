import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
  IsIn,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReturnRosterDto {
  @IsString() @MinLength(1) note!: string;
}

export class RejectRegistrationDto {
  @IsString() @MinLength(1) reason!: string;
}

export class ScanDto {
  @IsString() @MinLength(1) token!: string;
}

export class OfflineScanEventDto {
  @IsString() @MinLength(8) clientEventId!: string;
  @IsString() @MinLength(1) token!: string;
  @IsDateString() scannedAt!: string;
  @IsBoolean() offlineValid!: boolean;
  @IsOptional() @IsString() offlineReason?: string;
}

export class SyncOfflineScansDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => OfflineScanEventDto)
  events!: OfflineScanEventDto[];
}

export class SetWindowDto {
  // ISO date-time to set the cutoff, or null to clear it (re-open).
  @IsOptional()
  @ValidateIf((value: SetWindowDto) => value.closesAt !== null)
  @IsDateString()
  closesAt?: string | null;
}

export class VerifyIdentityDto {
  @IsUUID()
  documentId!: string;
  @IsIn(['verified', 'rejected'])
  status!: 'verified' | 'rejected';
  @IsOptional() @IsString() note?: string;
}

export class RevokeCredentialDto {
  @IsString() @MinLength(3) reason!: string;
}
