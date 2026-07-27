import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) password!: string;
}

export class RequestPasswordResetDto {
  @IsEmail() email!: string;
}

export class CompletePasswordResetDto {
  @IsString() @MinLength(32) token!: string;
  @IsString() @MinLength(12) password!: string;
}
