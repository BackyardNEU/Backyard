import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import './ClubMembersPanel.css';

const ROLE_LABEL = {
  top_moderator: 'Owner',
  moderator: 'Moderator',
  member: 'Member',
};

function MemberCard({ entry }) {
  const { role, profiles, club_custom_roles } = entry;

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
    </div>
  );
}

export default function ClubMembersPanel({ clubId, myRole, currentUserId, onMembershipChange }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  const isMember = myRole !== null;
  const isTopModerator = myRole === 'top_moderator';

  async function fetchMembers() {
    try {
      const data = await apiFetch(`/clubs/${clubId}/members`, { auth: false });
      setMembers(data || []);
    } catch (err) {
      setError('Failed to load members.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMembers();
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

  return (
    <div className="club-members-panel">
      <div className="club-members-panel__header">
        <span className="club-members-panel__count">
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </span>
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

      {error && <p className="club-members-panel__error">{error}</p>}

      {loading ? (
        <p className="club-members-panel__loading">Loading...</p>
      ) : members.length === 0 ? (
        <p className="club-members-panel__empty">No members yet.</p>
      ) : (
        <div className="club-members-panel__list">
          {members.map((entry) => (
            <MemberCard key={entry.user_id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
