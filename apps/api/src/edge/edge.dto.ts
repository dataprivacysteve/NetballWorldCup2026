import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class EdgeSyncBatchDto {
  @IsString() @MinLength(8) clientBatchId!: string;
  @IsUUID() matchId!: string;
  @IsObject() state!: Record<string, unknown>;
  @IsArray() @ArrayMaxSize(2000) events!: Array<Record<string, unknown>>;
  @IsArray() @ArrayMaxSize(100) lineups!: Array<Record<string, unknown>>;
}
