// Default modules template — written to a club the first time they open edit mode.
// Content is a worked example (a fictional trip) rather than empty placeholders, so a
// new editor sees what a finished page can look like and edits down from it.
// basic_info gets the club's real name/logo/description substituted in before writing.
//
// Lives in shared/ because three places need the same copy: POST /page/init, the
// onboarding wizard's "start me a page", and the approve fan-out.

// Every club seeded from this template points at these same objects — the template
// stores URLs, so storage holds one copy no matter how many clubs are seeded.
//
// They live in `demo_assets` rather than the uploader's own folder for a reason. Uploads
// are namespaced per user (`${user.id}/…`, server/routes/storage.js), and review_images
// is in USER_OWNED_BUCKETS (server/routes/account.js), whose entire folder is removed
// when that account is deleted — which would have 404'd this media on every club page
// ever seeded, retroactively and silently.
//
// demo_assets is deliberately absent from every bucket allowlist in the app:
//   USER_OWNED_BUCKETS  server/routes/account.js      (account deletion)
//   USER_BUCKETS        server/routes/storage.js      (parseStorageUrl → verify/delete)
//   SAFE_BUCKETS        server/lib/imageModerator.js  (moderation delete)
// That omission is the protection. Adding demo_assets to any of them looks like tidying
// up a missed bucket and would quietly re-expose these files to deletion.
const DEMO = 'https://xknutqnmuvihsrxyaguy.supabase.co/storage/v1/object/public/demo_assets';

