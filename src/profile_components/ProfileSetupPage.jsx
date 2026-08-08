import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfileForm } from './useProfileForm'
import { ProfileFields } from './ProfileFields'
import { Skeleton, SkeletonCircle, SkeletonRegion } from '../components/Skeleton'
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
        return (
            <div className='profile-setup-page'>
                <div className="uni-background-layer" />
                <SkeletonRegion className="profile-setup-card" label="Loading profile setup">
                    <Skeleton width="70%" height="2.4rem" style={{ margin: '0 auto 20px' }} />
                    <Skeleton width="60px" height="0.8rem" />
                    <Skeleton height="2.4rem" radius={4} style={{ marginBottom: 14 }} />
                    <Skeleton width="90px" height="0.8rem" />
                    <Skeleton height="2.4rem" radius={4} style={{ marginBottom: 14 }} />
                    <SkeletonCircle size={110} />
                    <Skeleton width="120px" height="0.8rem" style={{ marginTop: 14 }} />
                    <Skeleton height="7rem" radius={4} />
                </SkeletonRegion>
            </div>
        )
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
