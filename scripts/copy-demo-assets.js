// One-off script: copies the club-page demo assets out of the personal user folders
// they were originally uploaded to and into the shared `demo_assets` bucket.
//
// Why: DEFAULT_MODULES (shared/clubPageDefaults.js) is seeded into every club that opens
// edit mode, so its media URLs are referenced by every page on the site. Those files
// currently sit under `review_images/<user id>/` and `club_media_videos/<user id>/`.
// review_images is in USER_OWNED_BUCKETS (server/routes/account.js), whose whole folder
// is removed when that account is deleted — which would 404 the demo media on every club
// page ever seeded, retroactively and silently.
//
// `demo_assets` is deliberately absent from every bucket allowlist in the app:
//   USER_OWNED_BUCKETS  server/routes/account.js      (account deletion)
//   USER_BUCKETS        server/routes/storage.js      (parseStorageUrl → verify/delete)
//   SAFE_BUCKETS        server/lib/imageModerator.js  (moderation delete)
// That omission is the protection. Do not add demo_assets to any of them.
//
// Copy only — nothing is deleted, and re-running is safe (upsert). The originals stay
// in place until you have verified the new URLs.
//
// Run from the repo root:
//   node scripts/copy-demo-assets.js            # dry run, shows the plan
//   node scripts/copy-demo-assets.js --apply    # actually copies

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const DEST_BUCKET = 'demo_assets';

const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env).');
  process.exit(1);
}

const supabase = createClient(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const publicUrl = (bucket, path) =>
  `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;

const OWNER = '2b8a72c6-0fc8-41ec-a906-f8481c6303b0';

// Destination names describe each file's ROLE in the template, not its contents — that
// is the part that stays true, and `kljq99nh2yjmtv6uljf.mov` tells a maintainer nothing.
const FILES = [
  // Poster blobs (one per poster card)
  ['review_images', `${OWNER}/nlofkubox2mtv5o1jq.jpg`,  'posters/demo.jpg'],
  ['review_images', `${OWNER}/ghy4uoh1gqpmtv7flq0.png`, 'posters/retreat.png'],
  ['review_images', `${OWNER}/day5e7mxi7mtv7iocd.jpeg`, 'posters/the-peak.jpeg'],
  ['review_images', `${OWNER}/ntcbfs5kbldmtv7eyka.png`, 'posters/appalachian-trails.png'],

  // Photos inside the "Demo (Click)" poster
  ['review_images', `${OWNER}/i1sef0k3l3mtv6pqt8.jpg`,  'photos/day1-photo-1.jpg'],
  ['review_images', `${OWNER}/r52ne3tmtcmtv6oah6.jpg`,  'photos/day1-photo-2.jpg'],

  // Member roster
  ['review_images', `${OWNER}/iuab8sxbadmtv4n8ux.png`,  'members/rac.png'],
  ['review_images', `${OWNER}/ktmtzegmoecmtv4ckz9.jpg`, 'members/hoosky.jpg'],
  ['review_images', `${OWNER}/qu8qti8mpwmtv4rye8.jpeg`, 'members/duo.jpeg'],

  // Short videos, in the order they appear in the poster
  ['club_media_videos', `${OWNER}/kljq99nh2yjmtv6uljf.mov`, 'videos/day1-clip-1.mov'],
  ['club_media_videos', `${OWNER}/2ukpi4nxpg3mtv6ucqd.mov`, 'videos/day1-clip-2.mov'],
  ['club_media_videos', `${OWNER}/328as06r8limtv6tq1y.mov`, 'videos/day1-clip-3.mov'],
  ['club_media_videos', `${OWNER}/tw88o64gztfmtv6pxoh.mov`, 'videos/day2-clip-1.mov'],
];

const CONTENT_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
  mov: 'video/quicktime', mp4: 'video/mp4', webm: 'video/webm', m4v: 'video/x-m4v',
};
const contentTypeFor = (p) => CONTENT_TYPES[p.split('.').pop().toLowerCase()] ?? 'application/octet-stream';

// Fail loudly if the bucket is missing rather than letting every upload 404 in turn.
const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
if (bucketErr) {
  console.error('Could not list buckets:', bucketErr.message);
  process.exit(1);
}
const dest = buckets.find((b) => b.name === DEST_BUCKET);
if (!dest) {
  console.error(`Bucket "${DEST_BUCKET}" does not exist. Create it first:`);
  console.error('  Supabase dashboard → Storage → New bucket → name "demo_assets", Public ✓');
  console.error('Public matters: these are served from /object/public/, a private bucket 404s for visitors.');
  process.exit(1);
}
if (!dest.public) {
  console.error(`Bucket "${DEST_BUCKET}" exists but is PRIVATE. Demo media is served from`);
  console.error('/object/public/, so every URL would 404. Flip it to Public and re-run.');
  process.exit(1);
}

console.log(`${APPLY ? 'COPYING' : 'DRY RUN'} — ${FILES.length} files → ${DEST_BUCKET}\n`);

const mapping = {};
let copied = 0, failed = 0;

for (const [srcBucket, srcPath, destPath] of FILES) {
  const from = publicUrl(srcBucket, srcPath);
  const to = publicUrl(DEST_BUCKET, destPath);
  mapping[from] = to;

  if (!APPLY) {
    console.log(`  ${srcBucket}/${srcPath.replace(OWNER + '/', '')}\n    -> ${DEST_BUCKET}/${destPath}`);
    continue;
  }

  try {
    // Read through the public URL rather than storage.download(): it is the same bytes,
    // and it doubles as a check that the source is actually reachable as the app sees it.
    const res = await fetch(from);
    if (!res.ok) throw new Error(`source fetch ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());

    const { error } = await supabase.storage
      .from(DEST_BUCKET)
      .upload(destPath, body, { contentType: contentTypeFor(destPath), upsert: true });
    if (error) throw new Error(error.message);

    console.log(`  ✓ ${destPath}  (${(body.length / 1024).toFixed(0)} KB)`);
    copied++;
  } catch (err) {
    console.error(`  ✗ ${destPath}  — ${err.message}`);
    failed++;
  }
}

const outFile = 'scripts/demo-asset-url-map.json';
writeFileSync(outFile, JSON.stringify(mapping, null, 2) + '\n');

console.log();
if (APPLY) {
  console.log(`Copied ${copied}/${FILES.length}${failed ? `, ${failed} failed` : ''}.`);
  if (failed) process.exitCode = 1;
} else {
  console.log('Nothing written. Re-run with --apply to copy.');
}
console.log(`URL map written to ${outFile} (old → new, for rewriting DEFAULT_MODULES).`);
