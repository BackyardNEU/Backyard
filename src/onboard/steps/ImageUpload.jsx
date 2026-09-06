import { useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { FieldGroup } from './fields.jsx';

/**
 * Upload a single image and show it back, with a way to remove it.
 *
 * Shared by the club logo and event posters so the two cannot drift. They hit different
 * endpoints and different buckets, but the sequence is identical: ask the server for a
 * signed URL, PUT the bytes straight to storage, then have the server verify the file is
 * really an image and run it past moderation.
 *
 * The file input is inside a plain <div>, never a <label>. A file input nested in its own
 * label receives the click twice and the picker never opens.
 */
export default function ImageUpload({
    label,
    hint,
    value,
    onChange,
    endpoint,
    body = {},
    shape = 'square',
}) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);

    const upload = async (file) => {
        if (!file) return;
        setUploading(true);
        setError(null);
        try {
            const ext = (file.name.split('.').pop() || 'png').toLowerCase();
            const { signedUrl, token, publicUrl } = await apiFetch(endpoint, {
                method: 'POST',
                body: { ...body, ext },
            });

            const put = await fetch(signedUrl, {
                method: 'PUT',
                headers: { authorization: `Bearer ${token}`, 'content-type': file.type },
                body: file,
            });
            if (!put.ok) throw new Error('That upload did not go through. Try again.');

            const verification = await apiFetch('/storage/verify-image', {
                method: 'POST',
                body: { publicUrl },
            });
            if (!verification.ok) {
                throw new Error(verification.error || 'That image was rejected. Try another one.');
            }

            // Cache-bust: logo paths are deterministic, so a replacement keeps its URL and
            // the browser would keep showing the old file.
            onChange(`${publicUrl}?v=${Date.now()}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const clear = () => {
        onChange('');
        // Without this the same file cannot be re-picked: the input still holds it, so
        // choosing it again fires no change event.
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <FieldGroup label={label} hint={hint}>
            <div className="ob-upload">
                {value
                    ? <img className={`ob-preview ob-preview--${shape}`} src={value} alt={`${label} preview`} />
                    : <div className={`ob-preview ob-preview--${shape}`} aria-hidden="true" />}

                <div className="ob-upload-controls">
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => upload(e.target.files?.[0])}
                        disabled={uploading}
                    />
                    {uploading && <span className="ob-hint">Uploading…</span>}
                    {value && !uploading && (
                        <button type="button" className="ob-remove-image" onClick={clear}>
                            Remove this image
                        </button>
                    )}
                </div>
            </div>

            {error && <div className="ob-error" style={{ marginTop: 10 }}>{error}</div>}
        </FieldGroup>
    );
}
