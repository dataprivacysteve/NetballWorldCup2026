import { IsOptional, IsString } from 'class-validator';

export class ReturnRosterDto {
  @IsOptional() @IsString() note?: string;
}
