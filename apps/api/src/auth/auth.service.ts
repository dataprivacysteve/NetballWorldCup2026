import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { PRIVILEGED_POOL } from '../db/db.tokens';
import * as schema from '../db/schema';
import { verifyPassword } from './password.util';

export interface SessionUser {
  userId: string;
  delegationId: string | null;
  isAdmin: boolean;
}

@Injectable()
export class AuthService {
  private readonly db: NodePgDatabase<typeof schema>;

  // Uses the privileged pool: login must look up identity + membership BEFORE
  // any tenant context exists (which delegation does this user belong to?).
  // This is trusted auth code, not tenant data access.
  constructor(
    @Inject(PRIVILEGED_POOL) pool: Pool,
    private readonly jwt: JwtService,
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
    if (!user.isAdmin) {
      const [membership] = await this.db
        .select()
        .from(schema.delegationMembership)
        .where(eq(schema.delegationMembership.appUserId, user.id))
        .limit(1);
      delegationId = membership?.delegationId ?? null;
    }
    return { userId: user.id, delegationId, isAdmin: user.isAdmin };
  }

  signToken(u: SessionUser): string {
    return this.jwt.sign({ sub: u.userId, did: u.delegationId, adm: u.isAdmin });
  }

  verifyToken(token: string): SessionUser {
    const p = this.jwt.verify<{ sub: string; did: string | null; adm: boolean }>(
      token,
    );
    return { userId: p.sub, delegationId: p.did ?? null, isAdmin: !!p.adm };
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
        ? { email: user.email, displayName: user.displayName, isAdmin: user.isAdmin }
        : null,
      delegation,
    };
  }
}
