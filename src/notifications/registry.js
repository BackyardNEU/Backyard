import { UserPlus, UserCheck, CalendarPlus, Star, Megaphone } from 'lucide-react';

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
  club_announcement: {
    icon: Megaphone,
    image: (n) => n.payload?.imageUrl ?? null,
    message: (n) => {
      const sender = n.actor?.username ?? 'A moderator';
      const club = n.payload?.clubName ?? 'a club';
      const title = n.payload?.title;
      return title ? `${sender} from ${club}: ${title}` : `${sender} posted an announcement in ${club}`;
    },
    // ?club= is what UniversityPage reads into autoExpandId, so the tap opens the
    // club that announced rather than dropping the member on a hub of every tile.
    // Same shape QrFlyerButton and JoinPage already use.
    getUrl: (n) => {
      const { uniId, clubId } = n.payload ?? {};
      if (!uniId) return null;
      return clubId ? `/university/${uniId}?club=${clubId}` : `/university/${uniId}`;
    },
    getUrl: (n) => {
      const { uniId, clubId } = n.payload ?? {};
      if (!uniId) return null;
      return clubId ? `/university/${uniId}?club=${clubId}` : `/university/${uniId}`;
    },
  },
};