export const DEFAULT_MODULES = [
  {
    type: 'basic_info',
    order: 0,
    isDisplayed: true,
    data: {
      // These three are overwritten per club from demo_club_data (see clubPage.js), so
      // they are only ever the fallback for a club missing that field — which is why
      // they stay generic prompts rather than the example club's real copy.
      logo_url: '',
      club_name: 'Your Club Name',
      description: 'Tell people what your club is about. What do you do, who is it for, and what makes it worth joining?',
      links: [
        { id: 'link_1789016122464', url: 'https://www.instagram.com/', name: 'Instagram', enabled: true },
        { id: 'link_1789016138699', url: 'https://www.tiktok.com/', name: 'Tiktok', enabled: true },
        { id: 'link_1789016159201', url: 'https://slack.com/', name: 'Slack', enabled: true },
        { id: 'link_1789016161154', url: 'mailto:example@gmail.com', name: 'Mail', enabled: true },
        { id: 'link_1789016165095', url: 'https://spotify.app.link/VI4EWMC9xXb?_p=c11132dc9b017af1e11890f9e9', name: 'Spotify', enabled: true },
        { id: 'link_1789016277347', url: 'https://linktr.ee/', name: 'Linktree', enabled: true },
        { id: 'link_1789016461995', url: 'https://www.youtube.com/', name: 'YouTube', enabled: true },
        { id: 'link_1789016530969', url: 'https://discord.com/', name: 'Discord', enabled: true },
        { id: 'link_1789016581178', url: 'https://www.linkedin.com/', name: 'linkedin', enabled: true },
      ],
    },
  },
  {
    type: 'links',
    order: 1,
    isDisplayed: true,
    // No independent data of its own — reads/writes basic_info.data.links.
    // This entry only exists so Links gets its own accordion slot (title, help text, visibility checkbox).
    data: {},
  },
  {
    type: 'club_media',
    order: 2,
    isDisplayed: true,
    data: {
      posters: [
        {
          order: 0,
          content: [
            { type: 'title', value: 'Day 1' },
            { type: 'text', value: 'We took a trip on a boat, went to a cool kayaking spot.' },
            { type: 'uploaded_video', url: `${DEMO}/videos/day1-clip-1.mov`, width: '50' },
            { type: 'uploaded_video', url: `${DEMO}/videos/day1-clip-2.mov`, width: '100' },
            { type: 'uploaded_video', url: `${DEMO}/videos/day1-clip-3.mov`, width: '70' },
            { type: 'title', value: 'Day 2' },
            { type: 'text', value: 'We took a ride around Hanoi!' },
            { type: 'uploaded_video', url: `${DEMO}/videos/day2-clip-1.mov`, width: '100' },
            { type: 'media', items: [{ url: `${DEMO}/photos/day1-photo-1.jpg`, kind: 'image' }] },
            { type: 'media', items: [{ url: `${DEMO}/photos/day1-photo-2.jpg`, kind: 'image' }] },
          ],
          blob_aspect: '4 / 3',
          poster_text: 'Demo (Click)',
          poster_color: '#ffffff',
          blob_image_url: `${DEMO}/posters/demo.jpg`,
          poster_text_color: '#654321',
        },
        {
          order: 1,
          content: [],
          blob_aspect: '1 / 1',
          poster_text: 'Retreat',
          poster_color: '#6d221d',
          blob_image_url: `${DEMO}/posters/retreat.png`,
          poster_text_color: '#d9d9d9',
        },
        {
          order: 2,
          content: [],
          blob_aspect: '2 / 3',
          poster_text: 'The Peak',
          poster_color: '#29371a',
          blob_image_url: `${DEMO}/posters/the-peak.jpeg`,
          poster_text_color: '#b0cf6e',
        },
        {
          order: 3,
          content: [],
          blob_aspect: '1 / 1',
          poster_text: 'the appalachian trails',
          poster_color: '#d3b361',
          blob_image_url: `${DEMO}/posters/appalachian-trails.png`,
          poster_text_color: '#94431e',
        },
      ],
    },
  },
  {
    type: 'join',
    order: 3,
    isDisplayed: true,
    data: {
      tabs: [
        { title: 'Applying', body: 'Describe your rush, application, or tryout process here.' },
        { title: 'What We Look For', body: 'Share what qualities, skills, or experience you value in new members.' },
        { title: 'Tips', body: 'Any advice for people considering applying? What helps someone stand out?' },
      ],
      contactLink: 'example@gmail.com',
      applicationLink: 'https://exampleapplicationlink.com/',
    },
  },
  {
    type: 'faqs',
    order: 4,
    isDisplayed: true,
    data: {
      faqs: [
        { q: 'Do first-years usually get in?', a: 'Answer here.' },
        { q: "What's the time commitment?", a: 'Answer here.' },
        { q: 'Do I need prior experience?', a: 'Answer here.' },
      ],
    },
  },
  {
    type: 'stats',
    order: 5,
    isDisplayed: true,
    data: {
      stats: [
        { type: 'quantitative', label: 'Time commitment', unit1: 'hrs/wk', unit2: 'week', value: 5 },
        { type: 'quantitative', label: 'Members', unit1: 'people', unit2: '', value: 30 },
        { max: 100, type: 'qualitative', label: 'AVG GPA', value: 85 },
        { max: 50, type: 'qualitative', label: 'States Represented', value: 26 },
        { max: 20, type: 'qualitative', label: 'NCAA CHAMPS', value: 3 },
      ],
    },
  },
  {
    type: 'member_roster',
    order: 6,
    isDisplayed: true,
    data: {
      members: [
        {
          name: 'Rac',
          bio: '<p>The mayor of the Backyard</p>',
          photo: `${DEMO}/members/rac.png`,
          user_id: null,
          category: 'Students',
        },
        {
          name: 'Hoosky',
          bio: 'Our beloved NEU mascot',
          photo: `${DEMO}/members/hoosky.jpg`,
          user_id: null,
          category: 'Students',
        },
        {
          name: 'Duo',
          bio: "Monsieur Duo doesn't believe in traditional classrooms or standard office hours. Instead, he pops out of gym lockers, sits behind you on the subway, or peers through your kitchen window at 11:30 PM",
          photo: `${DEMO}/members/duo.jpeg`,
          user_id: null,
          category: 'Teachers',
        },
      ],
      categories: ['Leadership', 'General', 'Athletes', 'Coaches', 'Teacher', 'Students', 'Teachers'],
    },
  },
  {
    type: 'calendar',
    order: 7,
    isDisplayed: true,
    data: {},
  },
  {
    type: 'comments',
    order: 8,
    isDisplayed: true,
    data: {},
  },
];
