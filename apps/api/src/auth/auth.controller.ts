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
import { LoginDto } from './auth.dto';
import { clearSessionCookie, setSessionCookie } from './cookie';

@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.authenticate(dto.email, dto.password);
    setSessionCookie(res, this.auth.signToken(user), this.config);
    return this.auth.sessionSummary(user);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    clearSessionCookie(res, this.config);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: Request & { user: SessionUser }) {
    return this.auth.sessionSummary(req.user);
  }
}
