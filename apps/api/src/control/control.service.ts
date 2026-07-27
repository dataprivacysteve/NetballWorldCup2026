import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { PRIVILEGED_POOL } from '../db/db.tokens';
import * as schema from '../db/schema';
import {
  CreateEligibleCountryDto,
  UpdateEligibleCountryDto,
  UpdateLaunchConfigurationDto,
  UpdatePublicExperienceDto,
  SaveSponsorDto,
  SaveNewsArticleDto,
} from './control.dto';

@Injectable()
export class ControlService {
  private readonly db: NodePgDatabase<typeof schema>;

  constructor(@Inject(PRIVILEGED_POOL) pool: Pool) {
    this.db = drizzle(pool, { schema });
  }

  async configuration() {
    const [event] = await this.db.select().from(schema.tournament).limit(1);
    if (!event) throw new NotFoundException('No tournament is configured');
    const countries = await this.countries();
    return {
      event,
      countries,
      readiness: this.readiness(event, countries.length),
    };
  }

  async updateConfiguration(
    dto: UpdateLaunchConfigurationDto,
    actorUserId: string,
  ) {
    const [current] = await this.db.select().from(schema.tournament).limit(1);
    if (!current) throw new NotFoundException('No tournament is configured');
    if (current.configurationStatus === 'locked') {
      throw new ConflictException('Tournament configuration is locked');
    }
    const minimum = dto.activePlayerMinimum ?? current.activePlayerMinimum;
    const maximum = dto.activePlayerMaximum ?? current.activePlayerMaximum;
    if (maximum < minimum) {
      throw new BadRequestException(
        'Active-player maximum cannot be lower than the minimum',
      );
    }
    const opensAt = dto.registrationOpensAt
      ? new Date(dto.registrationOpensAt)
      : current.registrationOpensAt;
    const closesAt = dto.registrationClosesAt
      ? new Date(dto.registrationClosesAt)
      : current.registrationClosesAt;
    if (opensAt && closesAt && closesAt <= opensAt) {
      throw new BadRequestException('Registration must close after it opens');
    }
    if (
      dto.accessZoneMatrix &&
      Object.values(dto.accessZoneMatrix).some(
        (zones) =>
          !Array.isArray(zones) ||
          zones.some((zone) => typeof zone !== 'string' || !zone.trim()),
      )
    ) {
      throw new BadRequestException(
        'Every access-zone category must contain a list of zone names',
      );
    }

    const values = {
      ...dto,
      registrationOpensAt:
        dto.registrationOpensAt === undefined
          ? undefined
          : dto.registrationOpensAt
            ? new Date(dto.registrationOpensAt)
            : null,
      registrationClosesAt:
        dto.registrationClosesAt === undefined
          ? undefined
          : dto.registrationClosesAt
            ? new Date(dto.registrationClosesAt)
            : null,
      configurationStatus: 'draft' as const,
      configurationPublishedAt: null,
      configurationVersion: sql`${schema.tournament.configurationVersion} + 1`,
    };
    const [updated] = await this.db
      .update(schema.tournament)
      .set(values)
      .where(eq(schema.tournament.id, current.id))
      .returning();
    await this.audit(actorUserId, 'configuration.updated', current.id, {
      fields: Object.keys(dto),
      version: updated.configurationVersion,
    });
    return this.configuration();
  }

  async publish(actorUserId: string) {
    const config = await this.configuration();
    if (config.event.configurationStatus === 'locked') {
      throw new ConflictException('Tournament configuration is locked');
    }
    if (config.readiness.problems.length) {
      throw new BadRequestException({
        message: 'Configuration is not ready to publish',
        problems: config.readiness.problems,
      });
    }
    const publishedAt = new Date();
    const [event] = await this.db
      .update(schema.tournament)
      .set({
        configurationStatus: 'published',
        configurationPublishedAt: publishedAt,
      })
      .where(eq(schema.tournament.id, config.event.id))
      .returning();
    await this.audit(actorUserId, 'configuration.published', event.id, {
      version: event.configurationVersion,
      publishedAt: publishedAt.toISOString(),
    });
    return this.configuration();
  }

