import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import { PUBLIC_POOL } from '../db/db.tokens';

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
  constructor(
    @Inject(PUBLIC_POOL) private readonly pool: Pool,
    private readonly config: ConfigService,
  ) {}

  async tournament() {
    const { rows } = await this.pool.query<TournamentRow>(`
      SELECT t.name, t.slug, t.short_name AS "shortName", t.timezone,
        t.starts_on AS "startsOn", t.ends_on AS "endsOn",
        t.brand_primary_logo_url AS "brandPrimaryLogoUrl",
        t.brand_reverse_logo_url AS "brandReverseLogoUrl",
        (SELECT v.name FROM venue v WHERE v.tournament_id = t.id
         ORDER BY v.sort_order LIMIT 1) AS venue
      FROM tournament t ORDER BY t.created_at LIMIT 1`);
    return rows[0] ?? null;
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
      }>(
        `
        SELECT id, name, tier, logo_url AS "logoUrl",
          destination_url AS "destinationUrl"
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
              m.category
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
    const where = matchId
      ? 'WHERE m.id = $1'
      : `WHERE m.status IN ('ready', 'live', 'suspended', 'awaiting_confirmation', 'final')`;
    const { rows } = await this.pool.query<MatchRow>(
      `${MATCH_SELECT} ${where}
       ORDER BY COALESCE(mb.featured, false) DESC,
         CASE WHEN m.status IN ('live', 'suspended', 'awaiting_confirmation') THEN 0 ELSE 1 END,
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

  async broadcasts() {
    const { rows } = await this.pool.query<MatchRow>(
      `${MATCH_SELECT}
       WHERE mb.status IS NOT NULL AND mb.status <> 'unassigned'
       ORDER BY COALESCE(mb.featured, false) DESC,
         m.scheduled_at ASC NULLS LAST`,
    );
    return rows.map(shapeMatch);
  }

  async standings(stageId?: string) {
    const stages = await this.pool.query<StageRow>(
      `SELECT id, name FROM stage ${stageId ? 'WHERE id = $1' : ''}
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
