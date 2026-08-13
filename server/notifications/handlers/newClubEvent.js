export function buildRow(event) {
  return {
    recipient_id: event.recipientId,
    actor_id: event.actorId,
    type: 'new_club_event',
    entity_type: 'club_event',
    entity_id: event.entity?.id ?? null,
    payload: event.payload ?? null,
  };
}

export const emailTemplate = null;
