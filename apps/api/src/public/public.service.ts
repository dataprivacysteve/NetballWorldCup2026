import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import { PUBLIC_POOL } from '../db/db.tokens';
import {
  aggregateMatchAnalytics,
  aggregatePeriodScores,
  selectEligibleTopScorer,
  summarizeProvenanceCoverage,
  type PublicMatchProvenance,
  type PublicMatchEvent,
} from './analytics';

// ---------------------------------------------------------------------------
// Module 4 — the public read layer for the www surface.
//
// Reads through the PUBLIC_POOL (gameday_public): SELECT-only, and granted ONLY
// the public match tables + the public-safe views (v_public_nation,
// v_public_squad_member). It physically cannot reach tenant-private data, so
// these handlers can be unauthenticated and CDN-cacheable. Standings are
// DERIVED here (not stored), so they always reflect the current results.
// ---------------------------------------------------------------------------

// Points model (Module 4 decision; make config-driven for the export chassis).
const WIN_POINTS = 2;
const QUALIFY_TOP = 2; // top N of each group advance to the World Cup.
const POSITION_NAMES: Record<string, string> = {
  GS: 'Goal Shooter',
  GA: 'Goal Attack',
  WA: 'Wing Attack',
  C: 'Centre',
  WD: 'Wing Defence',
  GD: 'Goal Defence',
  GK: 'Goal Keeper',
};

const MATCH_SELECT = `
  SELECT m.id, m.scheduled_at AS "scheduledAt", v.name AS venue, c.name AS court,
         m.round_label AS "roundLabel", m.status,
         m.team_a_score AS "teamAScore", m.team_b_score AS "teamBScore",
         m.current_period AS "currentPeriod",
         m.period_duration_seconds AS "periodDurationSeconds",
         m.clock_remaining_seconds AS "clockRemainingSeconds",
         m.clock_running AS "clockRunning",
         m.clock_started_at AS "clockStartedAt",
         s.name AS "stageName",
         ta.country_code AS "teamACode", ta.name AS "teamAName",
         tb.country_code AS "teamBCode", tb.name AS "teamBName",
         mb.provider AS "broadcastProvider", mb.watch_url AS "watchUrl",
         mb.embed_url AS "embedUrl", mb.replay_url AS "replayUrl",
         mb.status AS "broadcastStatus", mb.featured AS "broadcastFeatured"
  FROM match m
  LEFT JOIN stage s ON s.id = m.stage_id
  LEFT JOIN court c ON c.id = m.court_id
  LEFT JOIN venue v ON v.id = c.venue_id
  JOIN v_public_nation ta ON ta.id = m.team_a_delegation_id
  JOIN v_public_nation tb ON tb.id = m.team_b_delegation_id
  LEFT JOIN match_broadcast mb ON mb.match_id = m.id
`;

interface MatchRow {
  id: string;
  scheduledAt: Date | null;
  venue: string | null;
  court: string | null;
  roundLabel: string | null;
  status: string;
  teamAScore: number;
  teamBScore: number;
  stageName: string | null;
  teamACode: string;
  teamAName: string;
  teamBCode: string;
  teamBName: string;
  currentPeriod: number;
  periodDurationSeconds: number;
  clockRemainingSeconds: number;
  clockRunning: boolean;
  clockStartedAt: Date | null;
  broadcastProvider: string | null;
  watchUrl: string | null;
  embedUrl: string | null;
  replayUrl: string | null;
  broadcastStatus: string | null;
  broadcastFeatured: boolean | null;
}

export interface TournamentRow {
  name: string;
  slug: string;
  startsOn: string | null;
  endsOn: string | null;
  venue: string | null;
  shortName: string | null;
  timezone: string;
  brandPrimaryLogoUrl: string | null;
  brandReverseLogoUrl: string | null;
  publicSiteLive: boolean;
}

export interface NationRow {
  countryCode: string;
  name: string;
  group: string | null;
}

export interface SquadMemberRow {
  firstName: string;
  lastName: string;
  role: string | null;
  jerseyNumber: number | null;
  isCaptain: boolean;
  category: string;
  biography: string;
  photoAssetPath: string | null;
}

interface StageRow {
  id: string;
  name: string;
}

interface StandingEntryRow {
  countryCode: string;
  name: string;
}

interface StandingMatchRow {
  teamACode: string;
  teamBCode: string;
  teamAScore: number;
  teamBScore: number;
}

