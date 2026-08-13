import { validateModules } from './clubPageValidation.js';

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

    return problems;
}
