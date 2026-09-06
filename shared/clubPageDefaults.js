// Default modules template — written to a club the first time they open edit mode.
// All content is generic placeholder text meant to guide what to fill in.
// basic_info gets the club's real name/logo/description substituted in before writing.
//
// Lives in shared/ because three places need the same copy: POST /page/init, the
// onboarding wizard's "start me a page", and the approve fan-out.

export const DEFAULT_MODULES = [
  {
    type: 'basic_info',
    order: 0,
    isDisplayed: true,
    data: {
      logo_url: '',
      club_name: 'Your Club Name',
      description: 'Tell people what your club is about. What do you do, who is it for, and what makes it worth joining?',
      links: [],
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
            { type: 'title', value: 'Example Event' },
            { type: 'text', value: 'Add a short description of this event or moment.' },
          ],
          blob_aspect: '3 / 4',
          poster_text: 'Example Poster',
          poster_color: '#f8fafc',
          blob_image_url: '',
          poster_text_color: '#2b3440',
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
        { title: 'How to Join', body: 'Describe your rush, application, or tryout process here.' },
        { title: 'What We Look For', body: 'Share what qualities, skills, or experience you value in new members.' },
        { title: 'Tips', body: 'Any advice for people considering applying? What helps someone stand out?' },
      ],
      contactLink: '',
      applicationLink: '',
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
        { type: 'quantitative', label: 'Time commitment', unit1: 'hrs', unit2: 'week', value: 5 },
        { type: 'quantitative', label: 'Members', unit1: 'people', unit2: '', value: 30 },
        { max: 10, type: 'qualitative', label: 'Competitiveness', value: 6 },
        { max: 10, type: 'qualitative', label: 'Social vibe', value: 8 },
      ],
    },
  },
  {
    type: 'member_roster',
    order: 6,
    isDisplayed: true,
    data: {
      members: [
        { name: 'Member Name', bio: '<p>Add a short bio here.</p>', photo: '', user_id: null, category: 'Leadership' },
        { name: 'Member Name', bio: '', photo: '', user_id: null, category: 'General' },
      ],
      categories: ['Leadership', 'General'],
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