function shapeMatch(r: MatchRow) {
  const scoreIsPublic = [
    'live',
    'suspended',
    'awaiting_confirmation',
    'final',
  ].includes(r.status);
  return {
    id: r.id,
    scheduledAt: r.scheduledAt,
    venue: r.venue,
    court: r.court,
    round: r.roundLabel,
    status: r.status,
    stage: r.stageName,
    teamA: {
      code: r.teamACode,
      name: r.teamAName,
      score: scoreIsPublic ? r.teamAScore : null,
    },
    teamB: {
      code: r.teamBCode,
      name: r.teamBName,
      score: scoreIsPublic ? r.teamBScore : null,
    },
    broadcast: {
      provider: r.broadcastProvider,
      watchUrl: r.watchUrl,
      embedUrl: r.embedUrl,
      replayUrl: r.replayUrl,
      status: r.broadcastStatus ?? 'unassigned',
      featured: r.broadcastFeatured ?? false,
    },
  };
}

function positionCode(value: string | null) {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (POSITION_NAMES[normalized]) return normalized;
  return (
    Object.entries(POSITION_NAMES).find(
      ([, name]) => name.toUpperCase() === normalized,
    )?.[0] ?? null
  );
}

type LineupCandidate = {
  teamSide: 'A' | 'B';
  playerId: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  startingPosition: string | null;
  role: string | null;
  captain: boolean;
  photoAssetPath: string | null;
  source: 'team-sheet' | 'demo-squad';
};

function selectDemoStarters(candidates: LineupCandidate[], side: 'A' | 'B') {
  const available = candidates.filter((player) => player.teamSide === side);
  const used = new Set<string>();
  return Object.keys(POSITION_NAMES).flatMap((position) => {
    const player = available.find((candidate) => {
      if (used.has(candidate.playerId)) return false;
      const roles = (candidate.role ?? '')
        .split('/')
        .map((role) => role.trim().toUpperCase());
      return roles.includes(position);
    });
    if (!player) return [];
    used.add(player.playerId);
    return [{ ...player, startingPosition: position }];
  });
}

function liveClock(row: MatchRow, now = new Date()) {
  let seconds = row.clockRemainingSeconds;
  if (row.clockRunning && row.clockStartedAt) {
    seconds = Math.max(
      0,
      seconds -
        Math.floor((now.getTime() - row.clockStartedAt.getTime()) / 1000),
    );
  }
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function intervalClock(row: MatchRow, now = new Date()) {
  const duration =
    row.currentPeriod === 2
      ? 8 * 60
      : row.currentPeriod === 1 || row.currentPeriod === 3
        ? 4 * 60
        : null;
  if (
    duration === null ||
    row.status !== 'live' ||
    !row.clockRunning ||
    !row.clockStartedAt
  ) {
    return null;
  }
  const elapsed = Math.floor(
    (now.getTime() - row.clockStartedAt.getTime()) / 1000,
  );
  const intervalElapsed = elapsed - row.clockRemainingSeconds;
  if (intervalElapsed < 0) return null;
  const remaining = Math.max(0, duration - intervalElapsed);
  return `${Math.floor(remaining / 60)
    .toString()
    .padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`;
}

export function shapeBroadcastFeed(
  row: MatchRow,
  now = new Date(),
  flagOrigin = 'https://www.netballamericas.org',
) {
  return {
    MatchId: row.id,
    Status:
      row.status === 'final'
        ? 'FINAL'
        : ['live', 'suspended', 'awaiting_confirmation'].includes(row.status)
          ? 'LIVE'
          : row.status.toUpperCase(),
    Quarter: row.currentPeriod > 0 ? `Q${row.currentPeriod}` : 'PRE',
    Clock: row.status === 'final' ? 'FT' : liveClock(row, now),
    IntervalClock: intervalClock(row, now),
    ClockRunning: row.clockRunning,
    TeamAAbbr: row.teamACode,
    TeamAName: row.teamAName,
    TeamAScore: row.teamAScore,
    TeamAFlag: `${flagOrigin.replace(/\/$/, '')}/flags/${row.teamACode.toLowerCase()}.svg`,
    TeamBAbbr: row.teamBCode,
    TeamBName: row.teamBName,
    TeamBScore: row.teamBScore,
    TeamBFlag: `${flagOrigin.replace(/\/$/, '')}/flags/${row.teamBCode.toLowerCase()}.svg`,
    Venue: row.venue ?? '',
    Court: row.court ?? '',
    Provisional: row.status !== 'final',
    UpdatedAt: now.toISOString(),
  };
}

export function liveBroadcastFilter(matchId?: string) {
  return matchId
    ? 'WHERE m.id = $1'
    : `WHERE m.status IN ('ready', 'live', 'suspended', 'awaiting_confirmation', 'final')
       OR (COALESCE(mb.featured, false) = true AND m.status = 'scheduled')`;
}

export interface StandingRow {
  countryCode: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  rank: number;
  qualifies: boolean;
}

function computeStandings(
  entries: { countryCode: string; name: string }[],
  matches: {
    teamACode: string;
    teamBCode: string;
    teamAScore: number;
    teamBScore: number;
  }[],
): StandingRow[] {
  const table = new Map<string, StandingRow>();
  for (const e of entries) {
    table.set(e.countryCode, {
      countryCode: e.countryCode,
      name: e.name,
      played: 0,
      won: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
      rank: 0,
      qualifies: false,
    });
  }
  for (const m of matches) {
    const teamA = table.get(m.teamACode);
    const teamB = table.get(m.teamBCode);
    if (!teamA || !teamB) continue; // a nation outside this group's table.
    teamA.played++;
    teamB.played++;
    teamA.goalsFor += m.teamAScore;
    teamA.goalsAgainst += m.teamBScore;
    teamB.goalsFor += m.teamBScore;
    teamB.goalsAgainst += m.teamAScore;
    if (m.teamAScore > m.teamBScore) {
      teamA.won++;
      teamB.lost++;
    } else if (m.teamBScore > m.teamAScore) {
      teamB.won++;
      teamA.lost++;
    }
    // No draws in netball; equal scores leave W/L untouched (defensive).
  }
  const rows = [...table.values()];
  for (const r of rows) {
    r.goalDiff = r.goalsFor - r.goalsAgainst;
    r.points = r.won * WIN_POINTS;
  }
  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.name.localeCompare(b.name),
  );
  rows.forEach((r, i) => {
    r.rank = i + 1;
    r.qualifies = i < QUALIFY_TOP;
  });
  return rows;
}

