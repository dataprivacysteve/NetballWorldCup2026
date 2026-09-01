import '../db/env';

const apiOrigin =
  process.env.REHEARSAL_API_ORIGIN ??
  (process.env.NODE_ENV === 'production'
    ? (process.env.API_BASE_URL ?? 'https://api.netballamericas.org')
    : 'http://localhost:3000');
const password = process.env.REHEARSAL_PASSWORD;
const rehearsalRound = 'LOC Presentation Rehearsal';

if (!password) {
  throw new Error('REHEARSAL_PASSWORD is required');
}

const accounts = {
  scorer: 'rehearsal.scorer@netballamericas.test',
  timekeeper: 'rehearsal.timekeeper@netballamericas.test',
  supervisor: 'rehearsal.supervisor@netballamericas.test',
  statistics: 'rehearsal.statistics@netballamericas.test',
  approver: 'rehearsal.approver@netballamericas.test',
} as const;

type Role = keyof typeof accounts;
type MatchRecord = {
  id: string;
  roundLabel: string | null;
  status: string;
  version: number;
  teamADelegationId: string;
  teamBDelegationId: string;
  teamAScore: number;
  teamBScore: number;
};
type MatchState = {
  match: MatchRecord;
  events: Array<{ id: string; eventType: string }>;
  teamSheets: Array<{
    delegationId: string;
    players: Array<{
      playerId: string;
      currentPosition: string | null;
      bench: boolean;
    }>;
  }>;
};

const cookies = new Map<Role, string>();

async function responseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText}: ${text || 'empty response'}`,
    );
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

async function login(role: Role) {
  const response = await fetch(`${apiOrigin}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: accounts[role], password }),
  });
  await responseJson(response);
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) throw new Error(`Login for ${role} did not return a cookie`);
  cookies.set(role, setCookie.split(';', 1)[0]);
}

