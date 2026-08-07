import React, { useState } from 'react'
import { useProfileForm } from '../profile_components/useProfileForm'
import { ProfileFields } from '../profile_components/ProfileFields'

// Edit your profile without going through onboarding. Same fields, same uploads, same
// moderation — useProfileForm carries all of it.
export const ProfileSettings = () => {
    const form = useProfileForm()
    const [saved, setSaved] = useState(false)

    const handleSubmit = async (event) => {
        event.preventDefault()
        setSaved(false)
        // No `school` here: changing it after joining clubs would strand those
        // memberships against the "members can only join clubs at their own school" RLS
        // policy. Shown read-only below.
        const ok = await form.save()
        if (ok) setSaved(true)
    }

    if (form.loading) {
        return (
            <section className="settings-section">
                <h2 className="profile-divider-header">Profile</h2>
                <p className="settings-status">Loading…</p>
            </section>
        )
    }

    return (
        <section className="settings-section">
            <h2 className="profile-divider-header">Profile</h2>

            <form onSubmit={handleSubmit} className="settings-form">
                <ProfileFields form={form} idPrefix="settings" />

                <label className="setup-field-label">school</label>
                <div className="setup-school-wrap">
                    <input
                        className="setup-school-input"
                        value={form.school || 'Northeastern'}
                        disabled
                    />
                </div>
                <p className="settings-hint">
                    Contact support to change your school — it affects which clubs you can join.
                </p>

                <div className="settings-actions">
                    <button type="submit" className="settings-save" disabled={form.submitting}>
                        {form.submitting ? 'Saving…' : 'Save profile'}
                    </button>
                    {saved && <span className="settings-saved">Saved</span>}
                </div>

                {form.error && <p className="settings-error">{form.error}</p>}
            </form>
        </section>
    )
}

export default ProfileSettings
