import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
  IsIn,
  IsUUID,
  Max,
  Min,
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

export class SaveAdvertisementDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @MinLength(2) name!: string;
  @IsIn(['gold', 'silver', 'bronze', 'supporter'])
  tier!: 'gold' | 'silver' | 'bronze' | 'supporter';
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() destinationUrl?: string;
  @IsOptional() @IsBoolean() websiteEnabled?: boolean;
  @IsOptional() @IsString() displayImageUrl?: string;
  @IsOptional() @IsBoolean() displayEnabled?: boolean;
  @IsOptional() @IsInt() @Min(5) @Max(60) displaySeconds?: number;
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