async function request<T>(
  role: Role,
  path: string,
  method = 'GET',
  body?: Record<string, unknown>,
) {
  const cookie = cookies.get(role);
  if (!cookie) throw new Error(`${role} is not signed in`);
  const response = await fetch(`${apiOrigin}${path}`, {
    method,
    headers: {
      cookie,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return responseJson<T>(response);
}

async function expectDenied(
  role: Role,
  path: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${apiOrigin}${path}`, {
    method: 'POST',
    headers: {
      cookie: cookies.get(role) ?? '',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (response.status !== 403) {
    const text = await response.text();
    throw new Error(
      `Expected ${role} command to be denied with 403, received ${response.status}: ${text}`,
    );
  }
}

function commandVersion(result: MatchRecord | { match: MatchRecord }) {
  return 'match' in result ? result.match.version : result.version;
}

async function main() {
  await Promise.all((Object.keys(accounts) as Role[]).map(login));

  const assigned = await request<MatchRecord[]>('scorer', '/gameday/matches');
  const fixture = assigned.find((match) => match.roundLabel === rehearsalRound);
  if (!fixture) throw new Error('The prepared rehearsal fixture is missing');
  const path = `/gameday/matches/${fixture.id}`;
  let state = await request<MatchState>('scorer', path);
  if (state.match.status !== 'scheduled') {
    throw new Error(
      `Rehearsal must begin scheduled, received ${state.match.status}. Run db:prepare-rehearsal first.`,
    );
  }

  const teamASheet = state.teamSheets.find(
    (sheet) => sheet.delegationId === state.match.teamADelegationId,
  );
  const teamBSheet = state.teamSheets.find(
    (sheet) => sheet.delegationId === state.match.teamBDelegationId,
  );
  if (!teamASheet || !teamBSheet)
    throw new Error('Both team sheets are required');
  const teamAPlayer = teamASheet.players[0]?.playerId;
  const teamBPlayer = teamBSheet.players[0]?.playerId;
  const teamABenchPlayer = teamASheet.players.find(
    (player) => player.bench,
  )?.playerId;
  if (!teamAPlayer || !teamBPlayer || !teamABenchPlayer) {
    throw new Error('The rehearsal sheets do not contain the required players');
  }

  let version = commandVersion(
    await request<MatchRecord>('scorer', `${path}/ready`, 'POST', {
      expectedVersion: state.match.version,
    }),
  );
  version = commandVersion(
    await request<{ match: MatchRecord }>(
      'scorer',
      `${path}/centre-pass`,
      'POST',
      { expectedVersion: version, teamSide: 'A' },
    ),
  );
  version = commandVersion(
    await request<{ match: MatchRecord }>('scorer', `${path}/clock`, 'POST', {
      expectedVersion: version,
      action: 'start_period',
    }),
  );

  const firstGoal = await request<{
    match: MatchRecord;
    event: { id: string };
  }>('scorer', `${path}/goals`, 'POST', {
    expectedVersion: version,
    teamSide: 'A',
    playerId: teamAPlayer,
  });
  version = firstGoal.match.version;
  version = commandVersion(
    await request<{ match: MatchRecord }>(
      'scorer',
      `${path}/goals/correct`,
      'POST',
      {
        expectedVersion: version,
        eventId: firstGoal.event.id,
        reason: 'Automated rehearsal correction',
      },
    ),
  );

  for (const [teamSide, playerId] of [
    ['A', teamAPlayer],
    ['A', teamAPlayer],
    ['B', teamBPlayer],
  ] as const) {
    version = commandVersion(
      await request<{ match: MatchRecord }>('scorer', `${path}/goals`, 'POST', {
        expectedVersion: version,
        teamSide,
        playerId,
      }),
    );
  }

  await expectDenied('timekeeper', `${path}/goals`, {
    expectedVersion: version,
    teamSide: 'B',
    playerId: teamBPlayer,
  });

  state = await request<MatchState>('statistics', path);
  version = commandVersion(
    await request<{ match: MatchRecord }>(
      'statistics',
      `${path}/statistics`,
      'POST',
      {
        expectedVersion: state.match.version,
        playerId: teamAPlayer,
        statisticType: 'goal_attempt',
      },
    ),
  );
  version = commandVersion(
    await request<{ match: MatchRecord }>(
      'statistics',
      `${path}/lineup`,
      'POST',
      {
        expectedVersion: version,
        playerId: teamABenchPlayer,
        position: 'Goal Shooter',
        reason: 'Automated rehearsal substitution',
      },
    ),
  );

  version = commandVersion(
    await request<{ match: MatchRecord }>(
      'supervisor',
      `${path}/incidents`,
      'POST',
      {
        expectedVersion: version,
        incidentType: 'technical',
        note: 'Automated rehearsal incident',
      },
    ),
  );

  // The scorer deliberately controls the clock here. This proves the
  // one-person table fallback while a dedicated timekeeper remains assigned.
  for (const action of ['start_clock', 'stop_clock'] as const) {
    version = commandVersion(
      await request<{ match: MatchRecord }>('scorer', `${path}/clock`, 'POST', {
        expectedVersion: version,
        action,
      }),
    );
  }
  version = commandVersion(
    await request<{ match: MatchRecord }>('scorer', `${path}/clock`, 'POST', {
      expectedVersion: version,
      action: 'suspend',
      reason: 'Automated resilience rehearsal',
    }),
  );
  version = commandVersion(
    await request<{ match: MatchRecord }>('scorer', `${path}/clock`, 'POST', {
      expectedVersion: version,
      action: 'resume',
    }),
  );
  version = commandVersion(
    await request<{ match: MatchRecord }>('scorer', `${path}/clock`, 'POST', {
      expectedVersion: version,
      action: 'stop_clock',
    }),
  );

  // Close Q1, then start/close Q2-Q4. Periods are intentionally shortened for
  // an automated acceptance run; the same lifecycle is used by a live match.
  version = commandVersion(
    await request<{ match: MatchRecord }>('scorer', `${path}/clock`, 'POST', {
      expectedVersion: version,
      action: 'end_period',
    }),
  );
  for (let period = 2; period <= 4; period += 1) {
    version = commandVersion(
      await request<{ match: MatchRecord }>('scorer', `${path}/clock`, 'POST', {
        expectedVersion: version,
        action: 'start_period',
      }),
    );
    version = commandVersion(
      await request<{ match: MatchRecord }>('scorer', `${path}/clock`, 'POST', {
        expectedVersion: version,
        action: 'end_period',
      }),
    );
  }

  const awaiting = await request<MatchState>('approver', path);
  if (awaiting.match.status !== 'awaiting_confirmation') {
    throw new Error(
      `Expected awaiting_confirmation, received ${awaiting.match.status}`,
    );
  }
  await request<MatchRecord>('approver', `${path}/result/confirm`, 'POST', {
    expectedVersion: awaiting.match.version,
    confirmationNote: 'Automated paper-reference reconciliation passed',
  });

  const finalState = await request<MatchState>('approver', path);
  if (
    finalState.match.status !== 'final' ||
    finalState.match.teamAScore !== 2 ||
    finalState.match.teamBScore !== 1
  ) {
    throw new Error(
      `Unexpected final state: ${finalState.match.status} ${finalState.match.teamAScore}-${finalState.match.teamBScore}`,
    );
  }

  const liveResponse = await fetch(`${apiOrigin}/live.json`, {
    cache: 'no-store',
  });
  const live = await responseJson<{
    MatchId: string;
    Status: string;
    TeamAScore: number;
    TeamBScore: number;
  }>(liveResponse);
  if (
    live.MatchId !== fixture.id ||
    live.Status !== 'FINAL' ||
    live.TeamAScore !== 2 ||
    live.TeamBScore !== 1
  ) {
    throw new Error('The root broadcast feed does not match the final ledger');
  }
  const xmlResponse = await fetch(`${apiOrigin}/live.xml`, {
    cache: 'no-store',
  });
  const xml = await xmlResponse.text();
  if (
    !xmlResponse.ok ||
    !xml.includes(`<MatchId>${fixture.id}</MatchId>`) ||
    !xml.includes('<TeamAScore>2</TeamAScore>') ||
    !xml.includes('<TeamBScore>1</TeamBScore>')
  ) {
    throw new Error('The vMix XML feed does not match the final ledger');
  }

  const reportResponse = await fetch(
    `${apiOrigin}/public/analytics/matches/${fixture.id}/report.csv`,
    { cache: 'no-store' },
  );
  const report = await reportResponse.text();
  const reportRows = report.split(/\r?\n/);
  const periodRows = reportRows.filter((row) => row.startsWith('"period"'));
  const sheetRows = reportRows.filter((row) => row.startsWith('"teamSheet"'));
  const roleRows = reportRows.filter((row) => row.startsWith('"officialRole"'));
  const incidentRows = reportRows.filter((row) => row.startsWith('"incident"'));
  if (
    !reportResponse.ok ||
    periodRows.length !== 4 ||
    sheetRows.length !== 20 ||
    roleRows.length !== 5 ||
    incidentRows.length !== 1
  ) {
    throw new Error(
      `Match report is incomplete: HTTP ${reportResponse.status}, periods ${periodRows.length}, sheets ${sheetRows.length}, roles ${roleRows.length}, incidents ${incidentRows.length}`,
    );
  }

  console.log('GameDay rehearsal passed.');
  console.log(`  Match: ${fixture.id}`);
  console.log('  Result: XTA 2–1 XTB (FINAL)');
  console.log(`  Ledger events returned: ${finalState.events.length}`);
  console.log('  Scorer-as-clock fallback: passed');
  console.log('  Timekeeper scoring denial: passed');
  console.log('  Statistics, lineup, incident and correction: passed');
  console.log('  JSON/XML output reconciliation: passed');
  console.log(
    '  Match report: 4 periods, 20 selections, 5 roles and 1 incident passed',
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
