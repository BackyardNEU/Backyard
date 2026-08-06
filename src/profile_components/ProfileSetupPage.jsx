import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import imageCompression from 'browser-image-compression'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import textModerator from '../lib/textModerator'
import './ProfileSetupPage.css'

const ProfileSetupPage = () => {
    const navigate = useNavigate()
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [username, setUsername] = useState('')
    const [usernameStatus, setUsernameStatus] = useState(null)
    const [biography, setBiography] = useState('')
    const [schoolInput, setSchoolInput] = useState('Northeastern')
    const [universities, setUniversities] = useState([])
    const [selectedUniversity, setSelectedUniversity] = useState({
        id: '38500bfc-e606-46a7-840d-720b11ad2e8b',
        uni_name: 'Northeastern',
    })
    const [avatarFile, setAvatarFile] = useState(null)
    const [avatarPreview, setAvatarPreview] = useState(null)
    const [showDropdown, setShowDropdown] = useState(false)
    const [error, setError] = useState(null)

    const [existingPhotos, setExistingPhotos] = useState([])
    const [selectedPhotoFiles, setSelectedPhotoFiles] = useState([])
    const [photoPreviews, setPhotoPreviews] = useState([])

    const BUCKET = 'profile_images'
    const PHOTO_BUCKET = 'profile_photos'
    const TABLE = 'profiles'
    const URL_COL = 'avatar_url'
    const MAX_PHOTOS = 10

    const COMPRESSION_OPTIONS = {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 400,
        useWebWorker: true,
        fileType: 'image/webp',
    }

    const checkUsername = useCallback(async (value) => {
        if (!value || value.length < 3 || !/^[a-zA-Z0-9_]+$/.test(value)) {
            setUsernameStatus(null);
            return;
        }
        try {
            const { available, reason } = await apiFetch(
                `/users/check-username?username=${encodeURIComponent(value)}`,
                { auth: false }
            );
            setUsernameStatus(available ? 'available' : reason || 'taken');
        } catch {
            setUsernameStatus(null);
        }
    }, []);

    useEffect(() => {
        if (!username) { setUsernameStatus(null); return; }
        const timer = setTimeout(() => checkUsername(username), 400);
        return () => clearTimeout(timer);
    }, [username, checkUsername]);

    const filteredUniversities = useMemo(() => {
        if (!schoolInput.trim()) return universities
        return universities.filter((uni) =>
            uni.uni_name.toLowerCase().includes(schoolInput.toLowerCase())
        )
    }, [schoolInput, universities])

    useEffect(() => {
        async function loadProfile() {
            setLoading(true);
            setError(null);

            try {
                const { data, error } = await supabase.auth.getUser();
                if (error) throw error;

                const [uniResult, profileResult] = await Promise.allSettled([
                    apiFetch('/universities', { auth: false }),
                    apiFetch('/me/profile'),
                ]);

                const uniData = uniResult.status === 'fulfilled' ? uniResult.value : [];
                const profileData = profileResult.status === 'fulfilled' ? profileResult.value : null;

                const authUser = data?.user || null;
                setUser(authUser);
                setUniversities(uniData || []);

                setFirstName(profileData?.first_name || '');
                setLastName(profileData?.last_name || '');
                const existingUsername = profileData?.username || '';
                if (existingUsername && /^[a-zA-Z0-9_]+$/.test(existingUsername)) {
                    setUsername(existingUsername);
                }
                setBiography(profileData?.biography || '');
                setAvatarPreview(profileData?.avatar_url || null);
                setExistingPhotos(Array.isArray(profileData?.photos) ? profileData.photos : []);

                const loadedSchoolName = profileData?.school_name || profileData?.school || '';
                const loadedSchoolId = profileData?.school_id || null;

                if (loadedSchoolName) {
                    setSchoolInput(loadedSchoolName);
                    if (loadedSchoolId) {
                        setSelectedUniversity({
                            id: loadedSchoolId,
                            uni_name: loadedSchoolName,
                        });
                    } else {
                        const match = (uniData || []).find(
                            (uni) => uni.uni_name.toLowerCase() === loadedSchoolName.toLowerCase()
                        );
                        if (match) setSelectedUniversity(match);
                    }
                }
            } catch (err) {
                console.error('Error loading setup data:', err);
                setError('Failed to load user data. Please try again.');
            } finally {
                setLoading(false);
            }
        }

        loadProfile();
    }, []);

    useEffect(() => {
        return () => {
            photoPreviews.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [photoPreviews]);

    const handleAvatarChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
    };

    const handlePhotoChange = (event) => {
        const files = Array.from(event.target.files || []);
        const totalCurrent = existingPhotos.length + selectedPhotoFiles.length;
        const remainingSlots = MAX_PHOTOS - totalCurrent;

        if (remainingSlots <= 0) {
            setError(`You can have at most ${MAX_PHOTOS} photos.`);
            event.target.value = '';
            return;
        }

        const filesToAdd = files.slice(0, remainingSlots);
        if (files.length > remainingSlots) {
            setError(`Only added ${remainingSlots} photo(s). Max ${MAX_PHOTOS} total.`);
        }

        setSelectedPhotoFiles((prev) => [...prev, ...filesToAdd]);
        setPhotoPreviews((prev) => [
            ...prev,
            ...filesToAdd.map((file) => URL.createObjectURL(file)),
        ]);
        event.target.value = '';
    };

    const removeExistingPhoto = (index) => {
        setExistingPhotos((prev) => prev.filter((_, i) => i !== index));
    };

    const removeNewPhoto = (index) => {
        URL.revokeObjectURL(photoPreviews[index]);
        setSelectedPhotoFiles((prev) => prev.filter((_, i) => i !== index));
        setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSchoolSelect = (university) => {
        setSelectedUniversity(university);
        setSchoolInput(university.uni_name);
        setShowDropdown(false);
    };

    const uploadNewPhotos = async () => {
        const urls = [];
        for (const file of selectedPhotoFiles) {
            const ext = file.name.split('.').pop();
            const { signedUrl, publicUrl } = await apiFetch('/storage/profile-photos-upload-url', {
                method: 'POST',
                body: { ext },
            });

            const putRes = await fetch(signedUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type || 'application/octet-stream' },
            });
            if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

            const verification = await apiFetch('/storage/verify-image', {
                method: 'POST',
                body: { publicUrl },
            });
            if (!verification.ok) {
                throw new Error(verification.error || 'Photo rejected by content policy');
            }

            urls.push(publicUrl);
        }
        return urls;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError(null);

        if (!firstName.trim() || !lastName.trim()) {
            setError('First and last name are required.');
            return;
        }

        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
            setError('Username must be 3-30 alphanumeric or underscore characters.');
            return;
        }

        if (usernameStatus && usernameStatus !== 'available') {
            setError('That username is already taken.');
            return;
        }

        if (!biography.trim()) {
            setError('Please enter a short biography.');
            return;
        }

        const textCheck = textModerator.checkFields({
            first_name: firstName,
            last_name: lastName,
            biography,
        });
        if (!textCheck.clean) {
            setError(textCheck.message);
            return;
        }

        if (!selectedUniversity) {
            setError('Please choose a school from the dropdown list.');
            return;
        }

        setSubmitting(true);
        try {
            let avatarUrl = avatarPreview;

            if (avatarFile) {
                const compressed = await imageCompression(avatarFile, COMPRESSION_OPTIONS);

                const { signedUrl, publicUrl } = await apiFetch('/storage/profile-upload-url', {
                    method: 'POST',
                });

                const putRes = await fetch(signedUrl, {
                    method: 'PUT',
                    body: compressed,
                    headers: { 'Content-Type': 'image/webp' },
                });
                if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

                const verification = await apiFetch('/storage/verify-image', {
                    method: 'POST',
                    body: { publicUrl },
                });
                if (!verification.ok) {
                    throw new Error(verification.error || 'Avatar rejected by content policy');
                }

                avatarUrl = publicUrl;
            }

            const newPhotoUrls = await uploadNewPhotos();
            const allPhotos = [...existingPhotos, ...newPhotoUrls];

            // Note: the previous code tried a `school_id`/`school_name` payload first
            // and fell back to `school` on a column error. The backend PROFILE_WRITABLE
            // allowlist currently only includes `school`, so unknown columns are
            // silently dropped — the fallback collapses into one call.
            await apiFetch('/me/profile', {
                method: 'PUT',
                body: {
                    first_name: firstName.trim(),
                    last_name: lastName.trim(),
                    username: username.trim(),
                    [URL_COL]: avatarUrl,
                    biography: biography.trim(),
                    school: selectedUniversity.uni_name,
                    photos: allPhotos,
                },
            });

            const pendingJoinToken = sessionStorage.getItem('pendingJoinToken');
            if (pendingJoinToken) {
                sessionStorage.removeItem('pendingJoinToken');
                navigate(`/join/${pendingJoinToken}`, { replace: true });
            } else {
                navigate('/profile', { replace: true });
            }
        } catch (err) {
            console.error('Error saving profile setup:', err);
            setError('Could not save your profile. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="profile-setup-page">Loading profile setup...</div>;
    }

    const totalPhotos = existingPhotos.length + selectedPhotoFiles.length;

    return (
        <div className='profile-setup-page'>
            <div className="uni-background-layer" />
            <form className="profile-setup-card" onSubmit={handleSubmit}>
                <span className="setup-pin setup-pin-left" aria-hidden="true" />
                <span className="setup-pin setup-pin-right" aria-hidden="true" />
                <h1 className="setup-title">Finish Your Profile</h1>

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

                <label className="setup-field-label" htmlFor="setup-username">username</label>
                <div className="setup-username-wrap">
                    <input
                        id="setup-username"
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

                <label htmlFor="setup-avatar" className="setup-avatar-label">
                    <img
                        src={avatarPreview || '/raccoon_pfp.png'}
                        alt="Upload profile"
                        className="setup-avatar"
                    />
                </label>
                <input
                    id="setup-avatar"
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleAvatarChange}
                />
                <p className="setup-hint">upload profile pic</p>

                <label className="setup-field-label" htmlFor="bio-input">enter biography</label>
                <textarea
                    id="bio-input"
                    className="setup-bio"
                    value={biography}
                    onChange={(event) => setBiography(event.target.value)}
                    placeholder="Tell people a little about yourself"
                    rows={5}
                />

                <label className="setup-field-label" htmlFor="photo-input">
                    photos ({totalPhotos}/{MAX_PHOTOS})
                </label>
                <input
                    id="photo-input"
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

                {/* School selection disabled — defaulting to Northeastern */}
                <label className="setup-field-label">school</label>
                <div className="setup-school-wrap">
                    <input
                        className="setup-school-input"
                        value="Northeastern"
                        disabled
                    />
                </div>

                <button type="submit" className="setup-submit" disabled={submitting}>
                    {submitting ? 'saving...' : 'submit'}
                </button>

                {error && <p className="setup-error">{error}</p>}
            </form>
        </div>
    )
}

export default ProfileSetupPage
