import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import ColorThief from 'colorthief';
import './BasicInfoModule.css';

function BasicInfoModule({ club }) {
  const id = club.id;

  const [dominantColor, setDominantColor] = useState(null);
  const [topTags, setTopTags] = useState([]);
  const [isApproved, setIsApproved] = useState(false);
  const [moduleData, setModuleData] = useState({});
  const [fullPageData, setFullPageData] = useState(null);

  const [pageLoaded, setPageLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ club_name: '', logo_url: '', description: '' });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const imgRef = useRef(null);
  const descRef = useRef(null);

  const displayName = moduleData.club_name || club.club_name || '';
  const displayDescription = moduleData.description || club.club_description || '';

  // ColorThief
  const getPastelColor = (r, g, b) => {
    const factor = (r + (255 - r) * 0.85 >= 240 &&
                    g + (255 - g) * 0.85 >= 240 &&
                    b + (255 - b) * 0.85 >= 240) ? 0.5 : 0.85;
    return `rgb(${Math.round(r + (255 - r) * factor)}, ${Math.round(g + (255 - g) * factor)}, ${Math.round(b + (255 - b) * factor)})`;
  };

  useEffect(() => {
    const colorThief = new ColorThief();
    const img = imgRef.current;

    const getColor = () => {
      try {
        const [r, g, b] = colorThief.getColor(img);
        setDominantColor(getPastelColor(r, g, b));
      } catch {
        setDominantColor('rgb(211, 211, 211)');
      }
    };

    if (!img || !img.src) { setDominantColor('rgb(211, 211, 211)'); return; }

    if (img.complete) {
      getColor();
    } else {
      img.addEventListener('load', getColor);
      img.addEventListener('error', () => setDominantColor('rgb(211, 211, 211)'));
      return () => {
        img.removeEventListener('load', getColor);
        img.removeEventListener('error', () => setDominantColor('rgb(211, 211, 211)'));
      };
    }
  }, [club.image_url]);

  // Fetch page preset + top tags
  useEffect(() => {
    async function fetchPageData() {
      const [pageResult, tagsResult] = await Promise.allSettled([
        apiFetch(`/clubs/${id}/page`, { auth: false }),
        apiFetch(`/clubs/${id}/top-tags`, { auth: false }),
      ]);

      if (tagsResult.status === 'fulfilled') {
        setTopTags((tagsResult.value || []).map(r => r.tag));
      }

      if (pageResult.status === 'fulfilled') {
        const data = pageResult.value;
        setFullPageData(data);
        const mod = (data?.modules || []).find(m => m.type === 'basic_info');
        const modData = mod?.data || {};
        setModuleData(modData);
        setDraft({
          club_name: modData.club_name || club.club_name || '',
          logo_url: modData.logo_url || club.image_url || '/raccoon_pfp.png',
          description: modData.description || club.club_description || '',
        });
      } else {
        setDraft({
          club_name: club.club_name || '',
          logo_url: club.image_url || '/raccoon_pfp.png',
          description: club.club_description || '',
        });
      }
      setPageLoaded(true);
    }
    fetchPageData();
  }, [id]);

  // Check approved status
  useEffect(() => {
    async function checkApproved() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      try {
        const { approved } = await apiFetch(`/clubs/${id}/is-approved`);
        setIsApproved(approved);
      } catch {
        // not approved or table doesn't exist yet
      }
    }
    checkApproved();
  }, [id]);

  // Auto-resize textarea — useLayoutEffect fires synchronously after DOM mutation
  // so scrollHeight is always accurate when measured
  useLayoutEffect(() => {
    if (descRef.current) {
      descRef.current.style.height = 'auto';
      descRef.current.style.height = `${descRef.current.scrollHeight}px`;
    }
  }, [draft.description, editing]);

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
        const { signedUrl, publicUrl } = await apiFetch('/storage/club-logo-upload-url', {
          method: 'POST',
          body: { club_id: id, ext: logoFile.type.split('/')[1] },
        });
        await fetch(signedUrl, { method: 'PUT', body: logoFile });
        finalLogoUrl = publicUrl;
      }

      const updatedData = { ...draft, logo_url: finalLogoUrl };
      const currentModules = fullPageData?.modules ?? [{ type: 'basic_info', order: 0, data: {} }];
      const hasBasicInfo = currentModules.some(m => m.type === 'basic_info');
      const updatedModules = hasBasicInfo
        ? currentModules.map(m => m.type === 'basic_info' ? { ...m, data: updatedData } : m)
        : [...currentModules, { type: 'basic_info', order: 0, data: updatedData }];

      const saved = await apiFetch(`/clubs/${id}/page`, {
        method: 'PUT',
        body: { modules: updatedModules },
      });

      setFullPageData(saved);
      setModuleData(updatedData);
      setDraft(d => ({ ...d, logo_url: finalLogoUrl }));
      setLogoFile(null);
      setLogoPreview(null);
      setEditing(false);
    } catch (err) {
      console.error('Error saving club info:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft({
      club_name: moduleData.club_name || club.club_name || '',
      logo_url: moduleData.logo_url || club.image_url || '/raccoon_pfp.png',
      description: moduleData.description || club.club_description || '',
    });
    setLogoFile(null);
    setLogoPreview(null);
    setEditing(false);
  };

  return (
    <>
      {isApproved && !editing && (
        <button className="exp-edit-btn" onClick={() => setEditing(true)}>Edit</button>
      )}

      <div className="content-col">
        <div className="rectangle" style={{ backgroundColor: dominantColor }}>
          <img
            ref={imgRef}
            src={club.image_url}
            crossOrigin="anonymous"
            alt=""
            style={{ display: 'none' }}
          />
        </div>
        <div className="text-flex">
          {pageLoaded && (editing
            ? <input
                className="club-name-exp club-name-input"
                value={draft.club_name}
                onChange={(e) => setDraft(d => ({ ...d, club_name: e.target.value }))}
                placeholder="Club name"
              />
            : <h2 className="club-name-exp">{displayName}</h2>
          )}
          {topTags.length > 0 && (
            <h2 className="club-tag1">
              {topTags.map(s => s.replaceAll('"', '')).join(' • ')}
            </h2>
          )}
        </div>

        <div className="image-stack">
          <div className="rectangle_min" style={{ '--dominant-color': dominantColor }}>
            <div
              className="club-img-exp"
              style={{ backgroundImage: `url(${logoPreview || draft.logo_url || club.image_url})` }}
              role="img"
              aria-label={club.club_name}
            >
              {editing && (
                <label className="logo-upload-label">
                  Change Logo
                  <input type="file" accept="image/*" hidden onChange={handleLogoChange} />
                </label>
              )}
            </div>
          </div>
        </div>
      </div>

      {topTags.length > 0 && (
        <div className="club-tag2">
          {topTags.map((tag) => (
            <div key={tag} className="tag">{tag.replaceAll('"', '')}</div>
          ))}
        </div>
      )}

      {pageLoaded && (editing
        ? <textarea
            ref={descRef}
            className="club-description-exp club-desc-input"
            value={draft.description}
            onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
            placeholder="Club description"
          />
        : <p className="club-description-exp">{displayDescription}</p>
      )}

      {editing && (
        <div className="expanded-edit-actions">
          <button onClick={handleCancel} disabled={saving}>Cancel</button>
          <button className="save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
    </>
  );
}

export default BasicInfoModule;
