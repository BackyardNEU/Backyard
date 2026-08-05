export const USERNAME_REASON = 'Username must be 3-30 alphanumeric or underscore characters';

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

export function validateUsername(input) {
    const normalized = String(input ?? '').trim();
    const valid =
        normalized.length >= 3 &&
        normalized.length <= 30 &&
        USERNAME_RE.test(normalized);
    return valid ? { valid: true, normalized } : { valid: false, normalized, reason: USERNAME_REASON };
}
