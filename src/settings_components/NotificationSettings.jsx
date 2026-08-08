import React, { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { Skeleton, SkeletonRegion } from '../components/Skeleton'

// Per-channel master toggles. The backend stores these as `type = '*'` wildcard rows so
// they cover notification types added later — a row per known type would silently miss
// those and default them back on.
//
// 'push' is deliberately absent: that channel is a stub returning
// 'skipped:not-implemented', so offering a toggle would be a lie.
const CHANNELS = [
    { key: 'in_app', label: 'In-app', hint: 'The bell in the corner.' },
    { key: 'email', label: 'Email', hint: 'Sent to your account email.' },
]

export const NotificationSettings = () => {
    const [prefs, setPrefs] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        let cancelled = false

        apiFetch('/me/notification-preferences')
            .then((data) => { if (!cancelled) setPrefs(data) })
            .catch((err) => {
                if (cancelled) return
                console.error('Error loading notification preferences:', err)
                setError('Could not load your notification settings.')
            })
            .finally(() => { if (!cancelled) setLoading(false) })

        return () => { cancelled = true }
    }, [])

    const toggle = async (channel) => {
        const next = !prefs?.[channel]
        const previous = prefs

        setPrefs((p) => ({ ...p, [channel]: next }))
        setSaving(true)
        setError(null)

        try {
            await apiFetch('/me/notification-preferences', {
                method: 'PUT',
                body: { [channel]: next },
            })
        } catch (err) {
            console.error('Error saving notification preference:', err)
            setPrefs(previous)
            setError(err?.status === 429 ? err.message : 'Could not save that. Try again.')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <SkeletonRegion className="settings-section" label="Loading notification settings">
                <h2 className="profile-divider-header">Notifications</h2>
                <div className="settings-toggle-group">
                    <Skeleton width="260px" height="1.1rem" />
                    <Skeleton width="260px" height="1.1rem" />
                </div>
            </SkeletonRegion>
        )
    }

    return (
        <section className="settings-section">
            <h2 className="profile-divider-header">Notifications</h2>

            {prefs ? (
                <div className="settings-toggle-group">
                    {CHANNELS.map(({ key, label, hint }) => (
                        <label key={key} className="settings-toggle">
                            <input
                                type="checkbox"
                                checked={!!prefs[key]}
                                onChange={() => toggle(key)}
                                disabled={saving}
                            />
                            <span className="settings-toggle-label">{label}</span>
                            <span className="settings-hint">{hint}</span>
                        </label>
                    ))}
                </div>
            ) : (
                <p className="settings-status">Notification settings are unavailable.</p>
            )}

            {error && <p className="settings-error">{error}</p>}
        </section>
    )
}

export default NotificationSettings
