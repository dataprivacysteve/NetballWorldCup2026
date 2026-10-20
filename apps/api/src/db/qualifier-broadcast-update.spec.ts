import { randomUUID } from 'node:crypto';
import { Client, type PoolClient } from 'pg';
import { QUALIFIER_VIDEO_DAYS } from './qualifier-video-days';
import { updateQualifierBroadcasts } from './qualifier-broadcast-update';

const connectionString = process.env.REHEARSAL_TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;
integration(
  'daily qualifier video update (temporary PostgreSQL tables)',
  () => {
    let client: Client;
    let ids: string[];
    let practice: string;
    const db = () => client as unknown as PoolClient;
    beforeAll(async () => {
      if (
        !['localhost', '127.0.0.1', '[::1]'].includes(
          new URL(connectionString!).hostname,
        )
      )
        throw new Error('Tests require loopback PostgreSQL');
      client = new Client({ connectionString });
      await client.connect();
      await client.query(`SET search_path TO pg_temp;
      CREATE TEMP TABLE tournament(id uuid,slug text,starts_on date,ends_on date,timezone text);
      CREATE TEMP TABLE stage(id uuid,name text);
      CREATE TEMP TABLE v_public_nation(id uuid,country_code text);
      CREATE TEMP TABLE match(id uuid,tournament_id uuid,stage_id uuid,round_label text,status text,scheduled_at timestamptz,team_a_delegation_id uuid,team_b_delegation_id uuid,team_a_score int,team_b_score int,version int);
      CREATE TEMP TABLE match_broadcast(match_id uuid PRIMARY KEY,provider text,external_id text,watch_url text,embed_url text,replay_url text,status text,featured boolean DEFAULT false,updated_at timestamptz DEFAULT now());
    `);
    });
    afterAll(async () => {
      await client?.end();
    });
    beforeEach(async () => {
      await client.query('TRUNCATE tournament,match,match_broadcast');
      ids = [];
      const event = randomUUID();
      await client.query(
        "INSERT INTO tournament VALUES ($1,'americas-qualifier-2026','2026-10-19','2026-10-26','America/Barbados')",
        [event],
      );
      for (const video of QUALIFIER_VIDEO_DAYS) {
        const id = randomUUID();
        ids.push(id);
        // The first day's 8 PM game is the following calendar date in UTC.
        const at =
          video.day === 1 ? '2026-10-20T00:00:00Z' : `${video.date}T18:00:00Z`;
        await client.query(
          "INSERT INTO match VALUES ($1,$2,NULL,'Regional Qualifier Americas',$3,$4,$5,$6,50,40,9)",
          [
            id,
            event,
            video.day === 1 ? 'final' : video.day === 2 ? 'live' : 'scheduled',
            at,
            randomUUID(),
            randomUUID(),
          ],
        );
      }
      practice = randomUUID();
      await client.query(
        "INSERT INTO match VALUES ($1,$2,NULL,'LOC Presentation Rehearsal','scheduled','2026-10-20T18:00:00Z',$3,$4,0,0,0)",
        [practice, event, randomUUID(), randomUUID()],
      );
      await client.query(
        "INSERT INTO match_broadcast(match_id,provider,status,featured) VALUES ($1,'Old provider','scheduled',true)",
        [ids[1]],
      );
    });
    it('previews all seven playing days and preserves the rest day gap without writes', async () => {
      await client.query('BEGIN READ ONLY');
      try {
        const result = await updateQualifierBroadcasts(db());
        expect(result.days.map((day) => day.date)).toEqual([
          '2026-10-19',
          '2026-10-20',
          '2026-10-21',
          '2026-10-23',
          '2026-10-24',
          '2026-10-25',
          '2026-10-26',
        ]);
        expect(result.days[0].watchUrl).toContain('&t=13s');
        expect(result.days[0].embedUrl).toContain('?start=13');
      } finally {
        await client.query('ROLLBACK');
      }
      expect(
        (await client.query('SELECT * FROM match_broadcast')).rowCount,
      ).toBe(1);
    });
    it('updates daily live and replay links, retaining match data and featured selections', async () => {
      const before = (
        await client.query<Record<string, unknown>>(
          'SELECT * FROM match ORDER BY id',
        )
      ).rows;
      await client.query('BEGIN');
      try {
        await updateQualifierBroadcasts(db(), true);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      const videos = await client.query<{
        match_id: string;
        external_id: string;
        watch_url: string;
        replay_url: string;
        embed_url: string;
        status: string;
        featured: boolean;
      }>('SELECT * FROM match_broadcast');
      expect(videos.rowCount).toBe(7);
      for (const [i, video] of QUALIFIER_VIDEO_DAYS.entries()) {
        const row = videos.rows.find((row) => row.match_id === ids[i]);
        expect(row).toMatchObject({
          external_id: video.videoId,
          status: i === 0 ? 'ended' : i === 1 ? 'live' : 'scheduled',
          featured: i === 1,
        });
        expect(row?.replay_url).toBe(row?.watch_url);
      }
      expect(videos.rows.some((row) => row.match_id === practice)).toBe(false);
      expect(
        (
          await client.query<Record<string, unknown>>(
            'SELECT * FROM match ORDER BY id',
          )
        ).rows,
      ).toEqual(before);
      await client.query('BEGIN');
      try {
        await updateQualifierBroadcasts(db(), true);
      } finally {
        await client.query('ROLLBACK');
      }
      expect(
        (await client.query('SELECT * FROM match_broadcast')).rowCount,
      ).toBe(7);
    });
    it('validates every day before making any update', async () => {
      await client.query('DELETE FROM match WHERE id=$1', [ids[6]]);
      await expect(updateQualifierBroadcasts(db(), true)).rejects.toThrow(
        'Day 7',
      );
      expect(
        (await client.query('SELECT * FROM match_broadcast')).rowCount,
      ).toBe(1);
    });
  },
);
