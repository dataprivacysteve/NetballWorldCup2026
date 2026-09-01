import '../db/env';
import { Pool } from 'pg';

const origins = {
  api: process.env.REHEARSAL_API_ORIGIN ?? 'http://localhost:3000',
  public: process.env.REHEARSAL_PUBLIC_ORIGIN ?? 'http://localhost:3001',
  teams: process.env.REHEARSAL_TEAMS_ORIGIN ?? 'http://localhost:3002',
  platform: process.env.REHEARSAL_PLATFORM_ORIGIN ?? 'http://localhost:3003',
};

if (!process.env.MIGRATION_DATABASE_URL) {
  throw new Error('MIGRATION_DATABASE_URL is required');
}

type BroadcastFeed = {
  MatchId: string;
  Status: string;
  TeamAAbbr: string;
  TeamBAbbr: string;
  TeamAScore: number;
  TeamBScore: number;
};

async function json<T>(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function checkUrl(name: string, url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${name} returned HTTP ${response.status}`);
  return { name, url, status: response.status };
}

function xmlValue(xml: string, field: string) {
  return xml.match(new RegExp(`<${field}>([^<]*)</${field}>`))?.[1] ?? null;
}

async function main() {
  const surfaces = await Promise.all([
    checkUrl('API', `${origins.api}/`),
    checkUrl('Public website', `${origins.public}/`),
    checkUrl('Teams', `${origins.teams}/`),
    checkUrl('Platform', `${origins.platform}/`),
    checkUrl('GameDay', `${origins.platform}/gameday`),
    checkUrl('Audience display', `${origins.platform}/display`),
    checkUrl('Analytics dashboard', `${origins.platform}/analytics`),
  ]);

  const [nations, fixtures, teamA, teamB, standings] = await Promise.all([
    json<Array<{ countryCode: string }>>(`${origins.api}/public/nations`),
    json<Array<{ id: string; status: string }>>(
      `${origins.api}/public/fixtures`,
    ),
    json<{ members: unknown[] }>(`${origins.api}/public/nations/XTA/squad`),
    json<{ members: unknown[] }>(`${origins.api}/public/nations/XTB/squad`),
    json<unknown[]>(`${origins.api}/public/standings`),
  ]);
  if (
    !nations.some((nation) => nation.countryCode === 'XTA') ||
    !nations.some((nation) => nation.countryCode === 'XTB') ||
    teamA.members.length !== 13 ||
    teamB.members.length !== 13 ||
    standings.length === 0
  ) {
    throw new Error('The public team/squad/standings projection is incomplete');
  }

  const [jsonResponse, xmlResponse] = await Promise.all([
    fetch(`${origins.api}/live.json`, { cache: 'no-store' }),
    fetch(`${origins.api}/live.xml`, { cache: 'no-store' }),
  ]);
  if (!jsonResponse.ok || !xmlResponse.ok) {
    throw new Error(
      `Broadcast feeds failed: JSON ${jsonResponse.status}, XML ${xmlResponse.status}`,
    );
  }
  const feed = (await jsonResponse.json()) as BroadcastFeed;
  const xml = await xmlResponse.text();
  const xmlMatchId = xmlValue(xml, 'MatchId');
  if (
    !feed.MatchId ||
    xmlMatchId !== feed.MatchId ||
    xmlValue(xml, 'TeamAAbbr') !== feed.TeamAAbbr ||
    xmlValue(xml, 'TeamBAbbr') !== feed.TeamBAbbr ||
    Number(xmlValue(xml, 'TeamAScore')) !== feed.TeamAScore ||
    Number(xmlValue(xml, 'TeamBScore')) !== feed.TeamBScore
  ) {
    throw new Error('JSON and XML broadcast feeds do not reconcile');
  }
  const recordsResponse = await fetch(
    `${origins.api}/public/analytics/records`,
    { cache: 'no-store' },
  );
  const records = (await recordsResponse.json()) as {
    sourceCoverage?: { complete: boolean };
    identityPolicy?: { prohibitedMatchBasis: string };
  };
  if (
    !recordsResponse.ok ||
    !records.sourceCoverage ||
    !records.identityPolicy?.prohibitedMatchBasis
  ) {
    throw new Error(
      `Historical governance feed failed with HTTP ${recordsResponse.status}`,
    );
  }

  const csv = await fetch(
    `${origins.api}/public/analytics/matches/${feed.MatchId}/export.csv`,
    { cache: 'no-store' },
  );
  const csvBody = await csv.text();
  if (!csv.ok || !csvBody.includes('recordType')) {
    throw new Error(`Analytics CSV failed with HTTP ${csv.status}`);
  }
  const report = await fetch(
    `${origins.api}/public/analytics/matches/${feed.MatchId}/report.csv`,
    { cache: 'no-store' },
  );
  const reportBody = await report.text();
  if (
    !report.ok ||
    !reportBody.includes('teamSheet') ||
    !reportBody.includes('officialRole')
  ) {
    throw new Error(`Match report CSV failed with HTTP ${report.status}`);
  }

  const pool = new Pool({
    connectionString: process.env.MIGRATION_DATABASE_URL,
  });
  try {
    const result = await pool.query<{
      synthetic_teams: number;
      players: number;
      officials: number;
      current_reviews: number;
      issued_credentials: number;
      retained_identity_bytes: number;
      rehearsal_accounts: number;
      loc_accounts: number;
      match_id: string;
      match_status: string;
      submitted_sheets: number;
      assignments: number;
    }>(`
      SELECT
        (SELECT count(*)::int FROM delegation WHERE country_code IN ('XTA','XTB')) AS synthetic_teams,
        (SELECT count(*)::int FROM player p JOIN delegation d ON d.id=p.delegation_id
          WHERE d.country_code IN ('XTA','XTB') AND p.category='player') AS players,
        (SELECT count(*)::int FROM player p JOIN delegation d ON d.id=p.delegation_id
          WHERE d.country_code IN ('XTA','XTB') AND p.category='official') AS officials,
        (SELECT count(*)::int FROM person_accreditation_review r JOIN delegation d ON d.id=r.delegation_id
          WHERE d.country_code IN ('XTA','XTB') AND r.status='verified') AS current_reviews,
        (SELECT count(*)::int FROM credential c JOIN delegation d ON d.id=c.delegation_id
          WHERE d.country_code IN ('XTA','XTB') AND c.status='issued') AS issued_credentials,
        (SELECT count(*)::int FROM identity_document i JOIN delegation d ON d.id=i.delegation_id
          WHERE d.country_code IN ('XTA','XTB') AND i.object_key IS NOT NULL
            AND i.document_deleted_at IS NULL) AS retained_identity_bytes,
        (SELECT count(*)::int FROM app_user WHERE email LIKE 'rehearsal.%@netballamericas.test') AS rehearsal_accounts,
        (SELECT count(*)::int FROM app_user WHERE platform_role='loc_officer') AS loc_accounts,
        m.id AS match_id, m.status AS match_status,
        (SELECT count(*)::int FROM match_team_sheet s WHERE s.match_id=m.id AND s.status='submitted') AS submitted_sheets,
        (SELECT count(*)::int FROM match_official_assignment a WHERE a.match_id=m.id) AS assignments
      FROM match m WHERE m.round_label='LOC Presentation Rehearsal' LIMIT 1`);
    const data = result.rows[0];
    if (!data) throw new Error('The presentation fixture is missing');
    const expected: Partial<typeof data> = {
      synthetic_teams: 2,
      players: 20,
      officials: 6,
      current_reviews: 26,
      issued_credentials: 26,
      retained_identity_bytes: 0,
      rehearsal_accounts: 7,
      loc_accounts: 1,
      match_status: 'scheduled',
      submitted_sheets: 2,
      assignments: 5,
    };
    for (const [key, expectedValue] of Object.entries(expected)) {
      if (data[key as keyof typeof data] !== expectedValue) {
        throw new Error(
          `${key} expected ${expectedValue}, received ${data[key as keyof typeof data]}`,
        );
      }
    }
    if (data.match_id !== feed.MatchId) {
      throw new Error(
        'The featured broadcast feed is not the presentation fixture',
      );
    }
    if (!fixtures.some((fixture) => fixture.id === data.match_id)) {
      throw new Error(
        'The presentation fixture is absent from the public site',
      );
    }

    console.log(
      JSON.stringify(
        {
          outcome: 'PASS',
          checkedAt: new Date().toISOString(),
          surfaces,
          broadcast: feed,
          publicProjection: {
            nations: nations.length,
            fixtures: fixtures.length,
            presentationFixturePublished: true,
            teamASquadMembers: teamA.members.length,
            teamBSquadMembers: teamB.members.length,
            standingStages: standings.length,
          },
          analyticsCsv: { status: csv.status, bytes: csvBody.length },
          matchReportCsv: {
            status: report.status,
            bytes: reportBody.length,
          },
          historicalGovernance: {
            status: recordsResponse.status,
            sourceCoverage: records.sourceCoverage,
            nameOnlyMatchingProhibited: true,
          },
          data,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
