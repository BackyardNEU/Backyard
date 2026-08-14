import { validateModules } from './clubPageValidation.js';
import { validateEvents } from './clubEventsValidation.js';
import { validateInterests } from './clubInterestsValidation.js';

// Shared so the Review step and POST /onboarding/submit cannot disagree. Telling someone
// their page is ready and then rejecting the submit is the worst possible last screen.

/**
 * @param {{ modules?: unknown[], details?: object }} draft
 * @returns {string[]} human-readable problems; empty means ready to submit
 */
export function checkDraftReady(draft) {
    const problems = [];
    const modules = draft?.modules;

    if (!Array.isArray(modules) || modules.length === 0) {
        return ['Fill in the basics before sending your page.'];
    }

    const basic = modules.find((m) => m?.type === 'basic_info')?.data;
    if (!basic?.club_name?.trim()) problems.push('Your club needs a name.');
    if (!basic?.description?.trim()) problems.push('Your club needs a description.');

    const structure = validateModules(modules);
    for (const e of structure.errors) {
        if (!problems.includes(e.message)) problems.push(e.message);
    }

    const interestCheck = validateInterests(draft?.interests);
    for (const message of interestCheck.errors) {
        if (!problems.includes(message)) problems.push(message);
    }

    // Events are optional, so an empty list is fine. A half-filled one is not: it would
    // pass the draft's lenient check and then fail when approve tries to create rows.
    const eventCheck = validateEvents(draft?.events);
    for (const e of eventCheck.errors) {
        if (!problems.includes(e.message)) problems.push(e.message);
    }

    return problems;
}
