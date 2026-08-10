import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { useClubData } from '../context/useClubData'
import { Skeleton, SkeletonRegion } from '../components/Skeleton'

export const AccountSettings = () => {
    const navigate = useNavigate()
    // Shared profile — this was the third component on the page requesting /me/profile.
    const { profile, loading } = useClubData()

    // Password
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [pwStatus, setPwStatus] = useState('idle') // idle | saving | done
    const [pwError, setPwError] = useState(null)

    // Deletion
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const [confirmUsername, setConfirmUsername] = useState('')
    const [deleting, setDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState(null)

    const changePassword = async (event) => {
        event.preventDefault()
        setPwError(null)

        // Matches the rules ResetPasswordPage already enforces.
        if (password.length < 6) {
            setPwError('Password must be at least 6 characters.')
            return
        }
        if (password !== confirmPassword) {
            setPwError('Passwords do not match.')
            return
        }

        setPwStatus('saving')
        const { error } = await supabase.auth.updateUser({ password })

        if (error) {
            setPwError(error.message)
            setPwStatus('idle')
            return
        }

        setPassword('')
        setConfirmPassword('')
        setPwStatus('done')
    }

    const deleteAccount = async () => {
        setDeleting(true)
        setDeleteError(null)

        try {
            await apiFetch('/me/account', {
                method: 'DELETE',
                body: { confirmUsername },
            })
            // The auth user is gone; clear the local session so the app does not keep
            // presenting a signed-in shell backed by a dead token.
            await supabase.auth.signOut()
            navigate('/', { replace: true })
        } catch (err) {
            console.error('Error deleting account:', err)
            setDeleteError(err?.message || 'Could not delete your account. Please try again.')
            setDeleting(false)
        }
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        navigate('/', { replace: true })
    }

    const mutedUntil = profile?.muted_until ? new Date(profile.muted_until) : null
    const isMuted = mutedUntil && mutedUntil > new Date()

    if (loading) {
        return (
            <SkeletonRegion className="settings-section" label="Loading account settings">
                <h2 className="profile-divider-header">Account</h2>
                <div className="settings-readonly">
                    <Skeleton width="60px" height="0.8rem" />
                    <Skeleton width="220px" height="1rem" />
                </div>
                <div className="settings-form">
                    <Skeleton width="140px" height="0.8rem" />
                    <Skeleton height="2.4rem" radius={4} />
                    <Skeleton height="2.4rem" radius={4} />
                </div>
                <div className="settings-actions">
                    <Skeleton width="150px" height="2.2rem" radius={999} />
                </div>
            </SkeletonRegion>
        )
    }

    return (
        <section className="settings-section">
            <h2 className="profile-divider-header">Account</h2>

            <div className="settings-readonly">
                <span className="setup-field-label">email</span>
                <span className="settings-readonly-value">{profile?.email || '—'}</span>
            </div>

            {/* Being muted is otherwise only visible as an opaque 403 on every write. */}
            {isMuted && (
                <p className="settings-warning">
                    Your account is muted until {mutedUntil.toLocaleString()}. You can browse,
                    but you can&apos;t post reviews, events or questions until then.
                </p>
            )}

            <form className="settings-form" onSubmit={changePassword}>
                <label className="setup-field-label" htmlFor="settings-new-password">
                    change password
                </label>
                <input
                    id="settings-new-password"
                    className="setup-school-input"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPwStatus('idle') }}
                    placeholder="New password"
                />
                <input
                    className="setup-school-input"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                />

                <div className="settings-actions">
                    <button
                        type="submit"
                        className="settings-save"
                        disabled={pwStatus === 'saving' || !password}
                    >
                        {pwStatus === 'saving' ? 'Updating…' : 'Update password'}
                    </button>
                    {pwStatus === 'done' && <span className="settings-saved">Password updated</span>}
                </div>

                {pwError && <p className="settings-error">{pwError}</p>}
            </form>

            <div className="settings-actions">
                <button type="button" className="settings-secondary" onClick={signOut}>
                    Sign out
                </button>
            </div>

            <div className="settings-danger">
                <h3 className="settings-danger-title">Delete account</h3>

                {confirmingDelete ? (
                    <>
                        <p className="settings-hint">
                            This permanently deletes your account, profile, photos, favorites and
                            RSVPs. Reviews you wrote stay on club pages but are no longer linked to
                            you. This cannot be undone.
                        </p>
                        <label className="setup-field-label" htmlFor="settings-confirm-username">
                            type <strong>{profile?.username}</strong> to confirm
                        </label>
                        <input
                            id="settings-confirm-username"
                            className="setup-school-input"
                            value={confirmUsername}
                            onChange={(e) => setConfirmUsername(e.target.value)}
                            autoComplete="off"
                        />
                        <div className="settings-actions">
                            <button
                                type="button"
                                className="settings-secondary"
                                onClick={() => {
                                    setConfirmingDelete(false)
                                    setConfirmUsername('')
                                    setDeleteError(null)
                                }}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="settings-danger-btn"
                                onClick={deleteAccount}
                                disabled={
                                    deleting ||
                                    confirmUsername.trim().toLowerCase() !==
                                        (profile?.username || '').toLowerCase()
                                }
                            >
                                {deleting ? 'Deleting…' : 'Permanently delete'}
                            </button>
                        </div>
                        {deleteError && <p className="settings-error">{deleteError}</p>}
                    </>
                ) : (
                    <button
                        type="button"
                        className="settings-danger-trigger"
                        onClick={() => setConfirmingDelete(true)}
                    >
                        Delete my account
                    </button>
                )}
            </div>
        </section>
    )
}

export default AccountSettings
