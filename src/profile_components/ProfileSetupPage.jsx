import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import imageCompression from 'browser-image-compression'
import { supabase } from '../supabase'
import './ProfileSetupPage.css'

const ProfileSetupPage = () => {
    const navigate = useNavigate()
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [biography, setBiography] = useState('')
    const [schoolInput, setSchoolInput] = useState('')
    const [universities, setUniversities] = useState([])
    const [selectedUniversity, setSelectedUniversity] = useState(null)
    const [avatarFile, setAvatarFile] = useState(null)
    const [avatarPreview, setAvatarPreview] = useState(null)
    const [showDropdown, setShowDropdown] = useState(false)
    const [error, setError] = useState(null)

    const BUCKET = 'profile_images'
    const TABLE = 'profiles'
    const URL_COL = 'avatar_url'

    const COMPRESSION_OPTIONS = {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 400,
        useWebWorker: true,
        fileType: 'image/webp',
    }

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
                const { data: uniData, error: uniError } = await supabase
                    .from('uni_names')
                    .select('id, uni_name')
                    .order('uni_name', { ascending: true });

                if (error) throw error;
                if (uniError) throw uniError;

                const authUser = data?.user || null;
                setUser(authUser);
                setUniversities(uniData || []);

                const { data: profileData, error: profileError } = await supabase
                    .from(TABLE)
                    .select('*')
                    .eq('id', authUser.id)
                    .single();

                if (profileError) throw profileError;

                setBiography(profileData?.biography || '');
                setAvatarPreview(profileData?.avatar_url || null);

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

    const handleAvatarChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
    };

    const handleSchoolSelect = (university) => {
        setSelectedUniversity(university);
        setSchoolInput(university.uni_name);
        setShowDropdown(false);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError(null);

        if (!biography.trim()) {
            setError('Please enter a short biography.');
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
                const fileName = `${user.id}.webp`;

                const { error: uploadError } = await supabase.storage
                    .from(BUCKET)
                    .upload(fileName, compressed, {
                        upsert: true,
                        contentType: 'image/webp',
                    });

                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
                avatarUrl = data.publicUrl;
            }

            const payload = {
                [URL_COL]: avatarUrl,
                biography: biography.trim(),
                school_id: selectedUniversity.id,
                school_name: selectedUniversity.uni_name,
            };

            let { error: updateError } = await supabase
                .from(TABLE)
                .update(payload)
                .eq('id', user.id);

            if (updateError && /column|school/i.test(updateError.message || '')) {
                const { error: fallbackError } = await supabase
                    .from(TABLE)
                    .update({
                        [URL_COL]: avatarUrl,
                        biography: biography.trim(),
                        school: selectedUniversity.uni_name,
                    })
                    .eq('id', user.id);
                updateError = fallbackError;
            }

            if (updateError) throw updateError;

            navigate('/profile', { replace: true });
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

    return (
        <div className='profile-setup-page'>
            <div className="uni-background-layer" />
            <form className="profile-setup-card" onSubmit={handleSubmit}>
                <span className="setup-pin setup-pin-left" aria-hidden="true" />
                <span className="setup-pin setup-pin-right" aria-hidden="true" />
                <h1 className="setup-title">Finish Your Profile</h1>

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

                <label className="setup-field-label" htmlFor="school-input">choose school</label>
                <div className="setup-school-wrap">
                    <input
                        id="school-input"
                        className="setup-school-input"
                        value={schoolInput}
                        placeholder="Search your university"
                        onChange={(event) => {
                            setSchoolInput(event.target.value);
                            setSelectedUniversity(null);
                            setShowDropdown(true);
                        }}
                        onFocus={() => setShowDropdown(true)}
                        onBlur={() => setTimeout(() => setShowDropdown(false), 120)}
                    />

                    {showDropdown && filteredUniversities.length > 0 && (
                        <div className="setup-school-dropdown">
                            {filteredUniversities.slice(0, 12).map((uni) => (
                                <button
                                    key={uni.id}
                                    type="button"
                                    className="setup-school-option"
                                    onMouseDown={() => handleSchoolSelect(uni)}
                                >
                                    {uni.uni_name}
                                </button>
                            ))}
                        </div>
                    )}
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
