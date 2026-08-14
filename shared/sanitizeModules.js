import { sanitizeBioHtml } from './sanitizeHtml.js';
import { normalizeUrl } from './clubPageValidation.js';

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
        // Links are stored with the scheme the club left off, so what lands in the row is
        // something an href can use. Without this "instagram.com/ourclub" would be saved
        // verbatim and resolve as a path on our own domain when clicked.
        if (m?.type === 'basic_info' && Array.isArray(m.data?.links)) {
            return {
                ...m,
                data: {
                    ...m.data,
                    links: m.data.links.map((l) => {
                        const normalized = normalizeUrl(l?.url);
                        // null means it could not be a URL at all; leave it for the
                        // validator to reject rather than silently discarding it.
                        return normalized ? { ...l, url: normalized } : l;
                    }),
                },
            };
        }

        if (m?.type === 'join' && Array.isArray(m.data?.tabs)) {
            const applicationLink = normalizeUrl(m.data.applicationLink);
            return {
                ...m,
                data: {
                    ...m.data,
                    ...(applicationLink ? { applicationLink } : {}),
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
