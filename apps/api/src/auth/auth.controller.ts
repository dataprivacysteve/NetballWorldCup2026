import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService, SessionUser } from './auth.service';
import { AuthGuard } from './auth.guard';
import {
  CompletePasswordResetDto,
  LoginDto,
  RequestPasswordResetDto,
} from './auth.dto';
import { clearSessionCookie, setSessionCookie } from './cookie';
import { AuthRateLimitService } from './auth-rate-limit.service';

@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = `${reqIp(res.req)}:${dto.email.toLowerCase()}`;
    this.rateLimit.assertAllowed(key);
    try {
      const user = await this.auth.authenticate(dto.email, dto.password);
      this.rateLimit.success(key);
      setSessionCookie(res, this.auth.signToken(user), this.config);
      return this.auth.sessionSummary(user);
    } catch (error) {
      this.rateLimit.failure(key);
      throw error;
    }
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    clearSessionCookie(res, this.config);
    return { ok: true };
  }

  @Post('password-reset/request')
  requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
    @Req() req: Request,
  ) {
    const key = `reset:${reqIp(req)}:${dto.email.toLowerCase()}`;
    this.rateLimit.assertAllowed(key);
    this.rateLimit.failure(key);
    return this.auth.requestPasswordReset(dto.email, req.ip ?? null);
  }

  @Post('password-reset/complete')
  completePasswordReset(@Body() dto: CompletePasswordResetDto) {
    return this.auth.completePasswordReset(dto.token, dto.password);
  }

  @Post('sessions/revoke-all')
  @UseGuards(AuthGuard)
  async revokeAll(
    @Req() req: Request & { user: SessionUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.revokeAllSessions(req.user.userId);
    clearSessionCookie(res, this.config);
    return result;
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: Request & { user: SessionUser }) {
    return this.auth.sessionSummary(req.user);
  }
}

function reqIp(req: Request | undefined) {
  return req?.ip ?? req?.socket.remoteAddress ?? 'unknown';
}
