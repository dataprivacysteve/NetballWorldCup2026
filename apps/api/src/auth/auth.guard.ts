import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SESSION_COOKIE } from './cookie';

// Verifies the session cookie and attaches req.user. Apply to every
// authenticated route; runs before the TenantInterceptor so req.user.delegationId
// is available when the tenant transaction is opened.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException('Not signed in');
    try {
      req.user = this.auth.verifyToken(token);
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
    const req = ctx.switchToHttp().getRequest();
    if (!req.user?.isAdmin) throw new ForbiddenException('Administrator only');
    return true;
  }
}
