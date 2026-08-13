// Validation for the club_page_data.modules JSONB blob.
//
// These rules lived only in src/uni_components/ExpandedTile.jsx, which meant
// PUT /clubs/:clubId/page enforced none of them — it checked Array.isArray(modules),
// ran profanity checks, and stored whatever it was handed. Every length cap and URL
// check was bypassable by calling the API directly. Sharing them lets the server
// enforce exactly what the editor displays.
//
// The per-module validators are moved verbatim from ExpandedTile so behaviour is
// unchanged for existing editors; validateModules and LIMITS are new.

export const LIMITS = {
    CLUB_NAME_MAX: 80,
    LINK_NAME_MAX: 15,
    TAB_TITLE_MAX: 60,
    TAB_BODY_MAX: 500,
    FAQ_Q_MAX: 200,
    FAQ_A_MAX: 500,
    MEMBER_NAME_MAX: 50,
    MEMBER_BIO_MAX: 500,
    CATEGORY_NAME_MAX: 25,
    POSTER_TITLE_MAX: 100,
    CONTENT_TEXT_MAX: 500,
    MAX_MODULES: 16,
    MAX_POSTERS: 24,
    MAX_MEMBERS: 200,
    MAX_FAQS: 30,
    MAX_TABS: 10,
    // Comfortably under the global express.json({ limit: '100kb' }) so an oversized
    // payload produces a message someone can act on rather than an opaque 413.
    MAX_SERIALIZED_BYTES: 80_000,
};

export const KNOWN_MODULE_TYPES = new Set([
    'basic_info', 'links', 'club_media', 'join',
    'faqs', 'stats', 'member_roster', 'calendar', 'comments',
]);

