import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { RegistrationService } from './registration.service';
import { AuthService } from '../auth/auth.service';
import { setSessionCookie } from '../auth/cookie';
import { RegisterDelegationDto } from './dto';

// Public (no auth, no tenant): the front door. The country picker and the
// registration that creates a delegation + its manager account.
@Controller()
export class RegistrationController {
  constructor(
    private readonly registration: RegistrationService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('eligible-countries')
  eligibleCountries() {
    return this.registration.eligibleCountries();
  }

  @Post('register')
  async register(
    @Body() dto: RegisterDelegationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionUser = await this.registration.register(dto);
    // Sign the HOD in immediately; roster access stays gated by the approval
    // check until the OC approves.
    setSessionCookie(res, this.auth.signToken(sessionUser), this.config);
    return this.auth.sessionSummary(sessionUser);
  }
}
