import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Field, Text, Area, Repeater, LIMITS } from './fields.jsx';

const MAX_LINKS = 5;

export default function Basics({ wizard, clubId, clubName }) {
    const data = wizard.getModule('basic_info') ?? {};
    const details = wizard.draft.details ?? {};
    const links = data.links ?? [];
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);

    // The scraped club name is a starting point, not an answer — plenty of directory
    // entries are stale or abbreviated.
    const set = (patch) => wizard.setModule('basic_info', { ...data, club_name: data.club_name ?? clubName, ...patch });
    const setLinks = (next) => set({ links: next });

    const uploadLogo = async (file) => {
        if (!file) return;
        setUploading(true);
        setUploadError(null);
        try {
            const ext = (file.name.split('.').pop() || 'png').toLowerCase();
            const { signedUrl, token, publicUrl } = await apiFetch('/storage/club-logo-upload-url', {
                method: 'POST',
                body: { club_id: clubId, ext },
            });

            const put = await fetch(signedUrl, {
                method: 'PUT',
                headers: { authorization: `Bearer ${token}`, 'content-type': file.type },
                body: file,
            });
            if (!put.ok) throw new Error('Upload failed. Try a different image.');

            // Contract is { publicUrl } in, { ok, error } out — the same call
            // ExpandedTile.jsx makes. Sending bucket/path instead produced a 400 on
            // every upload, and the response carries no publicUrl to read back.
            const verification = await apiFetch('/storage/verify-image', {
                method: 'POST',
                body: { publicUrl },
            });
            if (!verification.ok) {
                throw new Error(verification.error || 'That image was rejected. Try another one.');
            }
            // Functional update: an upload takes seconds, and reading the module here
            // would read the value captured at render, silently discarding anything typed
            // while it was in flight. The autosave would then persist the loss.
            wizard.setModule('basic_info', (current) => ({
                ...current,
                logo_url: `${publicUrl}?v=${Date.now()}`,
            }));
        } catch (err) {
            setUploadError(err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <>
            <p className="ob-eyebrow">Step 1 of 6</p>
            <h2 className="ob-h1">The basics</h2>
            <p className="ob-lede">
                This is what students see first — the name on your card, your logo, and a
                short description of what you actually do.
            </p>

            <Field label="Club name" value={data.club_name ?? clubName} max={LIMITS.CLUB_NAME_MAX}>
                <Text
                    value={data.club_name ?? clubName}
                    onChange={(v) => set({ club_name: v })}
                    placeholder="Northeastern Chess Club"
                />
            </Field>

            <Field
                label="Logo"
                hint="Square images look best. PNG or JPG, up to about 5 MB."
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {data.logo_url
                        ? <img className="ob-logo-preview" src={data.logo_url} alt="Your club logo" />
                        : <div className="ob-logo-preview" aria-hidden="true" />}
                    <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => uploadLogo(e.target.files?.[0])}
                        disabled={uploading}
                    />
                </div>
            </Field>
            {uploading && <p className="ob-hint">Uploading…</p>}
            {uploadError && <div className="ob-error">{uploadError}</div>}

            <Field
                label="What your club does"
                hint="Two or three sentences. Write it the way you'd explain it at a club fair."
                value={data.description}
                max={600}
            >
                <Area
                    value={data.description}
                    onChange={(v) => set({ description: v })}
                    rows={5}
                    placeholder="We meet weekly to play casual and rated chess, run a spring tournament, and send a team to the collegiate championships."
                />
            </Field>

            <Field label="Category" hint="One word or two — how a student would search for you.">
                <Text
                    value={details.category}
                    onChange={(v) => wizard.setDetails({ category: v })}
                    placeholder="Games"
                />
            </Field>

            <h3 className="ob-label" style={{ marginTop: 26, display: 'block' }}>Links</h3>
            <p className="ob-hint" style={{ marginBottom: 12 }}>
                Instagram, your website, a Discord invite — wherever students should go next.
            </p>

            <Repeater
                items={links}
                label="Link"
                addLabel="+ Add a link"
                max={MAX_LINKS}
                onAdd={() => setLinks([...links, { name: '', url: '' }])}
                onRemove={(i) => setLinks(links.filter((_, j) => j !== i))}
            >
                {(link, i) => (
                    <>
                        <Field label="Label" value={link.name} max={LIMITS.LINK_NAME_MAX}>
                            <Text
                                value={link.name}
                                onChange={(v) => setLinks(links.map((l, j) => (j === i ? { ...l, name: v } : l)))}
                                placeholder="Instagram"
                            />
                        </Field>
                        <Field label="Address">
                            <Text
                                type="url"
                                value={link.url}
                                onChange={(v) => setLinks(links.map((l, j) => (j === i ? { ...l, url: v } : l)))}
                                placeholder="https://instagram.com/yourclub"
                            />
                        </Field>
                    </>
                )}
            </Repeater>
        </>
    );
}