@Injectable()
export class PublicService {
  private readonly s3: S3Client;
  private readonly advertisingBucket: string;

  constructor(
    @Inject(PUBLIC_POOL) private readonly pool: Pool,
    private readonly config: ConfigService,
  ) {
    this.s3 = new S3Client({
      endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
      region: config.getOrThrow<string>('S3_REGION'),
      forcePathStyle:
        config.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true',
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      },
    });
    this.advertisingBucket = config.getOrThrow<string>('S3_BUCKET_BADGES');
  }

  async tournament() {
    const { rows } = await this.pool.query<TournamentRow>(`
      SELECT t.name, t.slug, t.short_name AS "shortName", t.timezone,
        t.starts_on AS "startsOn", t.ends_on AS "endsOn",
        t.brand_primary_logo_url AS "brandPrimaryLogoUrl",
        t.brand_reverse_logo_url AS "brandReverseLogoUrl",
        t.public_site_live AS "publicSiteLive",
        (SELECT v.name FROM venue v WHERE v.tournament_id = t.id
         ORDER BY v.sort_order LIMIT 1) AS venue
      FROM tournament t ORDER BY t.created_at LIMIT 1`);
    return rows[0] ?? null;
  }

  async siteMode() {
    const { rows } = await this.pool.query<{ live: boolean }>(
      `SELECT public_site_live AS "live"
       FROM tournament ORDER BY created_at LIMIT 1`,
    );
    return rows[0] ?? { live: false };
  }

  async gymDisplayMode() {
    const { rows } = await this.pool.query<{
      mode: 'automatic' | 'arena' | 'live';
    }>(
      `SELECT gym_display_mode AS "mode"
       FROM tournament ORDER BY created_at LIMIT 1`,
    );
    return rows[0] ?? { mode: 'automatic' as const };
  }

  async nations() {
    const { rows } = await this.pool.query<NationRow>(`
      SELECT n.country_code AS "countryCode", n.name,
             string_agg(DISTINCT s.name, ', ' ORDER BY s.name) AS "group"
      FROM v_public_nation n
      LEFT JOIN group_entry ge ON ge.delegation_id = n.id
      LEFT JOIN stage s ON s.id = ge.stage_id
      GROUP BY n.country_code, n.name
      ORDER BY "group" NULLS LAST, n.name`);
    return rows;
  }

  async experience() {
    const event = await this.pool.query<{
      tournamentId: string;
      heroImageUrl: string | null;
      heroStrapline: string | null;
      ticketsUrl: string | null;
      merchandiseUrl: string | null;
      merchandiseImageUrl: string | null;
      aboutText: string | null;
      contactEmail: string | null;
      delayedUpdatesMessage: string | null;
    }>(`
      SELECT t.id AS "tournamentId", pe.hero_image_url AS "heroImageUrl",
        pe.hero_strapline AS "heroStrapline", pe.tickets_url AS "ticketsUrl",
        pe.merchandise_url AS "merchandiseUrl",
        pe.merchandise_image_url AS "merchandiseImageUrl",
        pe.about_text AS "aboutText", pe.contact_email AS "contactEmail",
        pe.delayed_updates_message AS "delayedUpdatesMessage"
      FROM tournament t LEFT JOIN public_experience pe ON pe.tournament_id = t.id
      ORDER BY t.created_at LIMIT 1`);
    if (!event.rows[0]) return null;
    const [sponsors, news] = await Promise.all([
      this.pool.query<{
        id: string;
        name: string;
        tier: string;
        logoUrl: string | null;
        destinationUrl: string | null;
        websiteEnabled: boolean;
        displayImageUrl: string | null;
        displayEnabled: boolean;
        displaySeconds: number;
      }>(
        `
        SELECT id, name, tier, logo_url AS "logoUrl",
          destination_url AS "destinationUrl",
          website_enabled AS "websiteEnabled",
          display_image_url AS "displayImageUrl",
          display_enabled AS "displayEnabled",
          display_seconds AS "displaySeconds"
        FROM sponsor WHERE tournament_id = $1 AND active = true
        ORDER BY sort_order, name`,
        [event.rows[0].tournamentId],
      ),
      this.pool.query<{
        id: string;
        slug: string;
        title: string;
        summary: string;
        body: string | null;
        imageUrl: string | null;
        publishedAt: Date | null;
      }>(
        `
        SELECT id, slug, title, summary, body, image_url AS "imageUrl",
          published_at AS "publishedAt"
        FROM news_article
        WHERE tournament_id = $1 AND published = true
        ORDER BY published_at DESC NULLS LAST, created_at DESC`,
        [event.rows[0].tournamentId],
      ),
    ]);
    const { tournamentId: _tournamentId, ...experience } = event.rows[0];
    void _tournamentId;
    return { ...experience, sponsors: sponsors.rows, news: news.rows };
  }

  async advertisingCreative(id: string, surface: string) {
    if (surface !== 'website' && surface !== 'display') {
      throw new NotFoundException('Advertising creative not found');
    }
    const enabledColumn =
      surface === 'website' ? 'website_enabled' : 'display_enabled';
    const ad = await this.pool.query<{ id: string }>(
      `SELECT id FROM sponsor
       WHERE id = $1 AND active = true AND ${enabledColumn} = true LIMIT 1`,
      [id],
    );
    if (!ad.rows[0])
      throw new NotFoundException('Advertising creative not found');
    try {
      const object = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.advertisingBucket,
          Key: `advertising/${id}/${surface}.webp`,
        }),
      );
      return {
        contentType: object.ContentType ?? 'image/webp',
        buffer: Buffer.from(await object.Body!.transformToByteArray()),
      };
    } catch {
      throw new NotFoundException('Advertising creative not found');
    }
  }

  async newsImage(id: string) {
    const article = await this.pool.query<{ id: string }>(
      `SELECT id FROM news_article WHERE id = $1 AND published = true LIMIT 1`,
      [id],
    );
    if (!article.rows[0]) throw new NotFoundException('News image not found');
    try {
      const object = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.advertisingBucket,
          Key: `news/${id}/image.webp`,
        }),
      );
      return {
        contentType: object.ContentType ?? 'image/webp',
        buffer: Buffer.from(await object.Body!.transformToByteArray()),
      };
    } catch {
      throw new NotFoundException('News image not found');
    }
  }

  async newsArticle(slug: string) {
    const article = await this.pool.query<{
      id: string;
      slug: string;
      title: string;
      summary: string;
      body: string | null;
      imageUrl: string | null;
      publishedAt: Date | null;
    }>(
      `SELECT id, slug, title, summary, body, image_url AS "imageUrl",
              published_at AS "publishedAt"
       FROM news_article
       WHERE slug = $1 AND published = true
       LIMIT 1`,
      [slug.trim().toLowerCase()],
    );
    return article.rows[0] ?? null;
  }

  async squad(code: string) {
    const nat = await this.pool.query<Omit<NationRow, 'group'>>(
      `SELECT country_code AS "countryCode", name FROM v_public_nation
       WHERE country_code = $1 LIMIT 1`,
      [code],
    );
    if (!nat.rows[0]) return null;
    const members = await this.pool.query<SquadMemberRow>(
      `SELECT m.first_name AS "firstName", m.last_name AS "lastName", m.role,
              m.jersey_number AS "jerseyNumber", m.is_captain AS "isCaptain",
              m.category, m.biography,
              m.photo_asset_path AS "photoAssetPath"
       FROM v_public_squad_member m
       JOIN v_public_nation n ON n.id = m.delegation_id
       WHERE n.country_code = $1
       ORDER BY m.category, m.jersey_number NULLS LAST, m.last_name`,
      [code],
    );
    return { nation: nat.rows[0], members: members.rows };
  }

  async fixtures() {
    const { rows } = await this.pool.query<MatchRow>(
      `${MATCH_SELECT} WHERE m.status <> 'final'
       ORDER BY m.scheduled_at ASC NULLS LAST, m.sort_order`,
    );
    return rows.map(shapeMatch);
  }

  async matchLineup(matchId: string) {
    const matchResult = await this.pool.query<MatchRow>(
      `${MATCH_SELECT} WHERE m.id = $1 LIMIT 1`,
      [matchId],
    );
    const matchRow = matchResult.rows[0];
    if (!matchRow) return null;

    const submitted = await this.pool.query<LineupCandidate>(
      `SELECT selected.team_side AS "teamSide",
              selected.player_id AS "playerId",
              selected.first_name AS "firstName",
              selected.last_name AS "lastName",
              selected.jersey_number AS "jerseyNumber",
              selected.starting_position AS "startingPosition",
              published.role, selected.captain,
              published.photo_asset_path AS "photoAssetPath",
              'team-sheet'::text AS source
       FROM v_public_match_team_sheet_player selected
       JOIN v_public_squad_member published ON published.id = selected.player_id
       WHERE selected.match_id = $1
         AND selected.starting_position IS NOT NULL`,
      [matchId],
    );

    const submittedSides = new Set(submitted.rows.map((row) => row.teamSide));
    const fallback = await this.pool.query<LineupCandidate>(
      `SELECT CASE WHEN p.delegation_id = m.team_a_delegation_id THEN 'A' ELSE 'B' END AS "teamSide",
              p.id AS "playerId", p.first_name AS "firstName",
              p.last_name AS "lastName", p.jersey_number AS "jerseyNumber",
              NULL::text AS "startingPosition", p.role, p.is_captain AS captain,
              p.photo_asset_path AS "photoAssetPath",
              'demo-squad'::text AS source
       FROM match m
       JOIN v_public_squad_member p
         ON p.delegation_id IN (m.team_a_delegation_id, m.team_b_delegation_id)
       WHERE m.id = $1
         AND p.category = 'player'
         AND p.photo_asset_path LIKE 'athletes/%'
       ORDER BY p.jersey_number NULLS LAST, p.last_name`,
      [matchId],
    );

    const rows = [...submitted.rows];
    for (const side of ['A', 'B'] as const) {
      if (!submittedSides.has(side))
        rows.push(...selectDemoStarters(fallback.rows, side));
    }
    const shapePlayer = (player: LineupCandidate) => {
      const position = positionCode(player.startingPosition);
      return {
        id: player.playerId,
        firstName: player.firstName,
        lastName: player.lastName,
        jerseyNumber: player.jerseyNumber,
        position,
        positionName: position ? POSITION_NAMES[position] : null,
        captain: player.captain,
        photoAssetPath: player.photoAssetPath,
        source: player.source,
      };
    };
    const playersFor = (side: 'A' | 'B') =>
      rows
        .filter(
          (player) =>
            player.teamSide === side && positionCode(player.startingPosition),
        )
        .map(shapePlayer)
        .sort(
          (a, b) =>
            Object.keys(POSITION_NAMES).indexOf(a.position ?? '') -
            Object.keys(POSITION_NAMES).indexOf(b.position ?? ''),
        );
    const teamAPlayers = playersFor('A');
    const teamBPlayers = playersFor('B');
    return {
      match: shapeMatch(matchRow),
      teamA: { ...shapeMatch(matchRow).teamA, players: teamAPlayers },
      teamB: { ...shapeMatch(matchRow).teamB, players: teamBPlayers },
      complete: teamAPlayers.length === 7 && teamBPlayers.length === 7,
      source:
        submittedSides.size === 2
          ? 'submitted-team-sheets'
          : submittedSides.size > 0
            ? 'mixed'
            : 'demo-squads',
    };
  }

  async results() {
    const { rows } = await this.pool.query<MatchRow>(
      `${MATCH_SELECT} WHERE m.status = 'final'
       ORDER BY m.scheduled_at DESC NULLS LAST, m.sort_order`,
    );
    return rows.map(shapeMatch);
  }

  async lastNext() {
    const last = await this.pool.query<MatchRow>(
      `${MATCH_SELECT} WHERE m.status = 'final'
       ORDER BY m.scheduled_at DESC NULLS LAST LIMIT 1`,
    );
    let next = await this.pool.query<MatchRow>(
      `${MATCH_SELECT} WHERE m.status = 'scheduled' AND m.scheduled_at >= now()
       ORDER BY m.scheduled_at ASC LIMIT 1`,
    );
    if (!next.rows[0]) {
      // No future fixture (e.g. demo dataset is in the past) — fall back to the
      // earliest scheduled match so the "Next Game" card still has something.
      next = await this.pool.query<MatchRow>(
        `${MATCH_SELECT} WHERE m.status = 'scheduled'
         ORDER BY m.scheduled_at ASC NULLS LAST LIMIT 1`,
      );
    }
    return {
      last: last.rows[0] ? shapeMatch(last.rows[0]) : null,
      next: next.rows[0] ? shapeMatch(next.rows[0]) : null,
    };
  }

  async liveBroadcast(matchId?: string) {
    const where = liveBroadcastFilter(matchId);
    const { rows } = await this.pool.query<MatchRow>(
      `${MATCH_SELECT} ${where}
       ORDER BY CASE WHEN m.status IN ('live', 'suspended', 'awaiting_confirmation') THEN 0 ELSE 1 END,
         m.updated_at DESC,
         COALESCE(mb.featured, false) DESC,
         m.scheduled_at DESC NULLS LAST LIMIT 1`,
      matchId ? [matchId] : [],
    );
    return rows[0]
      ? shapeBroadcastFeed(
          rows[0],
          new Date(),
          this.config.get<string>(
            'PUBLIC_SITE_ORIGIN',
            'https://www.netballamericas.org',
          ),
        )
      : null;
  }

  async liveStatsBroadcast(matchId?: string) {
    const base = await this.liveBroadcast(matchId);
    if (!base) return null;
    const analytics = await this.matchAnalytics(String(base.MatchId));
    if (!analytics) return null;
    const topScorer = [...analytics.players].sort(
      (a, b) => b.goals - a.goals || b.goalAttempts - a.goalAttempts,
    )[0];
    const topGain = [...analytics.players].sort(
      (a, b) => b.gains - a.gains || b.intercepts - a.intercepts,
    )[0];
    return {
      ...base,
      CaptureStatus:
        analytics.teams.A.goalAttempts + analytics.teams.B.goalAttempts > 0
          ? 'ACTIVE'
          : 'NOT STAFFED',
      TeamAGoalAttempts: analytics.teams.A.goalAttempts,
      TeamAShootingPercentage: analytics.teams.A.shootingPercentage ?? '',
      TeamAGains: analytics.teams.A.gains,
      TeamAInterceptions: analytics.teams.A.intercepts,
      TeamATurnovers: analytics.teams.A.turnovers,
      TeamARebounds: analytics.teams.A.rebounds,
      TeamAPenalties: analytics.teams.A.penalties,
      TeamACentrePasses: analytics.teams.A.centrePasses,
      TeamAPasses: analytics.teams.A.passes,
      TeamBGoalAttempts: analytics.teams.B.goalAttempts,
      TeamBShootingPercentage: analytics.teams.B.shootingPercentage ?? '',
      TeamBGains: analytics.teams.B.gains,
      TeamBInterceptions: analytics.teams.B.intercepts,
      TeamBTurnovers: analytics.teams.B.turnovers,
      TeamBRebounds: analytics.teams.B.rebounds,
      TeamBPenalties: analytics.teams.B.penalties,
      TeamBCentrePasses: analytics.teams.B.centrePasses,
      TeamBPasses: analytics.teams.B.passes,
      TopScorerName: topScorer
        ? `${topScorer.firstName} ${topScorer.lastName}`.trim()
        : '',
      TopScorerGoals: topScorer?.goals ?? 0,
      TopGainName: topGain
        ? `${topGain.firstName} ${topGain.lastName}`.trim()
        : '',
      TopGainCount: topGain?.gains ?? 0,
      StatsProvisional: analytics.provenance.status !== 'official',
    };
  }
  async broadcasts() {
    const { rows } = await this.pool.query<MatchRow>(
      `${MATCH_SELECT}
       WHERE mb.status IS NOT NULL AND mb.status <> 'unassigned'
       ORDER BY COALESCE(mb.featured, false) DESC,
         m.scheduled_at ASC NULLS LAST`,
    );
    return rows.map(shapeMatch);
  }

  async matchAnalytics(matchId: string) {
    const matches = await this.pool.query<MatchRow>(
      `${MATCH_SELECT} WHERE m.id = $1 LIMIT 1`,
      [matchId],
    );
    if (!matches.rows[0]) return null;
    const { rows } = await this.pool.query<PublicMatchEvent>(
      `SELECT id, event_type AS "eventType", team_side AS "teamSide",
              player_id AS "playerId", first_name AS "firstName",
              last_name AS "lastName", jersey_number AS "jerseyNumber",
              reverses_event_id AS "reversesEventId"
       FROM v_public_match_event WHERE match_id = $1 ORDER BY sequence`,
      [matchId],
    );
    return {
      match: shapeMatch(matches.rows[0]),
      ...aggregateMatchAnalytics(rows),
      provenance: {
        source: 'GameDay confirmed event ledger',
        status: matches.rows[0].status === 'final' ? 'official' : 'provisional',
      },
    };
  }

  async matchAnalyticsCsv(matchId: string) {
    const analytics = await this.matchAnalytics(matchId);
    if (!analytics) return null;
    type CsvValue = string | number | null | undefined;
    const csv = (value: CsvValue) =>
      `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows: CsvValue[][] = [
      [
        'recordType',
        'teamSide',
        'player',
        'jerseyNumber',
        'goals',
        'goalAttempts',
        'shootingPercentage',
        'gains',
        'intercepts',
        'turnovers',
        'deflections',
        'rebounds',
        'penalties',
        'status',
        'source',
      ],
      ...(['A', 'B'] as const).map((side) => {
        const totals = analytics.teams[side];
        return [
          'team',
          side,
          side === 'A'
            ? analytics.match.teamA.name
            : analytics.match.teamB.name,
          '',
          totals.goals,
          totals.goalAttempts,
          totals.shootingPercentage,
          totals.gains,
          totals.intercepts,
          totals.turnovers,
          totals.deflections,
          totals.rebounds,
          totals.penalties,
          analytics.provenance.status,
          analytics.provenance.source,
        ];
      }),
      ...analytics.players.map((player) => [
        'player',
        player.teamSide,
        `${player.firstName} ${player.lastName}`.trim(),
        player.jerseyNumber,
        player.goals,
        player.goalAttempts,
        player.shootingPercentage,
        player.gains,
        player.intercepts,
        player.turnovers,
        player.deflections,
        player.rebounds,
        player.penalties,
        analytics.provenance.status,
        analytics.provenance.source,
      ]),
    ];
    return `\uFEFF${rows.map((row) => row.map(csv).join(',')).join('\r\n')}\r\n`;
  }

  async matchReportCsv(matchId: string) {
    const analytics = await this.matchAnalytics(matchId);
    if (!analytics) return null;
    const [eventResult, sheetResult, roleResult] = await Promise.all([
      this.pool.query<PublicMatchEvent>(
        `SELECT id, match_id AS "matchId", event_type AS "eventType",
                team_side AS "teamSide", player_id AS "playerId",
                first_name AS "firstName", last_name AS "lastName",
                jersey_number AS "jerseyNumber", period,
                clock_seconds AS "clockSeconds",
                reverses_event_id AS "reversesEventId"
         FROM v_public_match_event WHERE match_id = $1 ORDER BY sequence`,
        [matchId],
      ),
      this.pool.query<{
        teamSide: string;
        teamSheetStatus: string;
        firstName: string;
        lastName: string;
        jerseyNumber: number | null;
        startingPosition: string | null;
        captain: boolean;
      }>(
        `SELECT team_side AS "teamSide",
                team_sheet_status AS "teamSheetStatus",
                first_name AS "firstName", last_name AS "lastName",
                jersey_number AS "jerseyNumber",
                starting_position AS "startingPosition", captain
         FROM v_public_match_team_sheet_player
         WHERE match_id = $1
         ORDER BY team_side, jersey_number NULLS LAST, last_name, first_name`,
        [matchId],
      ),
      this.pool.query<{ role: string }>(
        `SELECT role FROM v_public_match_official_role
         WHERE match_id = $1 ORDER BY role`,
        [matchId],
      ),
    ]);
    type CsvValue = string | number | boolean | null | undefined;
    const csv = (value: CsvValue) =>
      `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows: CsvValue[][] = [
      [
        'section',
        'period',
        'teamSide',
        'nameOrRole',
        'jerseyNumber',
        'position',
        'captain',
        'eventType',
        'clockSeconds',
        'teamAScore',
        'teamBScore',
        'status',
        'source',
      ],
      [
        'match',
        '',
        '',
        `${analytics.match.teamA.name} v ${analytics.match.teamB.name}`,
        '',
        '',
        '',
        '',
        '',
        analytics.match.teamA.score,
        analytics.match.teamB.score,
        analytics.provenance.status,
        analytics.provenance.source,
      ],
      ...aggregatePeriodScores(eventResult.rows).map((period) => [
        'period',
        period.period,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        period.teamA,
        period.teamB,
        analytics.provenance.status,
        analytics.provenance.source,
      ]),
      ...sheetResult.rows.map((player) => [
        'teamSheet',
        '',
        player.teamSide,
        `${player.firstName} ${player.lastName}`.trim(),
        player.jerseyNumber,
        player.startingPosition,
        player.captain,
        '',
        '',
        '',
        '',
        player.teamSheetStatus,
        'Submitted public match selection',
      ]),
      ...roleResult.rows.map((assignment) => [
        'officialRole',
        '',
        '',
        assignment.role,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'assigned',
        'GameDay role assignment; operator identity withheld',
      ]),
      ...eventResult.rows
        .filter((event) => event.eventType.startsWith('incident.'))
        .map((incident) => [
          'incident',
          incident.period,
          incident.teamSide,
          '',
          '',
          '',
          '',
          incident.eventType,
          incident.clockSeconds,
          '',
          '',
          analytics.provenance.status,
          'GameDay ledger; private incident notes withheld',
        ]),
    ];
    return `\uFEFF${rows.map((row) => row.map(csv).join(',')).join('\r\n')}\r\n`;
  }

  async historicalRecords() {
    const configuredMinimum = Number(
      this.config.get<string>('ANALYTICS_MIN_COMPLETED_MATCHES') ?? '1',
    );
    const minimumCompletedMatches =
      Number.isInteger(configuredMinimum) && configuredMinimum > 0
        ? configuredMinimum
        : 1;
    const { rows } = await this.pool.query<MatchRow>(
      `${MATCH_SELECT} WHERE m.status = 'final'
       ORDER BY m.scheduled_at ASC NULLS LAST, m.sort_order`,
    );
    const results = rows.map((row) => ({ row, match: shapeMatch(row) }));
    const highestTeamScore =
      results
        .flatMap(({ row, match }) => [
          { match, team: match.teamA, score: row.teamAScore },
          { match, team: match.teamB, score: row.teamBScore },
        ])
        .sort((a, b) => b.score - a.score)[0] ?? null;
    const largestWinningMargin =
      results
        .map(({ row, match }) => ({
          match,
          margin: Math.abs(row.teamAScore - row.teamBScore),
          winner: row.teamAScore >= row.teamBScore ? match.teamA : match.teamB,
        }))
        .sort((a, b) => b.margin - a.margin)[0] ?? null;
    const eventRows = await this.pool.query<PublicMatchEvent>(
      `SELECT e.id, e.match_id AS "matchId",
              e.event_type AS "eventType", e.team_side AS "teamSide",
              e.player_id AS "playerId", e.first_name AS "firstName",
              e.last_name AS "lastName", e.jersey_number AS "jerseyNumber",
              e.reverses_event_id AS "reversesEventId"
       FROM v_public_match_event e JOIN match m ON m.id = e.match_id
       WHERE m.status = 'final' ORDER BY e.recorded_at`,
    );
    const topScorer = selectEligibleTopScorer(
      eventRows.rows,
      minimumCompletedMatches,
    );
    const finalMatchIds = rows.map((row) => row.id);
    const provenanceRows = finalMatchIds.length
      ? await this.pool.query<PublicMatchProvenance>(
          `SELECT match_id AS "matchId", dataset_name AS "datasetName",
                  publisher, source_url AS "sourceUrl",
                  source_citation AS "sourceCitation",
                  retrieved_at AS "retrievedAt", confidence,
                  record_status AS "recordStatus",
                  imported_at AS "importedAt", corrected_at AS "correctedAt"
           FROM v_public_match_provenance
           WHERE match_id = ANY($1::uuid[])
           ORDER BY match_id, dataset_name`,
          [finalMatchIds],
        )
      : { rows: [] as PublicMatchProvenance[] };
    return {
      highestTeamScore,
      largestWinningMargin,
      topScorer,
      completedMatches: rows.length,
      participationRule: {
        minimumCompletedMatches,
        basis:
          'Matches with a recorded player event in an approved final result',
        status:
          'MVP rule; competition owner approval required before official publication',
      },
      sourceCoverage: summarizeProvenanceCoverage(
        finalMatchIds,
        provenanceRows.rows,
      ),
      sources: provenanceRows.rows,
      identityPolicy: {
        status: 'restricted',
        publicFields:
          'Resolved published display identity and approved source provenance only',
        prohibitedMatchBasis: 'Name-only automatic player matching',
      },
      provenance: {
        source: 'Official final results and GameDay confirmed event ledger',
        status: 'official',
      },
    };
  }

  async standings(stageId?: string) {
    const stages = await this.pool.query<StageRow>(
      `SELECT id, name FROM stage
       WHERE lower(name) <> lower('Presentation Rehearsal')
         ${stageId ? 'AND id = $1' : ''}
       ORDER BY sort_order, name`,
      stageId ? [stageId] : [],
    );
    const out: Array<{
      stage: { id: string; name: string };
      rows: StandingRow[];
      qualifyTop: number;
    }> = [];
    for (const st of stages.rows) {
      const entries = await this.pool.query<StandingEntryRow>(
        `SELECT n.country_code AS "countryCode", n.name
         FROM group_entry ge JOIN v_public_nation n ON n.id = ge.delegation_id
         WHERE ge.stage_id = $1 ORDER BY ge.sort_order`,
        [st.id],
      );
      const matches = await this.pool.query<StandingMatchRow>(
        `SELECT ta.country_code AS "teamACode", tb.country_code AS "teamBCode",
                m.team_a_score AS "teamAScore", m.team_b_score AS "teamBScore"
         FROM match m
         JOIN v_public_nation ta ON ta.id = m.team_a_delegation_id
         JOIN v_public_nation tb ON tb.id = m.team_b_delegation_id
         WHERE m.stage_id = $1 AND m.status = 'final'
           AND m.team_a_score IS NOT NULL AND m.team_b_score IS NOT NULL`,
        [st.id],
      );
      out.push({
        stage: { id: st.id, name: st.name },
        rows: computeStandings(entries.rows, matches.rows),
        qualifyTop: QUALIFY_TOP,
      });
    }
    return out;
  }
}
