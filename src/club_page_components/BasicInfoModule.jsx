import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useClubData } from '../context/useClubData';
import ColorThief from 'colorthief';
import './BasicInfoModule.css';

/**
 * @param {Object} props
 * @param {Object} props.club - object passed down which contains the id used for queries and api fetches.
 * @param {Object} props.data - arbitrary but relevant data passed to the module. This particular module contains the logo url, description, and
 * name of the club, but for other modules the data field would hold different, relevant info (see other modules for info).
 * @param {string[]} props.topTags - the top 3 most frequented selected tags for a club aggregated in the database from reviews left by club memebers.
 * @param {boolean} props.editing - determines whether or not the user is in edit mode or not (should never be true for non approved accounts)
 * @param {Function} props.onChange - callback function that preserves the function and its references from being rerendered every well, rerender.
 * @param {Function} props.onLogoChange - simple function that sets the value of a logo file equal to the current pending file if there 
 * is a change- meant to allow ExpandedTile to handle file uploads since they have to be uploaded using signed URL's since files
 * cannot be serialized into JSON.
 */
function BasicInfoModule({ club, data, topTags, editing, onChange, onLogoChange }) {
  const [dominantColor, setDominantColor] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const imgRef = useRef(null);
  const descRef = useRef(null);

  const displayName = data?.club_name || club.club_name || '';
  const displayDescription = data?.description || club.club_description || '';
  const logoUrl = data?.logo_url || club.image_url || '/raccoon_pfp.png';

  const { friendMembershipMap } = useClubData();
  const friendsInClub = friendMembershipMap?.get(club.id) || [];

  const getPastelColor = (r, g, b) => {
    const factor = (r + (255 - r) * 0.85 >= 240 &&
                    g + (255 - g) * 0.85 >= 240 &&
                    b + (255 - b) * 0.85 >= 240) ? 0.5 : 0.85;
    return `rgb(${Math.round(r + (255 - r) * factor)}, ${Math.round(g + (255 - g) * factor)}, ${Math.round(b + (255 - b) * factor)})`;
  };

  useEffect(() => {
    console.log("Module Rendered!");
  })

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

  useLayoutEffect(() => {
    if (descRef.current) {
      descRef.current.style.height = 'auto';
      descRef.current.style.height = `${descRef.current.scrollHeight}px`;
    }
  }, [data?.description, editing]);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    onLogoChange(file);
  };

  return (
    <>
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
          {editing
            ? <input
                className="club-name-exp club-name-input"
                value={data?.club_name || ''}
                onChange={(e) => onChange({ ...data, club_name: e.target.value })}
                placeholder="Club name"
              />
            : <h2 className="club-name-exp">{displayName}</h2>
          }
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
              style={{ backgroundImage: `url(${logoPreview || logoUrl})` }}
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

      <div>
        {friendsInClub.length > 0 && (
          <div className="friend-avatars">
            {friendsInClub.slice(0, 3).map((friend) => (
              <img
                key={friend.id}
                className="friend-avatar-img"
                src={friend.avatar_url || "/raccoon_pfp.png"}
                alt={friend.username}
              />
            ))}
            {friendsInClub.length > 3 && (
              <span className="friend-avatar-overflow">
                +{friendsInClub.length - 3}
              </span>
            )}
            {friendsInClub.length > 3 ? 
              (friendsInClub.slice(0, 3).map(friend => <span key={friend.id}>{friend.username},</span>) && (<span>{friendsInClub.length - 3} others</span>)) : 
              (friendsInClub.map(friend => <span key={friend.id}>{friend.username}, </span>))
            }
            <span>are also in this club</span>
          </div>
        )}
      </div>

      <h2 className="about-label">About</h2>

      {editing
        ? <textarea
            ref={descRef}
            className="club-description-exp club-desc-input"
            value={data?.description || ''}
            onChange={(e) => onChange({ ...data, description: e.target.value })}
            placeholder="Club description"
          />
        : <p className="club-description-exp">{displayDescription}</p>
      }
    </>
  );
}

export default React.memo(BasicInfoModule);
