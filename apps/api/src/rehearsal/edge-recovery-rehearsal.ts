import '../db/env';

const apiOrigin = process.env.REHEARSAL_API_ORIGIN ?? 'http://localhost:3000';
const nodeId = '7d9bf462-fd86-4b93-a52d-8abf39a4ac16';
const secret = process.env.EDGE_SYNC_SECRET;

if (!secret) throw new Error('EDGE_SYNC_SECRET is required');

const headers = {
  'x-gameday-edge-node': nodeId,
  'x-gameday-edge-key': secret,
};

type MatchState = {
  id: string;
  roundLabel: string | null;
  status: string;
  teamAScore: number;
  teamBScore: number;
  version: number;
};
type MatchExport = {
  state: MatchState;
  events: Array<Record<string, unknown> & { sequence: number }>;
  lineups: Array<Record<string, unknown>>;
};

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${apiOrigin}${path}`, {
    ...init,
    headers: { ...headers, ...init?.headers },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${body}`);
  }
  return body ? (JSON.parse(body) as T) : ({} as T);
}

async function main() {
  const heartbeat = await request<{ ok: boolean; nodeId: string }>(
    '/edge/heartbeat',
    { method: 'POST' },
  );
  if (!heartbeat.ok || heartbeat.nodeId !== nodeId) {
    throw new Error('Venue edge heartbeat failed');
  }
  const bootstrap = await request<{ matches: MatchState[] }>('/edge/bootstrap');
  const match = bootstrap.matches.find(
    (item) => item.roundLabel === 'LOC Presentation Rehearsal',
  );
  if (!match) throw new Error('Presentation fixture is outside edge scope');

  const exported = await request<MatchExport>(
    `/edge/matches/${match.id}/export?after=0`,
  );
  const lastSequence = exported.events.at(-1)?.sequence ?? 0;
  const clientBatchId = `loc-presentation-${match.version}-${lastSequence}`;
  const payload = {
    clientBatchId,
    matchId: match.id,
    state: exported.state,
    events: exported.events,
    lineups: exported.lineups,
  };
  const first = await request<{
    accepted: boolean;
    duplicate: boolean;
    version: number;
    lastSequence: number;
  }>('/edge/matches/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!first.accepted || first.duplicate) {
    throw new Error('Initial venue synchronization was not accepted');
  }

  // This is the recovery case after a venue sends successfully but loses the
  // HTTP response: the exact same batch must be safe to retry.
  const retry = await request<typeof first>('/edge/matches/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!retry.accepted || !retry.duplicate) {
    throw new Error('Synchronization retry was not idempotent');
  }

  const conflictResponse = await fetch(`${apiOrigin}/edge/matches/sync`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      state: { ...exported.state, teamAScore: exported.state.teamAScore + 1 },
    }),
  });
  if (conflictResponse.status !== 409) {
    throw new Error(
      `Changed retry should return 409, received ${conflictResponse.status}`,
    );
  }

  const reconciled = await request<MatchExport>(
    `/edge/matches/${match.id}/export?after=0`,
  );
  if (
    reconciled.state.version !== exported.state.version ||
    reconciled.state.teamAScore !== exported.state.teamAScore ||
    reconciled.events.length !== exported.events.length
  ) {
    throw new Error('Cloud state changed during edge retry recovery');
  }

  console.log('Venue edge recovery rehearsal passed.');
  console.log(`Node: ${nodeId}`);
  console.log(`Match: ${match.id}`);
  console.log(`Version/last sequence: ${first.version}/${first.lastSequence}`);
  console.log(
    'Dropped-response retry: duplicate accepted without double write.',
  );
  console.log('Changed payload reuse: rejected 409.');
  console.log('Cloud state and ledger reconciled after retry.');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
