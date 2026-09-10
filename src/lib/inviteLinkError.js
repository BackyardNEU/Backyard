/**
 * Turn a failed invite-link lookup into something true.
 *
 * Both invite screens used to collapse every failure into one message. ClaimGate's read
 * "It may have expired or been replaced", which is fine for a 410 and actively wrong for
 * everything else — a club whose onboarding origin was missing from the CORS allowlist
 * was told their link had expired, and came back asking for a new one that would have
 * failed identically. The link was valid for another month.
 *
 * The distinction that matters: a 404 or 410 is a verdict about the link, and no amount
 * of retrying the same URL changes it. Anything else — no status at all (CORS, DNS,
 * offline), a 5xx, a 429 — is a statement about the request, and says nothing about
 * whether the link is good.
 *
 * @param {{ status?: number } | Error | null | undefined} err
 * @returns {{ title: string, body: string, retryable: boolean }}
 */
export function describeInviteError(err) {
    const status = err?.status;

    if (status === 404) {
        return {
            title: 'We don’t recognise this link',
            body: 'Double-check it copied across in full — these links are long and email '
                + 'programs sometimes split them over two lines. If it still doesn’t work, '
                + 'ask whoever sent it to share it again.',
            retryable: false,
        };
    }

    if (status === 410) {
        return {
            title: 'This link is no longer valid',
            body: 'It has expired or been replaced. Ask for a fresh one and it will work '
                + 'straight away.',
            retryable: false,
        };
    }

    if (status === 429) {
        return {
            title: 'Too many attempts',
            body: 'Give it a moment and try again.',
            retryable: true,
        };
    }

    // No status means fetch never got an HTTP answer at all. Everything else here is a
    // server fault. Either way the link is very likely fine, so do not send them away.
    return {
        title: 'We couldn’t check this link',
        body: 'Something went wrong on our side, so we can’t tell whether this link is '
            + 'good yet. Your link is probably fine — try again in a moment.',
        retryable: true,
    };
}