  async lock(actorUserId: string) {
    const config = await this.configuration();
    if (config.event.configurationStatus !== 'published') {
      throw new ConflictException(
        'Publish the configuration before locking it',
      );
    }
    await this.db
      .update(schema.tournament)
      .set({ configurationStatus: 'locked' })
      .where(eq(schema.tournament.id, config.event.id));
    await this.audit(actorUserId, 'configuration.locked', config.event.id, {
      version: config.event.configurationVersion,
    });
    return this.configuration();
  }

  countries() {
    return this.db
      .select()
      .from(schema.eligibleCountry)
      .orderBy(asc(schema.eligibleCountry.name));
  }

  async addCountry(dto: CreateEligibleCountryDto, actorUserId: string) {
    const code = dto.code.toUpperCase();
    try {
      const [country] = await this.db
        .insert(schema.eligibleCountry)
        .values({ code, name: dto.name.trim() })
        .returning();
      await this.audit(actorUserId, 'country.added', null, country);
      return country;
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('That country is already eligible');
      }
      throw error;
    }
  }

  async updateCountry(
    code: string,
    dto: UpdateEligibleCountryDto,
    actorUserId: string,
  ) {
    const normalized = code.toUpperCase();
    const [country] = await this.db
      .update(schema.eligibleCountry)
      .set({ name: dto.name.trim() })
      .where(eq(schema.eligibleCountry.code, normalized))
      .returning();
    if (!country) throw new NotFoundException('Eligible country not found');
    await this.audit(actorUserId, 'country.updated', null, country);
    return country;
  }

  async removeCountry(code: string, actorUserId: string) {
    const normalized = code.toUpperCase();
    const [inUse] = await this.db
      .select({ id: schema.delegation.id })
      .from(schema.delegation)
      .where(eq(schema.delegation.countryCode, normalized))
      .limit(1);
    if (inUse) {
      throw new ConflictException(
        'A registered delegation already uses this country',
      );
    }
    const [removed] = await this.db
      .delete(schema.eligibleCountry)
      .where(eq(schema.eligibleCountry.code, normalized))
      .returning();
    if (!removed) throw new NotFoundException('Eligible country not found');
    await this.audit(actorUserId, 'country.removed', null, removed);
    return { ok: true };
  }

  auditHistory() {
    return this.db
      .select({
        id: schema.locAuditEvent.id,
        action: schema.locAuditEvent.action,
        targetType: schema.locAuditEvent.targetType,
        targetId: schema.locAuditEvent.targetId,
        details: schema.locAuditEvent.details,
        createdAt: schema.locAuditEvent.createdAt,
        actorName: schema.appUser.displayName,
      })
      .from(schema.locAuditEvent)
      .innerJoin(
        schema.appUser,
        eq(schema.appUser.id, schema.locAuditEvent.actorUserId),
      )
      .orderBy(desc(schema.locAuditEvent.createdAt))
      .limit(200);
  }

  async publicExperience() {
    const [event] = await this.db.select().from(schema.tournament).limit(1);
    if (!event) throw new NotFoundException('No tournament is configured');
    const [experience, sponsors, news] = await Promise.all([
      this.db
        .select()
        .from(schema.publicExperience)
        .where(eq(schema.publicExperience.tournamentId, event.id))
        .then((rows) => rows[0] ?? null),
      this.db
        .select()
        .from(schema.sponsor)
        .where(eq(schema.sponsor.tournamentId, event.id))
        .orderBy(asc(schema.sponsor.sortOrder), asc(schema.sponsor.name)),
      this.db
        .select()
        .from(schema.newsArticle)
        .where(eq(schema.newsArticle.tournamentId, event.id))
        .orderBy(
          desc(schema.newsArticle.publishedAt),
          desc(schema.newsArticle.createdAt),
        ),
    ]);
    return { experience, sponsors, news };
  }

  async updatePublicExperience(
    dto: UpdatePublicExperienceDto,
    actorUserId: string,
  ) {
    const [event] = await this.db.select().from(schema.tournament).limit(1);
    if (!event) throw new NotFoundException('No tournament is configured');
    const values = Object.fromEntries(
      Object.entries(dto).map(([key, value]) => [
        key,
        typeof value === 'string' ? value.trim() || null : value,
      ]),
    );
    const [experience] = await this.db
      .insert(schema.publicExperience)
      .values({
        tournamentId: event.id,
        ...values,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.publicExperience.tournamentId,
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    await this.audit(actorUserId, 'public_experience.updated', event.id, {
      fields: Object.keys(dto),
    });
    return experience;
  }

  async saveSponsor(dto: SaveSponsorDto, actorUserId: string) {
    const [event] = await this.db.select().from(schema.tournament).limit(1);
    if (!event) throw new NotFoundException('No tournament is configured');
    const values = {
      tournamentId: event.id,
      name: dto.name.trim(),
      tier: dto.tier,
      logoUrl: dto.logoUrl?.trim() || null,
      destinationUrl: dto.destinationUrl?.trim() || null,
      active: dto.active ?? true,
      sortOrder: dto.sortOrder ?? 0,
    };
    const [sponsor] = dto.id
      ? await this.db
          .update(schema.sponsor)
          .set(values)
          .where(eq(schema.sponsor.id, dto.id))
          .returning()
      : await this.db.insert(schema.sponsor).values(values).returning();
    if (!sponsor) throw new NotFoundException('Sponsor not found');
    await this.audit(actorUserId, 'sponsor.saved', event.id, {
      sponsorId: sponsor.id,
    });
    return sponsor;
  }

  async deleteSponsor(id: string, actorUserId: string) {
    const [removed] = await this.db
      .delete(schema.sponsor)
      .where(eq(schema.sponsor.id, id))
      .returning();
    if (!removed) throw new NotFoundException('Sponsor not found');
    await this.audit(actorUserId, 'sponsor.removed', removed.tournamentId, {
      sponsorId: id,
    });
    return { ok: true };
  }

  async saveNews(dto: SaveNewsArticleDto, actorUserId: string) {
    const [event] = await this.db.select().from(schema.tournament).limit(1);
    if (!event) throw new NotFoundException('No tournament is configured');
    const values = {
      tournamentId: event.id,
      slug: dto.slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-'),
      title: dto.title.trim(),
      summary: dto.summary.trim(),
      body: dto.body?.trim() || null,
      imageUrl: dto.imageUrl?.trim() || null,
      published: dto.published ?? false,
      publishedAt: dto.published ? new Date() : null,
    };
    const [article] = dto.id
      ? await this.db
          .update(schema.newsArticle)
          .set(values)
          .where(eq(schema.newsArticle.id, dto.id))
          .returning()
      : await this.db.insert(schema.newsArticle).values(values).returning();
    if (!article) throw new NotFoundException('News article not found');
    await this.audit(actorUserId, 'news.saved', event.id, {
      articleId: article.id,
      published: article.published,
    });
    return article;
  }

  async deleteNews(id: string, actorUserId: string) {
    const [removed] = await this.db
      .delete(schema.newsArticle)
      .where(eq(schema.newsArticle.id, id))
      .returning();
    if (!removed) throw new NotFoundException('News article not found');
    await this.audit(actorUserId, 'news.removed', removed.tournamentId, {
      articleId: id,
    });
    return { ok: true };
  }

  private readiness(
    event: typeof schema.tournament.$inferSelect,
    countryCount: number,
  ) {
    const problems: string[] = [];
    if (!event.name.trim()) problems.push('Tournament name is required.');
    if (!event.startsOn || !event.endsOn)
      problems.push('Event dates are required.');
    if (!event.eligibilityDate) problems.push('Eligibility date is required.');
    if (!event.registrationOpensAt || !event.registrationClosesAt) {
      problems.push('Registration opening and closing dates are required.');
    }
    if (!event.brandPrimaryLogoUrl)
      problems.push('Primary event logo is required.');
    if (!event.requiredOfficialRoles.length) {
      problems.push('At least one required team-official role is required.');
    }
    if (!event.identityRequiredCategories.includes('player')) {
      problems.push('Player identity verification must remain enabled.');
    }
    if (!countryCount)
      problems.push('At least one eligible country is required.');
    return { ready: problems.length === 0, problems };
  }

  private audit(
    actorUserId: string,
    action: string,
    targetId: string | null,
    details?: Record<string, unknown>,
  ) {
    return this.db.insert(schema.locAuditEvent).values({
      actorUserId,
      action,
      targetType: 'tournament_configuration',
      targetId,
      details,
    });
  }
}

function isUniqueViolation(error: unknown) {
  const candidates = [error, (error as { cause?: unknown })?.cause];
  return candidates.some(
    (candidate) =>
      typeof candidate === 'object' &&
      candidate !== null &&
      (candidate as { code?: string }).code === '23505',
  );
}