export const isValidUrl = (url) => {
    try {
        const u = new URL(url);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
};

export function validateBasicInfo(data) {
    if (!data?.club_name?.trim()) return 'Club name cannot be empty.';
    if (data.club_name.trim().length > LIMITS.CLUB_NAME_MAX) return 'Club name must be 80 characters or fewer.';
    if (!data?.description?.trim()) return 'Description cannot be empty.';
    // logo_url was never checked, and PUT /page copies it into demo_club_data.image_url,
    // from which it is rendered as an <img src>. Restricting it to http(s) keeps
    // javascript: and data: URLs out of a column that is read back into markup.
    if (data.logo_url && !isValidUrl(data.logo_url)) return 'The logo address is not a valid link.';
    for (const l of (data?.links ?? [])) {
        if ((l.name ?? '').length > LIMITS.LINK_NAME_MAX) return 'Link names must be 15 characters or fewer.';
        if (l.url && !isValidUrl(l.url)) return 'One or more link URLs are invalid.';
    }
    return null;
}

export function validateLinks(basicInfoData) {
    for (const l of (basicInfoData?.links ?? [])) {
        if ((l.name ?? '').length > LIMITS.LINK_NAME_MAX) return 'Link names must be 15 characters or fewer.';
        if (l.url && !isValidUrl(l.url)) return 'One or more link URLs are invalid.';
    }
    return null;
}

export function validateJoin(data) {
    const tabs = data?.tabs ?? [];
    if (tabs.length > LIMITS.MAX_TABS) return 'Too many tabs.';
    for (const tab of tabs) {
        if (!tab.title?.trim()) return 'Each tab must have a title.';
        if (tab.title.trim().length > LIMITS.TAB_TITLE_MAX) return 'Tab titles must be 60 characters or fewer.';
        if (!tab.body?.trim()) return 'Each tab must have body text.';
        if (tab.body.trim().length > LIMITS.TAB_BODY_MAX) return 'Tab body must be 500 characters or fewer.';
    }
    return null;
}

export function validateStats(data) {
    const stats = data?.stats ?? [];
    for (const s of stats) {
        if (s.value < 0) return 'Stat values cannot be negative.';
        if (s.value % 1 !== 0) return 'Stat value must be a whole number.';
        if (s.type === 'quantitative') {
            if (!s.unit1?.trim()) return 'Each quantitative stat must have a unit.';
        }
        if (s.type === 'qualitative') {
            if (!s.label?.trim()) return 'Each qualitative stat must have a name.';
            const max = s.max ?? 10;
            if (max < 1) return 'Max must be at least 1.';
            if (s.value > max) return 'A stat value exceeds its max.';
            if (max % 1 !== 0) return 'Max must be a whole number.';
        }
    }
    return null;
}

export function validateFaq(data) {
    const faqs = data?.faqs ?? [];
    if (faqs.length > LIMITS.MAX_FAQS) return 'Too many FAQs.';
    for (const f of faqs) {
        if (!f.q?.trim()) return 'Each FAQ must have a question.';
        if (f.q.trim().length > LIMITS.FAQ_Q_MAX) return 'FAQ questions must be 200 characters or fewer.';
        if (f.a && f.a.length > LIMITS.FAQ_A_MAX) return 'FAQ answers must be 500 characters or fewer.';
    }
    return null;
}

export function validateMemberRoster(data) {
    const categories = data?.categories ?? [];
    const members = data?.members ?? [];
    if (members.length > LIMITS.MAX_MEMBERS) return 'Too many members.';
    for (const c of categories) {
        if (!c?.trim()) return 'Category names cannot be empty.';
        if (c.trim().length > LIMITS.CATEGORY_NAME_MAX) return 'Category names must be 25 characters or fewer.';
    }
    for (const m of members) {
        if (!m.name?.trim()) return 'Each member must have a name.';
        if (m.name.trim().length > LIMITS.MEMBER_NAME_MAX) return 'Member names must be 50 characters or fewer.';
        // Measured on text, not markup, so formatting tags do not eat the budget.
        const bioText = (m.bio || '').replace(/<[^>]*>/g, '');
        if (bioText.length > LIMITS.MEMBER_BIO_MAX) return 'Member bios must be 500 characters or fewer.';
    }
    return null;
}

export function validateComments() { return null; }
export function validateCalendar() { return null; }

export function validateClubMedia(data) {
    const posters = data?.posters ?? [];
    if (posters.length > LIMITS.MAX_POSTERS) return 'Too many posters.';
    const validWidths = new Set(['50', '70', '100']);
    for (const p of posters) {
        if (p.poster_text && p.poster_text.length > LIMITS.POSTER_TITLE_MAX) return 'Poster titles must be 100 characters or fewer.';
        for (const block of (p.content ?? [])) {
            if (block.type === 'title' && block.value && block.value.length > LIMITS.POSTER_TITLE_MAX) return 'Content headings must be 100 characters or fewer.';
            if (block.type === 'text' && block.value && block.value.length > LIMITS.CONTENT_TEXT_MAX) return 'Content text must be 500 characters or fewer.';
            if (block.type === 'uploaded_video' && block.width && !validWidths.has(String(block.width))) {
                return 'Video width must be 50%, 70%, or 100%.';
            }
        }
    }
    return null;
}

const VALIDATORS = {
    basic_info: validateBasicInfo,
    join: validateJoin,
    stats: validateStats,
    faqs: validateFaq,
    member_roster: validateMemberRoster,
    club_media: validateClubMedia,
    comments: validateComments,
    calendar: validateCalendar,
};

export function getModuleWarnings(draft) {
    const w = {};
    const basicInfo = draft.find((m) => m.type === 'basic_info');
    for (const m of draft) {
        if (m.type === 'links') { w.links = validateLinks(basicInfo?.data); continue; }
        const fn = VALIDATORS[m.type];
        if (fn) w[m.type] = fn(m.data);
    }
    return w;
}

/**
 * Server entry point. Returns every violation rather than the first, so a caller can
 * surface all the steps that need attention at once.
 *
 * @param {unknown} modules
 * @returns {{ valid: boolean, errors: Array<{ module: string, message: string }> }}
 */
export function validateModules(modules) {
    const errors = [];

    if (!Array.isArray(modules)) {
        return { valid: false, errors: [{ module: '_root', message: 'modules must be an array.' }] };
    }

    if (modules.length > LIMITS.MAX_MODULES) {
        errors.push({ module: '_root', message: `A page cannot have more than ${LIMITS.MAX_MODULES} modules.` });
    }

    let serialized = '';
    try {
        serialized = JSON.stringify(modules);
    } catch {
        return { valid: false, errors: [{ module: '_root', message: 'modules could not be serialized.' }] };
    }
    // Byte length, not character count — multi-byte content still counts against the cap.
    if (Buffer.byteLength(serialized, 'utf8') > LIMITS.MAX_SERIALIZED_BYTES) {
        errors.push({ module: '_root', message: 'Page content is too large.' });
    }

    const basicInfo = modules.find((m) => m?.type === 'basic_info');

    for (const m of modules) {
        const type = m?.type;
        if (!KNOWN_MODULE_TYPES.has(type)) {
            errors.push({ module: String(type), message: `Unknown module type: ${type}` });
            continue;
        }
        const message = type === 'links'
            ? validateLinks(basicInfo?.data)
            : VALIDATORS[type]?.(m.data) ?? null;
        if (message) errors.push({ module: type, message });
    }

    return { valid: errors.length === 0, errors };
}
