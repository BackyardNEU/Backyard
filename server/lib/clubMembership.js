import { supabaseAdmin } from '../supabaseAdmin.js';

// One place that keeps club_memberships and profiles.member_list in step.
//
// This was previously admitMember() inside clubMembers.js, which hardcoded
// `const role = 'member'` and early-returned any existing role. That made two things
// impossible: granting a club role through an invite link (the onboarding wizard's
// whole premise), and the behaviour the join route's own comment describes — "the
// first person in always joins outright and becomes the owner". The latter had a
// test asserting it that had been failing on main.

export const ROLE_RANK = { member: 1, moderator: 2, top_moderator: 3 };

function assertRole(role) {
    if (!Object.hasOwn(ROLE_RANK, role)) {
        throw new Error(`Unknown club role: ${role}`);
    }
}

async function addToMemberList(userId, clubId) {
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('member_list')
        .eq('id', userId)
        .single();

    const currentList = profile?.member_list || [];
    if (currentList.includes(clubId)) return;

    await supabaseAdmin
        .from('profiles')
        .update({ member_list: [...currentList, clubId] })
        .eq('id', userId);
}

/**
 * Grant a club role, raising an existing one but never lowering it.
 *
 * The raise-only rule is load-bearing: an invite link that could lower a role would be
 * a demotion primitive, letting anyone hand a club owner an "editor" link and quietly
 * drop them to moderator.
 *
 * @returns {Promise<{ role: string, changed: boolean }>}
 */
export async function grantClubRole(userId, clubId, role) {
    assertRole(role);

    const { data: existing } = await supabaseAdmin
        .from('club_memberships')
        .select('role')
        .eq('user_id', userId)
        .eq('club_id', clubId)
        .maybeSingle();

    if (existing) {
        if (ROLE_RANK[existing.role] >= ROLE_RANK[role]) {
            return { role: existing.role, changed: false };
        }

        const { error } = await supabaseAdmin
            .from('club_memberships')
            .update({ role })
            .eq('user_id', userId)
            .eq('club_id', clubId);

        if (error) {
            const err = new Error(error.message);
            err.status = 502;
            throw err;
        }

        await addToMemberList(userId, clubId);
        return { role, changed: true };
    }

    const { error: insertError } = await supabaseAdmin
        .from('club_memberships')
        .insert({ user_id: userId, club_id: clubId, role });

    // 23505 = unique_violation. Two redeems racing each other must not surface a 502
    // to someone who is, in fact, now a member.
    if (insertError && insertError.code !== '23505') {
        const err = new Error(insertError.message);
        err.status = 502;
        throw err;
    }

    await addToMemberList(userId, clubId);
    return { role, changed: true };
}

/**
 * Whether the club already has an owner. Used to decide whether a redeemer becomes
 * top_moderator or moderator — an invite must never displace an existing owner.
 */
export async function hasTopModerator(clubId) {
    const { data } = await supabaseAdmin
        .from('club_memberships')
        .select('user_id')
        .eq('club_id', clubId)
        .eq('role', 'top_moderator')
        .maybeSingle();

    return !!data;
}

/**
 * Back-compat wrapper for the existing join/approve paths, which admit plain members.
 * Idempotent on purpose: someone can be admitted twice by two different routes — request
 * to join, get added through an invite link while still queued, then have the original
 * request approved.
 */
export async function admitMember(userId, clubId) {
    const { role } = await grantClubRole(userId, clubId, 'member');
    return role;
}
