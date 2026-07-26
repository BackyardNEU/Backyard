export function buildRow(event) {
  return {
    recipient_id: event.recipientId,
    actor_id: event.actorId,
    type: 'friend_request',
    entity_type: 'friend_request',
    entity_id: event.entity?.id ?? null,
  };
}

export const emailTemplate = null;
