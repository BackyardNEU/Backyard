import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGlobalStore } from '../lib/store'
import { ProfileSettings } from './ProfileSettings'
import { CalendarSettings } from './CalendarSettings'
import { NotificationSettings } from './NotificationSettings'
import { BlockedUsersSettings } from './BlockedUsersSettings'
import { AccountSettings } from './AccountSettings'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Skeleton, SkeletonRegion } from '../components/Skeleton'
import '../profile_components/ProfilePage.css'
import '../profile_components/ProfileSetupPage.css'
import './SettingsPage.css'

// Settings. Each section owns its own fetch and save state so one failing section does
// not take the page down with it.
//
// Visual design is intentionally minimal here — structure and behaviour only.
export const SettingsPage = () => {
    const navigate = useNavigate()
    const lastPath = useGlobalStore((state) => state.lastPath)
    const [status, setStatus] = useState('loading')
    useDocumentTitle('Backyard | Settings')

    // Auth guard modelled on FriendProfile: a cancelled flag so a resolved promise cannot
    // set state after unmount, and a hard redirect rather than silently rendering nothing.
    useEffect(() => {
        let cancelled = false

        async function check() {
            const { data, error } = await supabase.auth.getUser()
            if (cancelled) return
            if (error || !data?.user) {
                navigate('/', { replace: true })
                return
            }
            setStatus('ready')
        }

        check()
        return () => { cancelled = true }
    }, [navigate])

    const handleClose = () => {
        const target = lastPath && lastPath !== window.location.pathname ? lastPath : '/profile'
        navigate(target)
    }

    if (status === 'loading') {
        return (
            <SkeletonRegion className="ProfilePage settings-page" label="Loading settings">
                <div className="profile-header">
                    <div className="profile-copy">
                        <Skeleton width="180px" height="2.2rem" />
                    </div>
                </div>
                <hr className="profile-divider" />
                {[0, 1, 2].map((i) => (
                    <div key={i} className="settings-section">
                        <Skeleton width="160px" height="1.2rem" />
                        <div className="settings-form">
                            <Skeleton height="2.4rem" radius={4} />
                            <Skeleton width="70%" height="2.4rem" radius={4} />
                        </div>
                    </div>
                ))}
            </SkeletonRegion>
        )
    }

    return (
        <div className="ProfilePage settings-page">
            <div className="profile-header">
                <div className="profile-copy">
                    <h1 className="ProfileName">Settings</h1>
                </div>
                <button
                    className="profile-close-btn"
                    onClick={handleClose}
                    aria-label="Close settings"
                >
                    ×
                </button>
            </div>
            <hr className="profile-divider" />

            <ProfileSettings />
            <CalendarSettings />
            <NotificationSettings />
            <BlockedUsersSettings />
            <AccountSettings />
        </div>
    )
}

export default SettingsPage
