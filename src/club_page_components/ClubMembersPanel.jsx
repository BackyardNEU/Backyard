import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import './ClubMembersPanel.css';

const ROLE_LABEL = {
  top_moderator: 'Owner',
  moderator: 'Moderator',
  member: 'Member',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MemberCard({ entry, myRole, currentUserId, customRoles, onAssignCustomRole, onChangeRole, onTransferOwnership }) {
  const { user_id, role, profiles, club_custom_roles } = entry;
  const canManage = myRole === 'moderator' || myRole === 'top_moderator';
  const isOwner = myRole === 'top_moderator';
  const isSelf = user_id === currentUserId;
  const isTargetOwner = role === 'top_moderator';

  // Mods only see non-privileged roles in the dropdown; owners see all
  const availableRoles = isOwner
    ? customRoles
    : customRoles.filter((r) => !r.grants_moderator_privileges);

  return (
    <div className="member-card">
      {profiles?.avatar_url ? (
        <img className="member-avatar" src={profiles.avatar_url} alt={profiles.username} />
      ) : (
        <div className="member-avatar member-avatar--placeholder" />
      )}

      <div className="member-info">
        <span className="member-username">{profiles?.username ?? 'Unknown'}</span>
        {club_custom_roles?.name && (
          <span className="member-custom-role">{club_custom_roles.name}</span>
        )}
        <span className={`role-badge role-badge--${role}`}>{ROLE_LABEL[role]}</span>
      </div>

      {canManage && !isSelf && !isTargetOwner && (
        <div className="member-card__controls">
          <select
            className="member-role-select"
            value={entry.custom_role_id ?? ''}
            onChange={(e) => onAssignCustomRole(user_id, e.target.value || null, entry.role)}
          >
            <option value="">No custom role</option>
            {availableRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}{r.grants_moderator_privileges ? ' *' : ''}
              </option>
            ))}
          </select>

          {isOwner && (
            role === 'member' ? (
              <button
                className="member-role-btn member-role-btn--promote"
                onClick={() => onChangeRole(user_id, 'moderator')}
              >
                Promote
              </button>
            ) : (
              <>
                <button
                  className="member-role-btn member-role-btn--demote"
                  onClick={() => onChangeRole(user_id, 'member')}
                >
                  Demote
                </button>
                <button
                  className="member-role-btn member-role-btn--transfer"
                  onClick={() => onTransferOwnership(user_id, profiles?.username)}
                >
                  Transfer Ownership
                </button>
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}

function ManageRolesPanel({ clubId, customRoles, myRole, onClose, onRolesChange }) {
  const [newName, setNewName] = useState('');
  const [newPrivileged, setNewPrivileged] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const isOwner = myRole === 'top_moderator';

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim() || adding) return;
    setAdding(true);
    setError(null);
    try {
      await apiFetch(`/clubs/${clubId}/roles`, {
        method: 'POST',
        body: { name: newName.trim(), grants_moderator_privileges: newPrivileged },
      });
      setNewName('');
      setNewPrivileged(false);
      await onRolesChange();
    } catch (err) {
      setError(err?.message ?? 'Failed to create role.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(roleId) {
    setError(null);
    try {
      await apiFetch(`/clubs/${clubId}/roles/${roleId}`, { method: 'DELETE' });
      await onRolesChange();
    } catch (err) {
      setError(err?.message ?? 'Failed to delete role.');
    }
  }

  return (
    <div className="manage-roles-panel">
      <div className="manage-roles-panel__header">
        <span className="manage-roles-panel__title">Custom Roles</span>
        <button className="manage-roles-panel__close" onClick={onClose}>Done</button>
      </div>

      {error && <p className="club-members-panel__error">{error}</p>}

      <ul className="manage-roles-panel__list">
        {customRoles.length === 0 && (
          <li className="manage-roles-panel__empty">No custom roles yet.</li>
        )}
        {customRoles.map((r) => {
          const canDelete = isOwner || !r.grants_moderator_privileges;
          return (
            <li key={r.id} className="manage-roles-panel__item">
              <span className="manage-roles-panel__role-name">{r.name}</span>
              {r.grants_moderator_privileges && (
                <span
                  className="manage-roles-panel__priv-tag"
                  title="Assigning this role grants moderator access"
                >
                  mod access
                </span>
              )}
              {canDelete && (
                <button
                  className="manage-roles-panel__delete"
                  onClick={() => handleDelete(r.id)}
                >
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <form className="manage-roles-panel__form" onSubmit={handleAdd}>
        <input
          className="manage-roles-panel__input"
          placeholder="Role name"
          value={newName}
          maxLength={40}
          onChange={(e) => setNewName(e.target.value)}
        />
        <label className="manage-roles-panel__toggle-label">
          <input
            type="checkbox"
            checked={newPrivileged}
            onChange={(e) => setNewPrivileged(e.target.checked)}
            disabled={!isOwner}
          />
          Grants moderator access
        </label>
        <button
          type="submit"
          className="manage-roles-panel__add-btn"
          disabled={adding || !newName.trim()}
        >
          {adding ? '...' : 'Add Role'}
        </button>
      </form>

      {isOwner && (
        <p className="manage-roles-panel__hint">
          * Roles marked with "mod access" can only be created and assigned by you.
          Assigning one will also grant the member moderator privileges.
        </p>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function ClubMembersPanel({ clubId, myRole, currentUserId, onMembershipChange }) {
  const [members, setMembers] = useState([]);
  const [customRoles, setCustomRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showManageRoles, setShowManageRoles] = useState(false);

  const isMember = myRole !== null;
  const isTopModerator = myRole === 'top_moderator';
  const canManage = myRole === 'moderator' || myRole === 'top_moderator';

  async function fetchMembers() {
    try {
      const data = await apiFetch(`/clubs/${clubId}/members`, { auth: false });
      setMembers(data || []);
    } catch (err) {
      setError(err?.message ?? 'Failed to load members.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchRoles() {
    try {
      const data = await apiFetch(`/clubs/${clubId}/roles`, { auth: false });
      setCustomRoles(data || []);
    } catch {
      // non-fatal — panel still works without custom roles
    }
  }

  useEffect(() => {
    fetchMembers();
    fetchRoles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  async function handleJoin() {
    if (actionLoading) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(`/clubs/${clubId}/members/me`, { method: 'POST' });
      if (onMembershipChange) onMembershipChange('member');
      await fetchMembers();
    } catch (err) {
      setError(err?.message ?? 'Could not join club.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLeave() {
    if (actionLoading) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(`/clubs/${clubId}/members/me`, { method: 'DELETE' });
      if (onMembershipChange) onMembershipChange(null);
      await fetchMembers();
    } catch (err) {
      setError(err?.message ?? 'Could not leave club.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAssignCustomRole(userId, customRoleId, currentMechanicalRole) {
    setError(null);
    // Warn before silently granting moderator access
    if (customRoleId) {
      const role = customRoles.find((r) => r.id === customRoleId);
      if (role?.grants_moderator_privileges && currentMechanicalRole === 'member') {
        const confirmed = window.confirm(
          `Assigning "${role.name}" will also grant this member moderator access. Continue?`
        );
        if (!confirmed) return;
      }
    }
    try {
      await apiFetch(`/clubs/${clubId}/members/${userId}`, {
        method: 'PATCH',
        body: { customRoleId: customRoleId ?? null },
      });
      await fetchMembers();
    } catch (err) {
      setError(err?.message ?? 'Failed to assign role.');
    }
  }

  async function handleChangeRole(userId, newRole) {
    setError(null);
    try {
      await apiFetch(`/clubs/${clubId}/members/${userId}/role`, {
        method: 'PATCH',
        body: { role: newRole },
      });
      await fetchMembers();
    } catch (err) {
      setError(err?.message ?? 'Failed to change role.');
    }
  }

  async function handleTransferOwnership(userId, username) {
    const confirmed = window.confirm(
      `Transfer ownership to ${username ?? 'this member'}? You will become a moderator.`
    );
    if (!confirmed) return;
    setError(null);
    try {
      await apiFetch(`/clubs/${clubId}/members/transfer-ownership`, {
        method: 'POST',
        body: { newTopModeratorId: userId },
      });
      if (onMembershipChange) onMembershipChange('moderator');
      await fetchMembers();
    } catch (err) {
      setError(err?.message ?? 'Failed to transfer ownership.');
    }
  }

  if (showManageRoles) {
    return (
      <ManageRolesPanel
        clubId={clubId}
        customRoles={customRoles}
        myRole={myRole}
        onClose={() => setShowManageRoles(false)}
        onRolesChange={async () => {
          await fetchRoles();
          await fetchMembers();
        }}
      />
    );
  }

  return (
    <div className="club-members-panel">
      <div className="club-members-panel__header">
        <span className="club-members-panel__count">
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </span>
        <div className="club-members-panel__header-actions">
          {canManage && (
            <button
              className="manage-roles-btn"
              onClick={() => setShowManageRoles(true)}
            >
              Manage Roles
            </button>
          )}
          {currentUserId && (
            isMember ? (
              <button
                className="membership-btn leave"
                onClick={handleLeave}
                disabled={actionLoading || isTopModerator}
                title={isTopModerator ? 'Transfer ownership before leaving' : undefined}
              >
                {actionLoading ? '...' : 'Leave Club'}
              </button>
            ) : (
              <button
                className="membership-btn join"
                onClick={handleJoin}
                disabled={actionLoading}
              >
                {actionLoading ? '...' : 'Join Club'}
              </button>
            )
          )}
        </div>
      </div>

      {error && <p className="club-members-panel__error">{error}</p>}

      {loading ? (
        <p className="club-members-panel__loading">Loading...</p>
      ) : members.length === 0 ? (
        <p className="club-members-panel__empty">No members yet.</p>
      ) : (
        <div className="club-members-panel__list">
          {members.map((entry) => (
            <MemberCard
              key={entry.user_id}
              entry={entry}
              myRole={myRole}
              currentUserId={currentUserId}
              customRoles={customRoles}
              onAssignCustomRole={handleAssignCustomRole}
              onChangeRole={handleChangeRole}
              onTransferOwnership={handleTransferOwnership}
            />
          ))}
        </div>
      )}
    </div>
  );
}
