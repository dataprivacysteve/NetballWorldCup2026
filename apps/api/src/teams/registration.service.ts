import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { asc, eq } from 'drizzle-orm';
import { PG_POOL } from '../db/db.tokens';
import * as schema from '../db/schema';
import { hashPassword } from '../auth/password.util';
import type { SessionUser } from '../auth/auth.service';
import { RegisterDelegationDto } from './dto';

@Injectable()
export class RegistrationService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // Public country picker. eligible_country is not RLS-scoped, so gameday_app
  // reads it freely with no tenant context.
  async eligibleCountries() {
    const db = drizzle(this.pool, { schema });
    return db
      .select()
      .from(schema.eligibleCountry)
      .orderBy(asc(schema.eligibleCountry.name));
  }

  // Registers a delegation FOR APPROVAL and creates its manager account.
  // The delegation id is generated app-side and the tenant context is set to
  // it, so the delegation + membership rows satisfy their own RLS WITH CHECK
  // without bypassing RLS. registration_status starts at 'submitted' — the OC
  // must approve before the manager can enter roster data.
  async register(dto: RegisterDelegationDto): Promise<SessionUser> {
    if (!dto.dpaConsent) {
      throw new BadRequestException(
        'The data-processing acknowledgement must be confirmed to register.',
      );
    }

    const delegationId = randomUUID();
    const email = dto.contactEmail.toLowerCase();
    const passwordHash = await hashPassword(dto.password);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "SELECT set_config('app.current_delegation_id', $1, true)",
        [delegationId],
      );
      const db = drizzle(client, { schema });

      const [country] = await db
        .select()
        .from(schema.eligibleCountry)
        .where(eq(schema.eligibleCountry.code, dto.countryCode.toUpperCase()));
      if (!country) {
        throw new BadRequestException('Unknown country code.');
      }

      const [event] = await db.select().from(schema.tournament).limit(1);
      if (!event) throw new BadRequestException('No tournament is configured.');

      const [created] = await db
        .insert(schema.delegation)
        .values({
          id: delegationId,
          tournamentId: event.id,
          countryCode: country.code,
          name: country.name,
          registrationStatus: 'submitted',
          registrationSubmittedAt: new Date(),
          associationName: dto.associationName,
          headOfDelegation: dto.headOfDelegation,
          headCoach: dto.headCoach,
          contactEmail: email,
          contactPhone: dto.contactPhone,
          expectedSquadSize: dto.expectedSquadSize,
          travellingParty: dto.travellingParty,
          arrivalDate: dto.arrivalDate,
          departureDate: dto.departureDate,
          notes: dto.notes,
          dpaConsent: true,
        })
        .returning();

      const [user] = await db
        .insert(schema.appUser)
        .values({
          email,
          displayName: dto.headOfDelegation,
          passwordHash,
        })
        .returning();

      await db.insert(schema.delegationMembership).values({
        delegationId,
        appUserId: user.id,
        role: 'manager',
      });

      await client.query('COMMIT');
      return { userId: user.id, delegationId: created.id, isAdmin: false };
    } catch (err: unknown) {
      await client.query('ROLLBACK').catch(() => {});
      if (isUniqueViolation(err, 'delegation_tournament_country_unique')) {
        throw new ConflictException(
          'This country has already been registered for the tournament.',
        );
      }
      if (isUniqueViolation(err, 'app_user_email_unique')) {
        throw new ConflictException('That email is already registered.');
      }
      throw err;
    } finally {
      client.release();
    }
  }
}

function isUniqueViolation(err: unknown, constraint: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === '23505' &&
    String((err as { constraint?: string }).constraint ?? '').includes(
      constraint,
    )
  );
}
