import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useClubData } from '../context/useClubData';
import ColorThief from 'colorthief';
import { FaSearch, FaTimes } from 'react-icons/fa';
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
function BasicInfoModule({ club, data, topTags, editing, onChange, onLogoChange, actions, warning }) {
  const [dominantColor, setDominantColor] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [descOpen, setDescOpen] = useState(false);
  const [nameMarquee, setNameMarquee] = useState(false);
  const [nameDur, setNameDur] = useState(20);
  const [friendsModalOpen, setFriendsModalOpen] = useState(false);
  const [friendsSearch, setFriendsSearch] = useState('');
  const [imageWarning, setImageWarning] = useState('');


  const imgRef = useRef(null);
  const descRef = useRef(null);
  const nameWrapRef = useRef(null);
  const nameRef = useRef(null);


  const displayName = data?.club_name || club.club_name || '';
  const displayDescription = data?.description || club.club_description || '';
  const logoUrl = data?.logo_url || club.image_url || '/raccoon_pfp.png';
  const tagLine = (topTags || []).map(s => s.replaceAll('"', '')).join(' • ');

  // Truncate the description to 50 words in view mode; the full text opens in a modal.
  const descWords = displayDescription.trim() ? displayDescription.trim().split(/\s+/) : [];
  const isLongDesc = descWords.length > 50;
  const descPreview = isLongDesc ? descWords.slice(0, 50).join(' ') : displayDescription;

  const { friendMembershipMap, friendsArray } = useClubData();
  const friendsInClub = friendMembershipMap?.get(club.id) || [];

  const friendsInClubIds = new Set(friendsInClub.map(f => f.id));
  const otherFriends = (friendsArray || []).filter(f => !friendsInClubIds.has(f.id));
  const q = friendsSearch.toLowerCase();
  const filteredInClub = friendsInClub.filter(f => f.username.toLowerCase().includes(q));
  const filteredOther = otherFriends.filter(f => f.username.toLowerCase().includes(q));

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

  // Club name is one line; if it overflows its container, scroll it like a marquee.
  useLayoutEffect(() => {
    const wrap = nameWrapRef.current;
    const el = nameRef.current;
    if (!wrap || !el) { setNameMarquee(false); return; }
    const over = el.scrollWidth > wrap.clientWidth + 1;
    setNameMarquee(over);
    if (over) setNameDur(Math.max(6, el.scrollWidth / 40)); // ~40px/s
  }, [displayName, editing]);

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validity = await new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const ratio = img.naturalWidth / img.naturalHeight;
        resolve(ratio >= 0.25 && ratio <= 4.0 ? 'ok' : 'proportions');
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve('load'); };
      img.src = url;
    });

    if (validity === 'load') {
      setImageWarning('Image upload unsuccessful. Please try a different file.');
      return;
    }
    if (validity === 'proportions') {
      setImageWarning('Image has unusual proportions. Please use an aspect ratio between 1:4 and 4:1.');
      return;
    }

    setImageWarning('');
    setLogoPreview(URL.createObjectURL(file));
    onLogoChange(file);
  };

  return (
    <>
    {editing && (
          <p className="about-edit-help">
            You're in edit mode! Email explorethebackyard2025@gmail.com with any questions!
          </p>
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
          {editing
            ? <input
                className="club-name-exp club-name-input"
                value={data?.club_name || ''}
                onChange={(e) => onChange({ ...data, club_name: e.target.value })}
                placeholder="Club name"
              />
            : <div className="club-name-wrap" ref={nameWrapRef}>
                <div
                  className={`club-name-track ${nameMarquee ? 'on' : ''}`}
                  style={nameMarquee ? { '--name-dur': `${nameDur}s` } : undefined}
                >
                  <h2 className="club-name-exp" ref={nameRef}>{displayName}</h2>
                  {nameMarquee && <h2 className="club-name-exp" aria-hidden="true">{displayName}</h2>}
                </div>
              </div>
          }
          {/* Web: tag sits under the name (hidden on mobile, where the block copy shows instead) */}
          {topTags.length > 0 && (
            <h2 className="club-tag1 club-tag1--inline">{tagLine}</h2>
          )}
        </div>

        <div className="image-stack">
          <div className="rectangle_min" style={{ '--dominant-color': dominantColor }}>
            {/* Mobile: tag sits inside the rectangle near the top (hidden on web) */}
            {topTags.length > 0 && (
              <h2 className="club-tag1 club-tag1--block">{tagLine}</h2>
            )}
            <div
              className="club-img-exp"
              style={{ backgroundImage: `url(${logoPreview || logoUrl})`, marginTop: topTags?.length === 0 ? '1rem' : undefined }}
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

      {editing && imageWarning && <p className="module-warning">{imageWarning}</p>}

      {/* Action row slot (share / join / add events / favorite) — supplied by the parent
          so membership & review state stays in ExpandedTile; absent on the ClubPage route. */}
      {actions}

      <div className="about-section">
        <h2 className="divider-header">About</h2>
        {editing && (
          <p className="about-edit-help">
            This is your club's basic info section. Feel free to edit your club's name, profile photo, and a description telling users about your club. 
          </p>
        )}
        <div className="about-meta-row" style={friendsInClub.length === 0 ? { marginLeft: '-4px' } : undefined}>
          {friendsInClub.length > 0 && (
            <button className="friend-avatars-btn" onClick={() => setFriendsModalOpen(true)}>
              {friendsInClub.slice(0, 3).map((friend) => (
                <img
                  key={friend.id}
                  className="friend-avatar-img-bio"
                  src={friend.avatar_url || "/raccoon_pfp.png"}
                  alt={friend.username}
                />
              ))}
              {friendsInClub.length > 3 && (
                <span className="friend-avatar-overflow">+{friendsInClub.length - 3}</span>
              )}
              <span className="friend-names-text">
                {friendsInClub.length === 1
                  ? `${friendsInClub[0].username} is in this club`
                  : friendsInClub.length === 2
                    ? `${friendsInClub[0].username} and ${friendsInClub[1].username} are in this club`
                    : `${friendsInClub[0].username} and ${friendsInClub.length - 1} others are in this club`}
              </span>
            </button>
          )}

          {topTags.length > 0 && (
            <div className="club-tag2">
              {topTags.map((tag) => (
                <div key={tag} className="tag">{tag.replaceAll('"', '')}</div>
              ))}
            </div>
          )}
        </div>

        {editing && warning && (
          <p className="module-warning">{warning}</p>
        )}
        {editing
          ? <textarea
              ref={descRef}
              className="club-description-exp club-desc-input"
              value={data?.description || ''}
              onChange={(e) => onChange({ ...data, description: e.target.value })}
              placeholder="Club description"
            />
          : <p className="club-description-exp">
                {descPreview}
              {isLongDesc && (
                <>
                  {'… '}
                <button
                  type="button"
                  className="desc-more-btn"
                  onClick={() => setDescOpen(true)}
                >
                    MORE
                </button>
                </>
              )}
            </p>
        }
      </div>

      {descOpen && (
        <div className="desc-modal-overlay" onClick={() => setDescOpen(false)}>
          <div className="desc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="desc-modal-header">
              <h3 className="desc-modal-title">{displayName}</h3>
              <button
                type="button"
                className="desc-modal-close"
                onClick={() => setDescOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="desc-modal-body">{displayDescription}</p>
          </div>
        </div>
      )}

      {friendsModalOpen && (
        <div className="friends-modal-overlay-basic-info" onClick={() => { setFriendsModalOpen(false); setFriendsSearch(''); }}>
          <div className="friends-modal" onClick={(e) => e.stopPropagation()}>
            <div className="friends-modal-header">
              <h3 className="friends-modal-title">Friends in {displayName}</h3>
              <button className="friends-modal-close" onClick={() => { setFriendsModalOpen(false); setFriendsSearch(''); }}>
                <FaTimes />
              </button>
            </div>

            <div className="friend-search-wrapper">
              <FaSearch className="friend-search-icon" />
              <input
                placeholder="Search friends"
                value={friendsSearch}
                onChange={(e) => setFriendsSearch(e.target.value)}
                autoFocus
              />
            </div>

            {filteredInClub.length > 0 && (
              <>
                <div className="friends-modal-section-title">In This Club</div>
                <div className="friends-modal-list">
                  {filteredInClub.map((friend) => (
                    <div className="friend-modal-row" key={friend.id}>
                      <img className="friend-avatar-sm" src={friend.avatar_url || '/raccoon_pfp.png'} alt={friend.username} />
                      <span className="friend-result-name">{friend.username}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {filteredOther.length > 0 && (
              <>
                <div className="friends-modal-section-title">Other Friends</div>
                <div className="friends-modal-list">
                  {filteredOther.map((friend) => (
                    <div className="friend-modal-row" key={friend.id}>
                      <img className="friend-avatar-sm" src={friend.avatar_url || '/raccoon_pfp.png'} alt={friend.username} />
                      <span className="friend-result-name">{friend.username}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {filteredInClub.length === 0 && filteredOther.length === 0 && (
              <p className="friends-empty">No friends found.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default React.memo(BasicInfoModule);
