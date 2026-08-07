import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfileForm } from './useProfileForm'
import { ProfileFields } from './ProfileFields'
import './ProfileSetupPage.css'

// Onboarding. Shares its fields and save logic with the settings page via useProfileForm;
// what is specific to this page is the framing and where it goes afterwards.
const ProfileSetupPage = () => {
    const navigate = useNavigate()
    const form = useProfileForm()

    const handleSubmit = async (event) => {
        event.preventDefault()

        // School selection is disabled app-wide, so this is sent as a constant rather
        // than read from a picker. See the read-only field below.
        const saved = await form.save({ school: 'Northeastern' })
        if (!saved) return

        // Someone who arrived via an invite link finishes onboarding and lands back on
        // the invite rather than their profile.
        const pendingJoinToken = sessionStorage.getItem('pendingJoinToken')
        if (pendingJoinToken) {
            sessionStorage.removeItem('pendingJoinToken')
            navigate(`/join/${pendingJoinToken}`, { replace: true })
        } else {
            navigate('/profile', { replace: true })
        }
    }

    if (form.loading) {
        return <div className="profile-setup-page">Loading profile setup...</div>
    }

    return (
        <div className='profile-setup-page'>
            <div className="uni-background-layer" />
            <form className="profile-setup-card" onSubmit={handleSubmit}>
                <span className="setup-pin setup-pin-left" aria-hidden="true" />
                <span className="setup-pin setup-pin-right" aria-hidden="true" />
                <h1 className="setup-title">Finish Your Profile</h1>

                <ProfileFields form={form} idPrefix="setup" />

                {/* School selection disabled — defaulting to Northeastern */}
                <label className="setup-field-label">school</label>
                <div className="setup-school-wrap">
                    <input className="setup-school-input" value="Northeastern" disabled />
                </div>

                <button type="submit" className="setup-submit" disabled={form.submitting}>
                    {form.submitting ? 'saving...' : 'submit'}
                </button>

                {form.error && <p className="setup-error">{form.error}</p>}
            </form>
        </div>
    )
}

export { ProfileSetupPage }
export default ProfileSetupPage
