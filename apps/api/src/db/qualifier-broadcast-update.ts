import type { PoolClient } from 'pg';
import { OFFICIAL_MATCH_SQL } from '../public/rehearsal-policy';
import { QUALIFIER_VIDEO_DAYS } from './qualifier-video-days';

// Caller owns the transaction. This updates media destinations only.
export async function updateQualifierBroadcasts(
  client: PoolClient,
  apply = false,
) {
  const event = await client.query<{ id: string }>(
    'SELECT id FROM tournament WHERE slug=$1',
    ['americas-qualifier-2026'],
  );
  if (event.rows.length !== 1)
    throw new Error('Expected one Americas qualifier tournament');
  const tournamentId = event.rows[0].id;
  if (apply)
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `broadcasts:${tournamentId}`,
    ]);
  const rows = await client.query<{ id: string; status: string; day: string }>(
    `SELECT m.id, m.status, to_char(m.scheduled_at AT TIME ZONE 'America/Barbados','YYYY-MM-DD') AS day
     FROM match m WHERE m.tournament_id=$1 AND m.round_label=$2 AND ${OFFICIAL_MATCH_SQL}
     ORDER BY m.scheduled_at`,
    [tournamentId, 'Regional Qualifier Americas'],
  );
  const plan = QUALIFIER_VIDEO_DAYS.map((video) => {
    const fixtures = rows.rows.filter((row) => row.day === video.date);
    if (!fixtures.length || fixtures.length > 4)
      throw new Error(
        `Expected 1–4 existing official fixtures for Day ${video.day} (${video.date})`,
      );
    const watchUrl = `https://www.youtube.com/watch?v=${video.videoId}${video.startSeconds ? `&t=${video.startSeconds}s` : ''}`;
    const embedUrl = `https://www.youtube-nocookie.com/embed/${video.videoId}${video.startSeconds ? `?start=${video.startSeconds}` : ''}`;
    return { ...video, watchUrl, embedUrl, fixtures };
  });
  if (apply)
    for (const day of plan)
      for (const fixture of day.fixtures) {
        const status =
          fixture.status === 'final'
            ? 'ended'
            : ['live', 'suspended', 'awaiting_confirmation'].includes(
                  fixture.status,
                )
              ? 'live'
              : 'scheduled';
        await client.query(
          `INSERT INTO match_broadcast (match_id,provider,external_id,watch_url,embed_url,replay_url,status)
       VALUES ($1,'YouTube',$2,$3,$4,$3,$5)
       ON CONFLICT (match_id) DO UPDATE SET provider=EXCLUDED.provider,external_id=EXCLUDED.external_id,
         watch_url=EXCLUDED.watch_url,embed_url=EXCLUDED.embed_url,replay_url=EXCLUDED.replay_url,
         status=EXCLUDED.status,updated_at=now()`,
          [fixture.id, day.videoId, day.watchUrl, day.embedUrl, status],
        );
      }
  return {
    mode: apply ? 'applied' : 'dry-run',
    days: plan.map((day) => ({
      day: day.day,
      date: day.date,
      fixtures: day.fixtures.length,
      watchUrl: day.watchUrl,
      embedUrl: day.embedUrl,
    })),
    matches: plan.reduce((sum, day) => sum + day.fixtures.length, 0),
  };
}
