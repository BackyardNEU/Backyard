import React from 'react';
import ClubMemberScroll from './ClubMemberScroll';
import ClubMemberEdit from './ClubMemberEdit';
import './MemberRoster.css';

/**
 * Member roster module.
 *
 * data shape: { categories: string[], members: [{ name, category, photo, bio, user_id }] }
 *  - bio is sanitized rich-text HTML (bold/italic/underline/bullets/numbered).
 *  - user_id is reserved for future profile-linking (free-form members for now).
 *
 * Viewer: category tabs + avatar track + a detail carousel.
 * Edit mode: the scroll AND the editor (cards with category/photo/name/bio).
 *
 * @param {Object}   club
 * @param {Object}   data
 * @param {boolean}  editing
 * @param {Function} onChange - (updatedData) => void
 */
function MemberRosterModule({ data, editing, onChange, warning }) {
  const categories = data?.categories ?? [];
  const members = data?.members ?? [];

  // Nothing public to show when empty; in edit mode still render so the editor appears.
  if (categories.length === 0 && members.length === 0 && !editing) return null;

  return (
    <div className="mr-module">
      <p className="divider-header">Featured Members</p>
    {editing && (
          <p className="about-edit-help">
          Add members of your club you would like to feature. Members can be split into categories (i.e. "Coaches", "Editors", etc). Clicking a profile lets users see their bio.
          </p>
        )}
      <ClubMemberScroll categories={categories} members={members} />
        {editing && warning && <p className="module-warning">{warning}</p>}
      {editing && <ClubMemberEdit data={data ?? { categories, members }} onChange={onChange} />}
    </div>
  );
}

export default React.memo(MemberRosterModule);
