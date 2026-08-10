import { UserPlus, UserCheck } from 'lucide-react';

export const registry = {
  friend_request: {
    icon: UserPlus,
    message: ({ actor }) => `${actor?.username ?? 'Someone'} sent you a friend request`,
    actions: ['accepted', 'declined'],
  },
friend_accepted: {
    icon: UserCheck,
    message: ({ actor }) => `${actor?.username ?? 'Someone'} accepted your friend request`,
  },
};
