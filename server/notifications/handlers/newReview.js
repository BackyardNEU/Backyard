export function buildRow(event) {
  return {
    recipient_id: event.recipientId,
    actor_id: event.actorId,
    type: 'new_review',
    entity_type: 'review',
    entity_id: event.entity?.id ?? null,
    payload: event.payload ?? null,
  };
}

export const emailTemplate = null;
