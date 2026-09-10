import React from 'react';
import LinksTable from './LinksTable';
import { getLinkKeyword, LINK_ICONS, LINK_ICON_COLORS } from './linkIcons';
import './LinksModule.css';

/**
 * Links module — edits the same `links` array that lives on the basic_info module's data
 * (so the public-facing link buttons stay in the action bar at the top of the page, where
 * they've always rendered). This module exists only to give Links its own accordion slot:
 * a title, help text, visibility checkbox, and a preview of all the links, independent of
 * basic_info's own display/order.
 *
 * data shape: { links: [{ id, name, url, enabled }] } — actually basic_info's data, passed through.
 *
 * @param {Object}   data
 * @param {boolean}  editing
 * @param {Function} onChange - (updatedBasicInfoData) => void
 * @param {string|null} warning
 */
function LinksModule({ data, editing, onChange, warning }) {
  const links = data?.links ?? [];
  const enabledLinks = links.filter((l) => l.enabled && l.url);

  return (
    <div className="links-module">
      <p className="divider-header">Links</p>
      {editing && (
        <p className="about-edit-help">
          Links go at the top of the page for easy access, next to Share/Join/Add Events. Use the
          checkbox above to hide or show the links section without deleting your links.
        </p>
      )}
      {editing && warning && <p className="module-warning">{warning}</p>}

      {enabledLinks.length > 0 ? (
        <div className="links-module-preview">
          {enabledLinks.map((link, i) => {
            const keyword = getLinkKeyword(link.name);
            const Icon = LINK_ICONS[keyword];
            return (
            <a
              key={link.id || i}
              className={`review-btn link-btn link-btn--${keyword}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => editing && e.preventDefault()}
            >
              {Icon ? <Icon size="1.6rem" color={LINK_ICON_COLORS[keyword] || '#fff'} /> : link.name}
            </a>
            );
          })}
        </div>
      ) : (
        editing && <p className="links-module-empty">No enabled links yet — add one below.</p>
      )}

      {editing && (
        <LinksTable
          links={links}
          onChange={(nextLinks) => onChange?.({ ...data, links: nextLinks })}
        />
      )}
    </div>
  );
}

export default React.memo(LinksModule);
