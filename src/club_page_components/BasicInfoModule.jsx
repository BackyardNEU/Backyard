import React, { useState } from 'react';
import { apiFetch } from '../lib/api';
import './BasicInfoModule.css';

// BasicInfoModule — displays and (for approved accounts) edits core club info.
//
// Props:
//   club        — base record from demo_club_data: { club_name, image_url, club_description }
//   moduleData  — overrides stored in club_page_data.modules[n].data:
//                 { club_name?, logo_url?, description? }
//                 Any field set here takes priority over the club base record.
//   topTags     — string[] of top 3 tags aggregated from the reviews table via
//                 the get_top_tags(p_club_id, p_limit) SQL RPC function.
//                 Tags are read-only (derived live from reviews, never stored here).
//   isApproved  — true only for the club's approved account; shows the Edit button.
//               - LOOK INTO LATER: CAN PEOPLE EDIT THE VALUE OF THIS DIRECTLY IN THE BROWSER??
//   onSave      — (updatedData: object) => void; called with the new moduleData on save.
//
// Logo upload reuses the profile_images bucket + POST /api/storage/profile-upload-url.
// NOTE: When ready, add a dedicated club_logo bucket in Supabase Storage and a
//       matching route in server/routes/storage.js (e.g. POST /storage/club-logo-upload-url).

/**                                                                                                                                           
*   @param {{                                                                                                                                  
*   club: { id: string, club_name: string, image_url: string, club_description: string },                                                      
*   moduleData: { club_name?: string, logo_url?: string, description?: string },
*   topTags: string[],                                                                                                                         
*   isApproved: boolean,                                                                                                                     
*   onSave: (updatedData: object) => void                                                                                                      
* }} props                                                                                                                                   
*/ 
function BasicInfoModule({ club, moduleData, topTags, isApproved, onSave }) {
  //console.log(isApproved);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Resolved display values — moduleData fields override club base data when set
  const displayName = moduleData.club_name || club.club_name || '';
  const displayLogo = moduleData.logo_url || club.image_url || '/raccoon_pfp.png';
  const displayDescription = moduleData.description || club.club_description || '';

  const [draft, setDraft] = useState({
    club_name: displayName,
    logo_url: displayLogo,
    description: displayDescription,
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let finalLogoUrl = draft.logo_url;

      if (logoFile) {
        // Uploads via signed URL — service-role key never leaves the server.
        // Currently reuses profile_images bucket. See the NOTE above.
        const { signedUrl, publicUrl } = await apiFetch('/storage/club-logo-upload-url', {
          method: 'POST',
          body: { club_id: club.id, ext: logoFile.type.split('/')[1] },
        });
        await fetch(signedUrl, { method: 'PUT', body: logoFile });
        finalLogoUrl = publicUrl;
      }

      onSave({ ...draft, logo_url: finalLogoUrl });
      setDraft((d) => ({ ...d, logo_url: finalLogoUrl }));
      setLogoFile(null);
      setLogoPreview(null);
      setEditing(false);
    } catch (err) {
      console.error('Error saving basic info:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft({ club_name: displayName, logo_url: displayLogo, description: displayDescription });
    setLogoFile(null);
    setLogoPreview(null);
    setEditing(false);
  };

  return (
    <div className="basic-info-module">
      {isApproved && !editing && (
        <button className="module-edit-btn" onClick={() => setEditing(true)}>
          Edit
        </button>
      )}

      {editing ? (
        <div className="basic-info-edit">
          <div className="basic-info-logo-edit">
            <img
              className="basic-info-logo"
              src={logoPreview || draft.logo_url}
              alt="Club logo"
            />
            <label className="logo-upload-label">
              Change Logo
              <input type="file" accept="image/*" hidden onChange={handleLogoChange} />
            </label>
          </div>

          <input
            className="basic-info-name-input"
            value={draft.club_name}
            onChange={(e) => setDraft((d) => ({ ...d, club_name: e.target.value }))}
            placeholder="Club name"
          />

          <textarea
            className="basic-info-desc-input"
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Club description"
            rows={5}
          />

          <div className="basic-info-edit-actions">
            <button onClick={handleCancel} disabled={saving}>Cancel</button>
            <button className="save-btn" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="basic-info-view">
          <img className="basic-info-logo" src={displayLogo} alt={displayName} />
          <h1 className="basic-info-name">{displayName}</h1>
          {topTags.length > 0 && (
            <div className="basic-info-tags">
              {topTags.map((tag) => (
                <span key={tag} className="basic-info-tag">{tag}</span>
              ))}
            </div>
          )}
          <p className="basic-info-description">{displayDescription}</p>
        </div>
      )}
    </div>
  );
}

export default BasicInfoModule;