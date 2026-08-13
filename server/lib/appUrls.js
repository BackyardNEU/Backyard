import 'dotenv/config';

// FRONTEND_URL is a comma-separated CORS allowlist. It is NOT a link base — but
// invites.js used it as one (`${process.env.FRONTEND_URL}/join/${token}`), which was
// harmless only while the allowlist held exactly one origin. Adding a second origin,
// which deploying the club onboarding wizard requires, would have turned every
// generated invite link into "https://a.com,https://b.com/join/<token>".
//
// This module keeps the two concerns apart: ALLOWED_ORIGINS is a list for CORS,
// PUBLIC_APP_URL and ONBOARD_URL are single origins for building links.

const DEV_ORIGIN = 'http://localhost:5173';

function normalizeSingleOrigin(value, varName) {
    // A comma here means someone pasted the CORS allowlist into a link base. Catching
    // it at boot beats minting 150 broken links into a CSV that then gets pasted into
    // 150 outreach messages.
    if (value.includes(',')) {
        throw new Error(
            `${varName} must be a single origin, but contains a comma: "${value}". ` +
            'FRONTEND_URL is the comma-separated allowlist; this one is a link base.'
        );
    }

    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        throw new Error(`${varName} is not a valid URL: "${value}"`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`${varName} must use http or https, got "${parsed.protocol}"`);
    }

    // Strip trailing slashes so `${base}/join/x` can never produce a double slash.
    return value.replace(/\/+$/, '');
}

/**
 * Pure so it can be tested without mutating process.env.
 * @param {Record<string, string|undefined>} env
 * @returns {{ allowedOrigins: string[], publicAppUrl: string, onboardUrl: string }}
 */
export function parseAppUrls(env) {
    const allowedOrigins = (env.FRONTEND_URL || DEV_ORIGIN)
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

    // Falls back to the FIRST allowed origin, never the raw allowlist string.
    const publicAppUrl = normalizeSingleOrigin(
        env.PUBLIC_APP_URL || allowedOrigins[0] || DEV_ORIGIN,
        'PUBLIC_APP_URL'
    );

    // Before the wizard has its own domain, onboarding links still resolve on the app.
    const onboardUrl = env.ONBOARD_URL
        ? normalizeSingleOrigin(env.ONBOARD_URL, 'ONBOARD_URL')
        : publicAppUrl;

    return { allowedOrigins, publicAppUrl, onboardUrl };
}

// encodeURIComponent so a token can never inject extra path segments.
export function buildInviteUrl(base, token) {
    return `${base}/join/${encodeURIComponent(token)}`;
}

export function buildOnboardingUrl(base, token) {
    return `${base}/claim/${encodeURIComponent(token)}`;
}

const urls = parseAppUrls(process.env);

export const ALLOWED_ORIGINS = urls.allowedOrigins;
export const PUBLIC_APP_URL = urls.publicAppUrl;
export const ONBOARD_URL = urls.onboardUrl;

export const inviteUrl = (token) => buildInviteUrl(PUBLIC_APP_URL, token);
export const onboardingUrl = (token) => buildOnboardingUrl(ONBOARD_URL, token);
