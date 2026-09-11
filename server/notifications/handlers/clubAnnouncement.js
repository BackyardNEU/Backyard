// entity_id is the announcement's own id, not the club's. The dedup check in
// decisionLayer keys on (recipient_id, type, entity_id) within a five minute window, so
// reusing the club id there collapsed every announcement a club sent into one and
// silently dropped the rest. The club is carried in payload.clubId instead, which is
// what the notification's link needs anyway.
export function buildRow(event) {
  return {
    recipient_id: event.recipientId,
    actor_id: event.actorId,
    type: 'club_announcement',
    entity_type: 'club_announcement',
    entity_id: event.entity?.id ?? null,
    payload: event.payload ?? null,
  };
}

export const emailTemplate = null;
