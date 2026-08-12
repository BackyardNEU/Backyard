// Column allowlists for the routes that anyone can call without a token.
//
// These reads used `select('*')`, which returns whatever the table happens to hold.
// That is fine right up until someone adds an internal column — a contact email, a
// moderation note, an owner's phone number — and it starts being served to the public
// internet without anyone touching the route. Naming the columns means new ones are
// private by default and have to be opted in.
//
// Derived from what the frontend actually reads: club_name, club_description, category,
// image_url and school are the only fields any component touches, plus id for keys and
// routing, and join_policy for the membership button.

export const PUBLIC_CLUB_COLUMNS =
  'id, club_name, club_description, category, image_url, school, join_policy';

// Reviews carry user_id because the UI needs it to mark a review as yours and to
// resolve vote state. That is a deliberate exposure, not an oversight — but the
// ratings breakdown and the moderation flag are not part of it.
export const PUBLIC_REVIEW_COLUMNS = [
  'id',
  'club_id',
  'user_id',
  'created_at',
  'review_title',
  'review_text',
  'review_images',
  'review_tags',
  'upvotes',
  'club_hours',
  'club_leadership',
  'club_fun',
  'club_community',
  'club_growth_index',
  'is_hidden',
].join(', ');
