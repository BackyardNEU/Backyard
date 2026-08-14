import { Field, FieldGroup, Text, Area, Repeater, LIMITS } from './fields.jsx';
import { normalizeUrl } from '../../../shared/clubPageValidation.js';
import CategoryPicker from './CategoryPicker.jsx';
import ImageUpload from './ImageUpload.jsx';

const MAX_LINKS = 5;

export default function Basics({ wizard, clubId, clubName }) {
    const data = wizard.getModule('basic_info') ?? {};
    const links = data.links ?? [];

    // The scraped club name is a starting point, not an answer — plenty of directory
    // entries are stale or abbreviated.
    const set = (patch) => wizard.setModule('basic_info', { ...data, club_name: data.club_name ?? clubName, ...patch });
    const setLinks = (next) => set({ links: next });


    return (
        <>
            <h2 className="ob-h1">The basics</h2>
            <p className="ob-lede">
                This is what students see first: your name, your logo, and what the club
                actually does.
            </p>

            <Field label="Club name" value={data.club_name ?? clubName} max={LIMITS.CLUB_NAME_MAX}>
                <Text
                    value={data.club_name ?? clubName}
                    onChange={(v) => set({ club_name: v })}
                    placeholder="Northeastern Chess Club"
                />
            </Field>

            <ImageUpload
                label="Club Logo"
                hint="Square images look best. PNG, JPG or WebP, up to about 5 MB."
                value={data.logo_url}
                endpoint="/storage/club-logo-upload-url"
                body={{ club_id: clubId }}
                onChange={(url) => set({ logo_url: url })}
            />

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

            <CategoryPicker wizard={wizard} />

            <h3 className="ob-label" style={{ marginTop: 26, display: 'block' }}>Links</h3>
            <p className="ob-hint" style={{ marginBottom: 12 }}>
                Instagram, your website, a Discord invite. Anywhere students should go next.
            </p>

            <Repeater
                items={links}
                label="Link"
                addLabel="+ Add a link"
                max={MAX_LINKS}
                onAdd={() => setLinks([...links, { name: '', url: '', enabled: true }])}
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
                        <Field label="Address" hint="Paste it however you have it. We'll tidy it up.">
                            <Text
                                // Deliberately not type="url": the browser applies the same
                                // rule that caused this, marking "instagram.com/ourclub"
                                // invalid because it has no scheme.
                                value={link.url}
                                onChange={(v) => setLinks(links.map((l, j) => (j === i ? { ...l, url: v } : l)))}
                                // Fill in the scheme once they move on, so they see the
                                // finished link rather than being told theirs is wrong.
                                onBlur={(e) => {
                                    const tidy = normalizeUrl(e.target.value);
                                    if (tidy && tidy !== link.url) {
                                        setLinks(links.map((l, j) => (j === i ? { ...l, url: tidy } : l)));
                                    }
                                }}
                                placeholder="instagram.com/yourclub"
                            />
                        </Field>
                    </>
                )}
            </Repeater>
        </>
    );
}
