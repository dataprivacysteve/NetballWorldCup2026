import { and, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { getTenant } from '../tenant/tenant-context';

export function requiresRosterAmendmentTransition(status: string): boolean {
  return status === 'submitted' || status === 'approved';
}

export function playerUpdateRequiresLocReview(
  category: string,
  fields: string[],
): boolean {
  return fields.some(
    (field) =>
      field !== 'biography' &&
      !(category === 'player' && ['role', 'jerseyNumber'].includes(field)),
  );
}

export async function assertRosterEditable(options?: {
  requiresLocReview?: boolean;
}) {
  if (options?.requiresLocReview === false) return;
  const { db, delegationId, userId } = getTenant();
  const [delegation] = await db
    .select({ status: schema.delegation.status })
    .from(schema.delegation)
    .where(eq(schema.delegation.id, delegationId));
  if (!delegation || !requiresRosterAmendmentTransition(delegation.status)) {
    return;
  }

  // Existing approved delegations may amend their roster after the new-team
  // registration cutoff. A submitted/accredited roster is never changed
  // silently: reopen it, invalidate live credentials, and require LOC review.
  const revoked = await db
    .update(schema.credential)
    .set({ status: 'revoked' })
    .where(
      and(
        eq(schema.credential.delegationId, delegationId),
        eq(schema.credential.status, 'issued'),
      ),
    )
    .returning({ id: schema.credential.id });
  await db
    .update(schema.delegation)
    .set({
      status: 'draft',
      submittedAt: null,
      accreditedAt: null,
      reviewNote:
        'Roster amended after submission; LOC re-review and credential reissue are required.',
      updatedAt: new Date(),
    })
    .where(eq(schema.delegation.id, delegationId));
  await db.insert(schema.teamAuditEvent).values({
    delegationId,
    actorUserId: userId,
    action: 'roster.amendment.started',
    targetType: 'delegation',
    targetId: delegationId,
    details: {
      previousStatus: delegation.status,
      credentialsRevoked: revoked.length,
    },
  });
}
