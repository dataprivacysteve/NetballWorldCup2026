import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const connectionString = process.env.REHEARSAL_TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;

integration('LOC roster photo release (PostgreSQL)', () => {
  let client: Client;
  const event = randomUUID();
  const team = randomUUID();
  const person = randomUUID();
  const photo = randomUUID();

  beforeAll(async () => {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(connectionString!).hostname)) {
      throw new Error('Photo release tests require a loopback PostgreSQL host');
    }
    client = new Client({ connectionString });
    await client.connect();
    await client.query('SET search_path TO pg_temp');
    await client.query(`
      CREATE TEMP TABLE tournament (id uuid, player_photos_public_enabled boolean);
      CREATE TEMP TABLE delegation (id uuid, tournament_id uuid, registration_status text, status text);
      CREATE TEMP TABLE player (id uuid, delegation_id uuid, category text, eligibility_reference text);
      CREATE TEMP TABLE player_photo (id uuid, player_id uuid, object_key text, content_type text, status text, uploaded_at timestamptz);
      CREATE TEMP TABLE player_photo_publication_withdrawal (player_id uuid);
    `);
    const migration = readFileSync(resolve(__dirname, '../../drizzle/0043_loc_roster_photo_release.sql'), 'utf8');
    const view = migration.match(/CREATE OR REPLACE VIEW v_public_player_photo AS[\s\S]*?;/)?.[0];
    if (!view) throw new Error('Publication view missing from migration');
    await client.query(view.replace('CREATE OR REPLACE VIEW', 'CREATE TEMP VIEW'));
  });

  afterAll(async () => { await client?.end(); });

  beforeEach(async () => {
    await client.query('TRUNCATE tournament, delegation, player, player_photo, player_photo_publication_withdrawal');
    await client.query('INSERT INTO tournament VALUES ($1, true)', [event]);
    await client.query("INSERT INTO delegation VALUES ($1, $2, 'approved', 'approved')", [team, event]);
    await client.query("INSERT INTO player VALUES ($1, $2, 'player', NULL)", [person, team]);
    await client.query("INSERT INTO player_photo VALUES ($1, $2, $3, 'image/jpeg', 'uploaded', now())", [photo, person, `${team}/${person}/${photo}`]);
  });

  const visible = async () => (await client.query('SELECT * FROM v_public_player_photo')).rows;

  it('publishes the current roster portrait under the LOC release without per-player consent records', async () => {
    expect(await visible()).toEqual([{ player_id: person, object_key: `${team}/${person}/${photo}`, content_type: 'image/jpeg' }]);
  });

  it('stops publication when the LOC release is disabled', async () => {
    await client.query('UPDATE tournament SET player_photos_public_enabled = false');
    expect(await visible()).toEqual([]);
  });

  it('honors individual withdrawal and restoration', async () => {
    await client.query('INSERT INTO player_photo_publication_withdrawal VALUES ($1)', [person]);
    expect(await visible()).toEqual([]);
    await client.query('DELETE FROM player_photo_publication_withdrawal');
    expect(await visible()).toHaveLength(1);
  });

  it('excludes unapproved rosters, non-player records and non-photo object keys', async () => {
    await client.query("UPDATE delegation SET status = 'draft'");
    expect(await visible()).toEqual([]);
    await client.query("UPDATE delegation SET status = 'approved'; UPDATE player SET category = 'official'");
    expect(await visible()).toEqual([]);
    await client.query("UPDATE player SET category = 'player'; UPDATE player_photo SET object_key = 'identity/document'");
    expect(await visible()).toEqual([]);
  });

  it('uses only the latest image and never falls back to an older uploaded portrait', async () => {
    await client.query("INSERT INTO player_photo VALUES ($1, $2, $3, 'image/jpeg', 'pending', now() + interval '1 second')", [randomUUID(), person, `${team}/${person}/${randomUUID()}`]);
    expect(await visible()).toEqual([]);
  });
});
