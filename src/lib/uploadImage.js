import { apiFetch } from './api';

/**
 * Two-step signed image upload: ask the backend for a signed URL, PUT the bytes
 * directly to Supabase Storage (review_images bucket), and return the public URL.
 * Shared by modules that let editors upload images (club media, member roster).
 *
 * @param {File} file
 * @returns {Promise<string>} the public URL of the uploaded image
 */
export async function uploadImage(file) {
  const ext = file.name.split('.').pop() || 'jpg';
  const { signedUrl, publicUrl } = await apiFetch('/storage/review-upload-url', {
    method: 'POST',
    body: { ext },
  });
  const res = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return publicUrl;
}
