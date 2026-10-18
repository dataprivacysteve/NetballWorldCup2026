// Reserved identifiers used by db:prepare-rehearsal. A label alone is not a
// general-purpose test mode: other training fixtures must use these identifiers.
export const REHEARSAL_ROUND_LABEL = 'LOC Presentation Rehearsal';
export const REHEARSAL_STAGE_NAME = 'Presentation Rehearsal';

// Correlated predicate: the caller must name its match table `m`. Use EXISTS
// instead of nullable joins so fixtures without a stage remain official.
// Any one marker is sufficient, including a synthetic side in a normal group.
export const REHEARSAL_MATCH_SQL = `(
  lower(btrim(COALESCE(m.round_label, ''))) = lower('${REHEARSAL_ROUND_LABEL}')
  OR EXISTS (
    SELECT 1 FROM stage rehearsal_stage
    WHERE rehearsal_stage.id = m.stage_id
      AND lower(btrim(rehearsal_stage.name)) = lower('${REHEARSAL_STAGE_NAME}')
  )
  OR EXISTS (
    SELECT 1 FROM v_public_nation rehearsal_team
    WHERE rehearsal_team.id IN (m.team_a_delegation_id, m.team_b_delegation_id)
      AND upper(btrim(rehearsal_team.country_code)) IN ('XTA', 'XTB')
  )
)`;

// Old practice fixtures can use real nations and an ordinary round label.
// Keep them out of tournament feeds without deleting their operational records.
// Compare local calendar dates so the final evening remains inside the event.
export const OFFICIAL_MATCH_SQL = `NOT ${REHEARSAL_MATCH_SQL}
  AND NOT EXISTS (
    SELECT 1 FROM tournament event
    WHERE event.id = m.tournament_id
      AND (
        (event.starts_on IS NOT NULL
          AND (m.scheduled_at AT TIME ZONE event.timezone)::date < event.starts_on)
        OR (event.ends_on IS NOT NULL
          AND (m.scheduled_at AT TIME ZONE event.timezone)::date > event.ends_on)
      )
  )`;
