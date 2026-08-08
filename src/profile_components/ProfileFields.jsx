import React from 'react';
import { MAX_PHOTOS } from './useProfileForm';
import Avatar from '../components/Avatar';

// The profile field group, shared by onboarding (ProfileSetupPage) and the settings page.
// Presentational only — all state and the save logic live in useProfileForm.
//
// Keeps the existing `setup-*` class names rather than inventing a parallel set, so there
// is one place to restyle these fields.
export const ProfileFields = ({ form, idPrefix = 'profile' }) => {
    const {
        firstName, setFirstName,
        lastName, setLastName,
        username, setUsername, usernameStatus,
        biography, setBiography,
        avatarPreview, handleAvatarChange,
        existingPhotos, photoPreviews,
        handlePhotoChange, removeExistingPhoto, removeNewPhoto,
        totalPhotos,
    } = form;

    // Both pages can render at once during a route transition, so ids must not collide.
    const id = (name) => `${idPrefix}-${name}`;

    return (
        <>
            <label className="setup-field-label">name</label>
            <div className="setup-name-row">
                <input
                    className="setup-school-input"
                    type="text"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                />
                <input
                    className="setup-school-input"
                    type="text"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                />
            </div>

            <label className="setup-field-label" htmlFor={id('username')}>username</label>
            <div className="setup-username-wrap">
                <input
                    id={id('username')}
                    className="setup-school-input"
                    type="text"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    required
                    minLength={3}
                    maxLength={30}
                />
                {usernameStatus === 'available' && (
                    <span className="setup-username-ok">Available</span>
                )}
                {usernameStatus && usernameStatus !== 'available' && (
                    <span className="setup-username-taken">
                        {usernameStatus === 'taken' ? 'Taken' : usernameStatus}
                    </span>
                )}
            </div>

            <label htmlFor={id('avatar')} className="setup-avatar-label">
                <Avatar
                    url={avatarPreview}
                    firstName={form.firstName}
                    lastName={form.lastName}
                    username={form.username}
                    className="setup-avatar"
                    alt="Upload profile photo"
                />
            </label>
            <input
                id={id('avatar')}
                type="file"
                accept="image/*"
                hidden
                onChange={handleAvatarChange}
            />
            <p className="setup-hint">upload profile pic</p>

            <label className="setup-field-label" htmlFor={id('bio')}>enter biography</label>
            <textarea
                id={id('bio')}
                className="setup-bio"
                value={biography}
                onChange={(e) => setBiography(e.target.value)}
                placeholder="Tell people a little about yourself"
                rows={5}
            />

            <label className="setup-field-label" htmlFor={id('photos')}>
                photos ({totalPhotos}/{MAX_PHOTOS})
            </label>
            <input
                id={id('photos')}
                className="setup-photo-input"
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoChange}
                disabled={totalPhotos >= MAX_PHOTOS}
            />

            {(existingPhotos.length > 0 || photoPreviews.length > 0) && (
                <div className="setup-photo-previews">
                    {existingPhotos.map((url, index) => (
                        <div key={`existing-${url}`} className="setup-photo-item">
                            <img src={url} alt={`Photo ${index + 1}`} />
                            <button
                                type="button"
                                className="setup-photo-remove"
                                onClick={() => removeExistingPhoto(index)}
                                aria-label="Remove photo"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    {photoPreviews.map((preview, index) => (
                        <div key={`new-${index}`} className="setup-photo-item">
                            <img src={preview} alt={`New photo ${index + 1}`} />
                            <button
                                type="button"
                                className="setup-photo-remove"
                                onClick={() => removeNewPhoto(index)}
                                aria-label="Remove photo"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};

export default ProfileFields;
