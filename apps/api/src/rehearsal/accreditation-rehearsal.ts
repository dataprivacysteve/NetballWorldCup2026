import '../db/env';
import { Pool } from 'pg';

const apiOrigin =
  process.env.REHEARSAL_API_ORIGIN ??
  (process.env.NODE_ENV === 'production'
    ? (process.env.API_BASE_URL ?? 'https://api.netballamericas.org')
    : 'http://localhost:3000');
const password = process.env.REHEARSAL_PASSWORD;
const managerEmail = 'rehearsal.team-a@netballamericas.test';

if (!password) throw new Error('REHEARSAL_PASSWORD is required');
if (
  process.env.NODE_ENV === 'production' &&
  process.env.ALLOW_PRODUCTION_REHEARSAL_DATA !== 'true'
) {
  throw new Error(
    'Refusing to rehearse against production without ALLOW_PRODUCTION_REHEARSAL_DATA=true',
  );
}
if (!process.env.MIGRATION_DATABASE_URL) {
  throw new Error('MIGRATION_DATABASE_URL is required');
}

type ReviewDetail = {
  delegation: { id: string; countryCode: string; status: string };
  people: Array<{
    id: string;
    verificationStatus: string;
    credentialId: string | null;
    credentialStatus: string | null;
  }>;
};
type Credential = { id: string; status: string; playerId: string };

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText}: ${body || 'empty response'}`,
    );
  }
  return body ? (JSON.parse(body) as T) : ({} as T);
}

async function login(email: string) {
  const response = await fetch(`${apiOrigin}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  await responseJson(response);
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  if (!cookie) throw new Error(`Login for ${email} did not return a cookie`);
  return cookie;
}

async function request<T>(
  cookie: string,
  path: string,
  method = 'GET',
  body?: Record<string, unknown>,
) {
  return responseJson<T>(
    await fetch(`${apiOrigin}${path}`, {
      method,
      headers: {
        cookie,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.MIGRATION_DATABASE_URL,
  });
  const client = await pool.connect();
  let delegationId: string;
  let identityDocumentBytesRetained: number;
  let locEmail: string;
  try {
    await client.query('BEGIN');
    const loc = await client.query<{ email: string }>(
      `SELECT email FROM app_user WHERE platform_role = 'loc_officer' LIMIT 1`,
    );
    if (!loc.rows[0]) throw new Error('The LOC officer account is missing');
    locEmail = loc.rows[0].email;
    const delegation = await client.query<{ id: string }>(
      `SELECT id FROM delegation WHERE country_code = 'XTA' LIMIT 1`,
    );
    if (!delegation.rows[0]) {
      throw new Error(
        'Training Team A is missing; run db:prepare-rehearsal first',
      );
    }
    delegationId = delegation.rows[0].id;
    await client.query('DELETE FROM credential WHERE delegation_id = $1', [
      delegationId,
    ]);
    await client.query(
      `UPDATE delegation SET
         registration_status = 'submitted', approved_at = NULL,
         status = 'submitted', accredited_at = NULL,
         review_note = NULL, updated_at = now()
       WHERE id = $1`,
      [delegationId],
    );
    const identityCount = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM identity_document
       WHERE delegation_id = $1
         AND object_key IS NOT NULL
         AND document_deleted_at IS NULL`,
      [delegationId],
    );
    identityDocumentBytesRetained = Number(identityCount.rows[0]?.count ?? 0);
    if (identityDocumentBytesRetained !== 0) {
      throw new Error('Synthetic identity document bytes were not deleted');
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  const [locCookie, managerCookie] = await Promise.all([
    login(locEmail),
    login(managerEmail),
  ]);
  const denied = await fetch(`${apiOrigin}/admin/review`, {
    headers: { cookie: managerCookie },
  });
  if (denied.status !== 403) {
    throw new Error(
      `Expected team manager LOC access to be denied with 403, received ${denied.status}`,
    );
  }

  const pending = await request<Array<{ id: string }>>(
    locCookie,
    '/admin/delegations',
  );
  if (!pending.some((delegation) => delegation.id === delegationId)) {
    throw new Error('Training Team A did not enter the LOC registration queue');
  }
  await request(
    locCookie,
    `/admin/delegations/${delegationId}/approve`,
    'POST',
  );

  const before = await request<ReviewDetail>(
    locCookie,
    `/admin/review/${delegationId}`,
  );
  if (before.people.length < 13) {
    throw new Error(
      `Expected a complete synthetic roster, received ${before.people.length} people`,
    );
  }
  if (
    before.people.some((person) => person.verificationStatus !== 'verified')
  ) {
    throw new Error('Every synthetic person must be verified before approval');
  }

  const approval = await request<{
    accredited: boolean;
    issued: number;
    total: number;
  }>(locCookie, `/admin/review/${delegationId}/approve`, 'POST');
  if (
    !approval.accredited ||
    approval.issued !== before.people.length ||
    approval.total !== before.people.length
  ) {
    throw new Error(
      `Unexpected accreditation result: ${JSON.stringify(approval)}`,
    );
  }

  const after = await request<ReviewDetail>(
    locCookie,
    `/admin/review/${delegationId}`,
  );
  const issued = after.people.find(
    (person) => person.credentialId && person.credentialStatus === 'issued',
  );
  if (!issued?.credentialId)
    throw new Error('No issued credential was returned');

  const revoked = await request<Credential>(
    locCookie,
    `/admin/credentials/${issued.credentialId}/revoke`,
    'POST',
    { reason: 'LOC accreditation lifecycle rehearsal' },
  );
  if (revoked.status !== 'revoked') throw new Error('Credential revoke failed');
  const reissued = await request<Credential>(
    locCookie,
    `/admin/credentials/${issued.credentialId}/reissue`,
    'POST',
  );
  if (reissued.status !== 'issued' || reissued.id === issued.credentialId) {
    throw new Error('Credential reissue did not create a new issued record');
  }

  const audit = await request<
    Array<{ action: string; targetId: string | null }>
  >(locCookie, '/admin/audit');
  for (const action of [
    'registration.approved',
    'roster.approved',
    'credential.revoked',
    'credential.reissued',
  ]) {
    if (!audit.some((event) => event.action === action)) {
      throw new Error(`Audit trail is missing ${action}`);
    }
  }

  console.log('Registration and accreditation rehearsal passed.');
  console.log(`Delegation: XTA (${delegationId})`);
  console.log(`People verified/accredited: ${approval.total}`);
  console.log(`Credentials issued: ${approval.issued}`);
  console.log(`Credential lifecycle: ${issued.credentialId} -> ${reissued.id}`);
  console.log(`Team manager LOC authorization: denied ${denied.status}`);
  console.log(
    `Synthetic identity document bytes retained: ${identityDocumentBytesRetained}`,
  );
  console.log(
    'Audit trail: registration, approval, revoke and reissue present.',
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
