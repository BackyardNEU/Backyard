import { apiFetch } from './api';

/**
 * Two-step signed video upload: ask the backend for a signed URL, PUT the bytes
 * directly to Supabase Storage (club_media_videos bucket), and return the public URL.
 *
 * @param {File} file
 * @returns {Promise<string>} the public URL of the uploaded video
 */
export async function uploadVideo(file) {
  const ext = file.name.split('.').pop() || 'mp4';
  const { signedUrl, publicUrl } = await apiFetch('/storage/club-media-video-upload-url', {
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
