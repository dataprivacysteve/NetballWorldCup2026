import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { PRIVILEGED_POOL } from '../db/db.tokens';
import * as schema from '../db/schema';
import { hashPassword, verifyPassword } from './password.util';
import { MailService } from '../mail/mail.service';

export interface SessionUser {
  userId: string;
  delegationId: string | null;
  isAdmin: boolean;
  platformRole: PlatformRole | null;
  authVersion: number;
}

export type PlatformRole =
  | 'sportsbb_admin'
  | 'loc_officer'
  | 'match_supervisor'
  | 'scorer'
  | 'timekeeper'
  | 'stats_lineup'
  | 'result_approver';

@Injectable()
export class AuthService {
  private readonly db: NodePgDatabase<typeof schema>;

  // Uses the privileged pool: login must look up identity + membership BEFORE
  // any tenant context exists (which delegation does this user belong to?).
  // This is trusted auth code, not tenant data access.
  constructor(
    @Inject(PRIVILEGED_POOL) private readonly pool: Pool,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {
    this.db = drizzle(pool, { schema });
  }

  async authenticate(email: string, password: string): Promise<SessionUser> {
    const [user] = await this.db
      .select()
      .from(schema.appUser)
      .where(eq(schema.appUser.email, email.toLowerCase()));
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid email or password');

    let delegationId: string | null = null;
    if (!user.platformRole && !user.isAdmin) {
      const [membership] = await this.db
        .select()
        .from(schema.delegationMembership)
        .where(eq(schema.delegationMembership.appUserId, user.id))
        .limit(1);
      delegationId = membership?.delegationId ?? null;
    }
    return {
      userId: user.id,
      delegationId,
      isAdmin: !!user.platformRole || user.isAdmin,
      platformRole: user.platformRole ?? (user.isAdmin ? 'loc_officer' : null),
      authVersion: user.authVersion,
    };
  }

  signToken(u: SessionUser): string {
    return this.jwt.sign({
      sub: u.userId,
      did: u.delegationId,
      adm: u.isAdmin,
      role: u.platformRole,
      ver: u.authVersion,
    });
  }

  async validateToken(token: string): Promise<SessionUser> {
    const p = this.jwt.verify<{
      sub: string;
      did: string | null;
      adm: boolean;
      role?: PlatformRole | null;
      ver?: number;
    }>(token);
    const [user] = await this.db
      .select({
        isAdmin: schema.appUser.isAdmin,
        platformRole: schema.appUser.platformRole,
        authVersion: schema.appUser.authVersion,
      })
      .from(schema.appUser)
      .where(eq(schema.appUser.id, p.sub));
    if (!user || user.authVersion !== (p.ver ?? 0)) {
      throw new UnauthorizedException('Session invalid or revoked');
    }
    return {
      userId: p.sub,
      delegationId: p.did ?? null,
      isAdmin: !!user.platformRole || user.isAdmin,
      platformRole: user.platformRole ?? (user.isAdmin ? 'loc_officer' : null),
      authVersion: user.authVersion,
    };
  }

  async requestPasswordReset(email: string, requestedIp: string | null) {
    const [user] = await this.db
      .select({ id: schema.appUser.id, email: schema.appUser.email })
      .from(schema.appUser)
      .where(eq(schema.appUser.email, email.toLowerCase()));
    if (!user) return { accepted: true };

    const token = randomBytes(32).toString('base64url');
    const tokenHash = digestToken(token);
    await this.db.insert(schema.passwordResetToken).values({
      appUserId: user.id,
      tokenHash,
      requestedIp,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    const resetUrl = `${this.config.get<string>('TEAMS_BASE_URL', 'https://teams.netballamericas.test')}/reset-password?token=${encodeURIComponent(token)}`;
    try {
      await this.mail.send({
        to: user.email,
        template: 'gameday-password-reset',
        subject: 'Reset your GameDay password',
        text: `Reset your GameDay password using this link: ${resetUrl}\n\nThis link expires in 30 minutes.`,
        html: `<p>Reset your GameDay password using the link below.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 30 minutes.</p>`,
        variables: { resetUrl, expiresInMinutes: 30 },
      });
      return { accepted: true };
    } catch (error) {
      if (this.config.get<string>('NODE_ENV') === 'production') throw error;
      return { accepted: true, devResetToken: token };
    }
  }

  async completePasswordReset(token: string, password: string) {
    const tokenHash = digestToken(token);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const db = drizzle(client, { schema });
      const [reset] = await db
        .select()
        .from(schema.passwordResetToken)
        .where(
          and(
            eq(schema.passwordResetToken.tokenHash, tokenHash),
            isNull(schema.passwordResetToken.usedAt),
            gt(schema.passwordResetToken.expiresAt, new Date()),
          ),
        );
      if (!reset)
        throw new BadRequestException('Reset link is invalid or expired');
      await db
        .update(schema.appUser)
        .set({
          passwordHash: await hashPassword(password),
          authVersion: sql`${schema.appUser.authVersion} + 1`,
        })
        .where(eq(schema.appUser.id, reset.appUserId));
      await db
        .update(schema.passwordResetToken)
        .set({ usedAt: new Date() })
        .where(eq(schema.passwordResetToken.id, reset.id));
      await client.query('COMMIT');
      return { reset: true };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async revokeAllSessions(userId: string) {
    await this.db
      .update(schema.appUser)
      .set({ authVersion: sql`${schema.appUser.authVersion} + 1` })
      .where(eq(schema.appUser.id, userId));
    return { revoked: true };
  }

  // Identity + delegation summary for GET /me and the login response, so the UI
  // knows the approval state. Privileged read (own identity).
  async sessionSummary(u: SessionUser) {
    const [user] = await this.db
      .select()
      .from(schema.appUser)
      .where(eq(schema.appUser.id, u.userId));
    let delegation: {
      id: string;
      name: string;
      countryCode: string;
      registrationStatus: string;
      status: string;
    } | null = null;
    if (u.delegationId) {
      const [d] = await this.db
        .select()
        .from(schema.delegation)
        .where(eq(schema.delegation.id, u.delegationId));
      if (d) {
        delegation = {
          id: d.id,
          name: d.name,
          countryCode: d.countryCode,
          registrationStatus: d.registrationStatus,
          status: d.status,
        };
      }
    }
    return {
      user: user
        ? {
            email: user.email,
            displayName: user.displayName,
            isAdmin: !!user.platformRole || user.isAdmin,
            platformRole:
              user.platformRole ?? (user.isAdmin ? 'loc_officer' : null),
          }
        : null,
      delegation,
    };
  }
}

function digestToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
