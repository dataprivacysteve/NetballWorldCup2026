import { createHash } from 'node:crypto';

type Bootstrap = { matches: Array<{ id: string }> };
type MatchExport = {
  state: { id: string; version: number };
  events: Array<{ sequence: number }>;
  lineups: Array<Record<string, unknown>>;
};

const cloudOrigin = required('EDGE_CLOUD_ORIGIN');
const localOrigin = required('EDGE_LOCAL_ORIGIN');
const nodeId = required('EDGE_NODE_ID');
const secret = required('EDGE_SYNC_SECRET');
const intervalMs = Math.max(
  1000,
  Number(process.env.EDGE_SYNC_INTERVAL_MS ?? 5000),
);
const runOnce = process.env.EDGE_SYNC_ONCE === 'true';

const headers = {
  'x-gameday-edge-node': nodeId,
  'x-gameday-edge-key': secret,
};

async function request<T>(origin: string, path: string, init?: RequestInit) {
  const response = await fetch(`${origin.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: { ...headers, ...init?.headers },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(
      `${path} returned ${response.status}: ${await response.text()}`,
    );
  }
  return (await response.json()) as T;
}

async function cycle() {
  const bootstrap = await request<Bootstrap>(cloudOrigin, '/edge/bootstrap');
  for (const fixture of bootstrap.matches) {
    let exported: MatchExport;
    try {
      exported = await request<MatchExport>(
        localOrigin,
        `/edge/matches/${fixture.id}/export?after=0`,
      );
    } catch (error) {
      // A newly scheduled fixture is expected to be absent until the next
      // controlled database/bootstrap refresh; keep other matches syncing.
      process.stderr.write(`${String(error)}\n`);
      continue;
    }
    const lastSequence = exported.events.at(-1)?.sequence ?? 0;
    const fingerprint = `${fixture.id}:${exported.state.version}:${lastSequence}`;
    const clientBatchId = createHash('sha256')
      .update(fingerprint)
      .digest('hex');
    await request(cloudOrigin, '/edge/matches/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientBatchId,
        matchId: fixture.id,
        state: exported.state,
        events: exported.events,
        lineups: exported.lineups,
      }),
    });
  }
  await request(cloudOrigin, '/edge/heartbeat', { method: 'POST' });
  await request(localOrigin, '/edge/heartbeat', { method: 'POST' });
}

async function main() {
  process.stdout.write(
    `GameDay edge synchronization started for node ${nodeId} every ${intervalMs}ms\n`,
  );
  for (;;) {
    try {
      await cycle();
    } catch (error) {
      process.stderr.write(`Synchronization cycle failed: ${String(error)}\n`);
    }
    if (runOnce) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

void main();
