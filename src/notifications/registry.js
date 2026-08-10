import { UserPlus, UserCheck, CalendarPlus, Star } from 'lucide-react';

export const registry = {
  friend_request: {
    icon: UserPlus,
    message: (n) => `${n.actor?.username ?? 'Someone'} sent you a friend request`,
    actions: ['accepted', 'declined'],
  },
  friend_accepted: {
    icon: UserCheck,
    message: (n) => `${n.actor?.username ?? 'Someone'} accepted your friend request`,
  },
  new_review: {
    icon: Star,
    image: (n) => n.payload?.imageUrl ?? null,
    message: (n) => {
      const club = n.payload?.clubName ?? 'your club';
      return `${n.actor?.username ?? 'Someone'} left a review on ${club}`;
    },
  },
  new_club_event: {
    icon: CalendarPlus,
    // Show the club logo instead of the actor's avatar
    image: (n) => n.payload?.imageUrl ?? null,
    message: (n) => {
      const club = n.payload?.clubName ?? 'A club you joined';
      const event = n.payload?.eventName;
      return event ? `${club} posted a new event: ${event}` : `${club} posted a new event`;
    },
  },
};
