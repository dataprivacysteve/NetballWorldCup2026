import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SESSION_COOKIE } from './cookie';
import type { Request } from 'express';
import type { SessionUser } from './auth.service';

interface SessionRequest extends Request {
  cookies: Record<string, string | undefined>;
  user?: SessionUser;
}

// Verifies the session cookie and attaches req.user. Apply to every
// authenticated route; runs before the TenantInterceptor so req.user.delegationId
// is available when the tenant transaction is opened.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<SessionRequest>();
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException('Not signed in');
    try {
      req.user = await this.auth.validateToken(token);
    } catch {
      throw new UnauthorizedException('Session invalid or expired');
    }
    return true;
  }
}

// Stopgap OC-admin gate. Use together with AuthGuard on admin routes.
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<SessionRequest>();
    if (!req.user?.platformRole && !req.user?.isAdmin) {
      throw new ForbiddenException('Platform account required');
    }
    return true;
  }
}

@Injectable()
export class LocOfficerGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<SessionRequest>();
    if (req.user?.platformRole !== 'loc_officer') {
      throw new ForbiddenException('LOC officer only');
    }
    return true;
  }
}

@Injectable()
export class SportsbbAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<SessionRequest>();
    if (req.user?.platformRole !== 'sportsbb_admin') {
      throw new ForbiddenException('SportsBB administrator only');
    }
    return true;
  }
}

@Injectable()
export class GameDayOfficialGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<SessionRequest>();
    if (
      ![
        'match_supervisor',
        'scorer',
        'timekeeper',
        'stats_lineup',
        'result_approver',
      ].includes(req.user?.platformRole ?? '')
    ) {
      throw new ForbiddenException('GameDay official account required');
    }
    return true;
  }
}
