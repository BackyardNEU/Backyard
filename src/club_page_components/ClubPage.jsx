import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import BasicInfoModule from './BasicInfoModule';
import './ClubPage.css';

// ClubPage — module-based profile page for a club.
// Route: /club/:id
//
// Data fetched on mount (three parallel requests):
//
//   1. Club base record (name, image_url, club_description, etc.)
//      GET /api/clubs/:clubId  →  single row from demo_club_data
//
//   2. Club page preset (which modules are active + their stored data)
//      GET /api/clubs/:clubId/page  →  club_page_data row (null if not set up yet)
//      Requires table: club_page_data  (see server/routes/clubPage.js for schema)
//
//   3. Top 3 review tags aggregated from the reviews table
//      GET /api/clubs/:clubId/top-tags  →  [{ tag: string, cnt: int }, ...]
//      Requires SQL RPC: get_top_tags(p_club_id uuid, p_limit int DEFAULT 3)
//      (see server/routes/clubPage.js for suggested function body)
//
//   4. Approved account check (only if a session exists, to avoid 401s)
//      GET /api/clubs/:clubId/is-approved  →  { approved: bool }
//      Requires table: approved_club_accounts  (see server/routes/clubPage.js for schema)

/**
 * @param {{
 * id: string
 * }}
 */
function ClubPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [club, setClub] = useState(null);
  const [pageData, setPageData] = useState(null);
  const [topTags, setTopTags] = useState([]);
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [clubResult, pageResult, tagsResult] = await Promise.allSettled([
          apiFetch(`/clubs/${id}`, { auth: false }),
          apiFetch(`/clubs/${id}/page`, { auth: false }),
          apiFetch(`/clubs/${id}/top-tags`, { auth: false }),
        ]);

        if (clubResult.status === 'fulfilled') setClub(clubResult.value);
        if (pageResult.status === 'fulfilled') setPageData(pageResult.value);
        if (tagsResult.status === 'fulfilled') {
          setTopTags((tagsResult.value || []).map((r) => r.tag));
        }

        // Only check approval status if a session exists — avoids 401 noise.
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          try {
            const { approved } = await apiFetch(`/clubs/${id}/is-approved`);
            setIsApproved(approved);
          } catch {
            // Table not yet created or user not approved — safe to ignore
          }
        }
      } catch (err) {
        console.error('Error loading club page:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  // If no preset row exists yet, start with a default basic_info module
  const modules = pageData?.modules ?? [{ type: 'basic_info', order: 0, data: {} }];

  const handleSave = async (updatedModules) => {
    try {
      const saved = await apiFetch(`/clubs/${id}/page`, {
        method: 'PUT',
        body: { modules: updatedModules },
      });
      setPageData(saved);
    } catch (err) {
      console.error('Error saving club page:', err);
    }
  };

  if (loading) return <div className="club-page-loading">Loading...</div>;
  if (!club) return <div className="club-page-error">Club not found.</div>;

  return (
    <div className="club-page">
      <button className="club-page-back" onClick={() => navigate(-1)}>← Back</button>

      <div className="club-page-modules">
        {modules
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((mod, i) => {
            if (mod.type === 'basic_info') {
              return (
                <BasicInfoModule
                  key={i}
                  club={club}
                  moduleData={mod.data}
                  topTags={topTags}
                  isApproved={isApproved}
                  onSave={(updatedData) => {
                    const updated = modules.map((m, idx) =>
                      idx === i ? { ...m, data: updatedData } : m
                    );
                    handleSave(updated);
                  }}
                />
              );
            }
            // Future module types rendered here
            return null;
          })}
      </div>
    </div>
  );
}

export default ClubPage;
