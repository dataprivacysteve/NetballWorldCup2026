import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
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
  SELECT m.id, m.scheduled_at AS "scheduledAt", m.venue, m.court,
         m.round_label AS "roundLabel", m.status,
         m.home_score AS "homeScore", m.away_score AS "awayScore",
         s.name AS "stageName",
         h.country_code AS "homeCode", h.name AS "homeName",
         a.country_code AS "awayCode", a.name AS "awayName"
  FROM match m
  LEFT JOIN stage s ON s.id = m.stage_id
  JOIN v_public_nation h ON h.id = m.home_delegation_id
  JOIN v_public_nation a ON a.id = m.away_delegation_id
`;

interface MatchRow {
  id: string;
  scheduledAt: Date | null;
  venue: string | null;
  court: string | null;
  roundLabel: string | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  stageName: string | null;
  homeCode: string;
  homeName: string;
  awayCode: string;
  awayName: string;
}

function shapeMatch(r: MatchRow) {
  return {
    id: r.id,
    scheduledAt: r.scheduledAt,
    venue: r.venue,
    court: r.court,
    round: r.roundLabel,
    status: r.status,
    stage: r.stageName,
    home: { code: r.homeCode, name: r.homeName, score: r.homeScore },
    away: { code: r.awayCode, name: r.awayName, score: r.awayScore },
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
    homeCode: string;
    awayCode: string;
    homeScore: number;
    awayScore: number;
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
    const home = table.get(m.homeCode);
    const away = table.get(m.awayCode);
    if (!home || !away) continue; // a nation outside this group's table.
    home.played++;
    away.played++;
    home.goalsFor += m.homeScore;
    home.goalsAgainst += m.awayScore;
    away.goalsFor += m.awayScore;
    away.goalsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) {
      home.won++;
      away.lost++;
    } else if (m.awayScore > m.homeScore) {
      away.won++;
      home.lost++;
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
  constructor(@Inject(PUBLIC_POOL) private readonly pool: Pool) {}

  async tournament() {
    const { rows } = await this.pool.query(`
      SELECT t.name, t.slug, t.starts_on AS "startsOn", t.ends_on AS "endsOn",
        (SELECT venue FROM match WHERE venue IS NOT NULL
         ORDER BY sort_order LIMIT 1) AS venue
      FROM tournament t ORDER BY t.created_at LIMIT 1`);
    return rows[0] ?? null;
  }

  async nations() {
    const { rows } = await this.pool.query(`
      SELECT n.country_code AS "countryCode", n.name, s.name AS "group"
      FROM v_public_nation n
      LEFT JOIN group_entry ge ON ge.delegation_id = n.id
      LEFT JOIN stage s ON s.id = ge.stage_id
      ORDER BY s.name NULLS LAST, n.name`);
    return rows;
  }

  async squad(code: string) {
    const nat = await this.pool.query(
      `SELECT country_code AS "countryCode", name FROM v_public_nation
       WHERE country_code = $1 LIMIT 1`,
      [code],
    );
    if (!nat.rows[0]) return null;
    const members = await this.pool.query(
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

  async standings(stageId?: string) {
    const stages = await this.pool.query(
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
      const entries = await this.pool.query(
        `SELECT n.country_code AS "countryCode", n.name
         FROM group_entry ge JOIN v_public_nation n ON n.id = ge.delegation_id
         WHERE ge.stage_id = $1 ORDER BY ge.sort_order`,
        [st.id],
      );
      const matches = await this.pool.query(
        `SELECT h.country_code AS "homeCode", a.country_code AS "awayCode",
                m.home_score AS "homeScore", m.away_score AS "awayScore"
         FROM match m
         JOIN v_public_nation h ON h.id = m.home_delegation_id
         JOIN v_public_nation a ON a.id = m.away_delegation_id
         WHERE m.stage_id = $1 AND m.status = 'final'
           AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL`,
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
