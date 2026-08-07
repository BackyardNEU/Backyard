import React, { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '../lib/api'
import { useClubData } from '../context/useClubData'

// The management screen GET /api/me/blocks was built for. Until now that route and its
// DELETE counterpart had no frontend callers at all — blocking was one-way with no way
// to see or undo it.
export const BlockedUsersSettings = () => {
    const [blocked, setBlocked] = useState([])
    const [loading, setLoading] = useState(true)
    const [unblockingId, setUnblockingId] = useState(null)
    const [error, setError] = useState(null)
    const { refetch } = useClubData()

    const load = useCallback(async () => {
        try {
            const data = await apiFetch('/me/blocks')
            setBlocked(data || [])
        } catch (err) {
            console.error('Error loading blocked users:', err)
            setError('Could not load your blocked users.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const unblock = async (user) => {
        setUnblockingId(user.id)
        setError(null)

        try {
            await apiFetch(`/me/blocks/${user.id}`, { method: 'DELETE' })
            setBlocked((prev) => prev.filter((b) => b.id !== user.id))
            // They become visible again across the app, so drop the cached friend and
            // membership maps that were built while they were hidden.
            await refetch?.()
        } catch (err) {
            console.error('Error unblocking user:', err)
            setError(err?.status === 429 ? err.message : 'Could not unblock. Try again.')
        } finally {
            setUnblockingId(null)
        }
    }

    return (
        <section className="settings-section">
            <h2 className="profile-divider-header">Blocked users</h2>

            {loading && <p className="settings-status">Loading…</p>}

            {!loading && blocked.length === 0 && (
                <p className="settings-status">You haven&apos;t blocked anyone.</p>
            )}

            {blocked.length > 0 && (
                <>
                    <p className="settings-hint">
                        You and these people can&apos;t see each other&apos;s profiles, events or
                        friends. Unblocking restores that — it does not make you friends again.
                    </p>
                    <ul className="settings-blocked-list">
                        {blocked.map((user) => (
                            <li key={user.id} className="settings-blocked-item">
                                <img
                                    className="settings-blocked-avatar"
                                    src={user.avatar_url || '/raccoon_pfp.png'}
                                    alt=""
                                />
                                <span className="settings-blocked-name">{user.username}</span>
                                <button
                                    type="button"
                                    className="settings-unblock"
                                    onClick={() => unblock(user)}
                                    disabled={unblockingId === user.id}
                                >
                                    {unblockingId === user.id ? 'Unblocking…' : 'Unblock'}
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            {error && <p className="settings-error">{error}</p>}
        </section>
    )
}

export default BlockedUsersSettings
