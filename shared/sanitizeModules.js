import { sanitizeBioHtml } from './sanitizeHtml.js';

// Two fields in the modules blob hold rich text that gets rendered with
// dangerouslySetInnerHTML: join tab bodies (JoinModule.jsx) and member bios
// (ClubMemberScroll.jsx). Everything else is rendered as plain text by React, which
// escapes it, so only these two need sanitizing.
//
// Every write path to club_page_data.modules runs this: PUT /clubs/:clubId/page, the
// onboarding draft save, and the approve fan-out. Sanitizing on write is the layer a
// direct API call cannot skip; the components sanitize again at render so that rows
// stored before this existed are also safe.

/**
 * Returns a copy of the modules array with rich-text fields sanitized.
 * Does not mutate the input.
 */
export function sanitizeModules(modules) {
    if (!Array.isArray(modules)) return modules;

    return modules.map((m) => {
        if (m?.type === 'join' && Array.isArray(m.data?.tabs)) {
            return {
                ...m,
                data: {
                    ...m.data,
                    tabs: m.data.tabs.map((t) => ({ ...t, body: sanitizeBioHtml(t?.body) })),
                },
            };
        }

        if (m?.type === 'member_roster' && Array.isArray(m.data?.members)) {
            return {
                ...m,
                data: {
                    ...m.data,
                    members: m.data.members.map((mem) => ({
                        ...mem,
                        bio: sanitizeBioHtml(mem?.bio),
                    })),
                },
            };
        }

        return m;
    });
}

export default sanitizeModules;
