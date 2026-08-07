import React, { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

// Which format the single "Add to calendar" button uses.
//
// 'ics' is the default because a downloaded .ics imports into Apple Calendar, Outlook,
// Fantastical and Google alike, so an unset preference still works everywhere. The old UI
// labelled it "Apple Cal", which was a mislabel — the format is not Apple-specific.
const OPTIONS = [
    { value: 'ics', label: 'Download a file (.ics)', hint: 'Works with Apple Calendar, Outlook, Fantastical and most others.' },
    { value: 'google', label: 'Google Calendar', hint: 'Opens Google Calendar with the event pre-filled.' },
]

export const CalendarSettings = () => {
    const [preference, setPreference] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        let cancelled = false

        apiFetch('/me/profile')
            .then((profile) => {
                if (cancelled) return
                setPreference(profile?.calendar_preference || 'ics')
            })
            .catch((err) => {
                if (cancelled) return
                console.error('Error loading calendar preference:', err)
                setError('Could not load your calendar preference.')
            })
            .finally(() => { if (!cancelled) setLoading(false) })

        return () => { cancelled = true }
    }, [])

    const choose = async (value) => {
        if (value === preference) return

        const previous = preference
        setPreference(value) // optimistic — this is a single radio, reverting is cheap
        setSaving(true)
        setError(null)

        try {
            await apiFetch('/me/profile', {
                method: 'PUT',
                body: { calendar_preference: value },
            })
        } catch (err) {
            console.error('Error saving calendar preference:', err)
            setPreference(previous)
            setError(err?.status === 429 ? err.message : 'Could not save that. Try again.')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <section className="settings-section">
                <h2 className="profile-divider-header">Calendar</h2>
                <p className="settings-status">Loading…</p>
            </section>
        )
    }

    return (
        <section className="settings-section">
            <h2 className="profile-divider-header">Calendar</h2>
            <p className="settings-hint">
                What the &ldquo;Add to calendar&rdquo; button on an event should do.
            </p>

            <div className="settings-radio-group" role="radiogroup" aria-label="Calendar format">
                {OPTIONS.map((option) => (
                    <label key={option.value} className="settings-radio">
                        <input
                            type="radio"
                            name="calendar_preference"
                            value={option.value}
                            checked={preference === option.value}
                            onChange={() => choose(option.value)}
                            disabled={saving}
                        />
                        <span className="settings-radio-label">{option.label}</span>
                        <span className="settings-hint">{option.hint}</span>
                    </label>
                ))}
            </div>

            {error && <p className="settings-error">{error}</p>}
        </section>
    )
}

export default CalendarSettings
