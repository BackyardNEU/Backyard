import { supabaseAdmin } from '../supabaseAdmin.js';

const LIKELIHOOD = {
  UNKNOWN: 0,
  VERY_UNLIKELY: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  VERY_LIKELY: 5,
};

const DEFAULT_THRESHOLDS = {
  adult: 2,
  violence: 2,
  racy: 3,
  medical: 3,
  spoof: null,
};

class ImageModerator {
  constructor(apiKey, thresholds = {}) {
    if (!apiKey) throw new Error('CLOUD_VISION_API key is required');
    this.apiKey = apiKey;
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  async scan(imageUrl) {
    const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { source: { imageUri: imageUrl } },
          features: [{ type: 'SAFE_SEARCH_DETECTION' }],
        }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Cloud Vision API error (${response.status}): ${text}`);
    }

    const result = await response.json();
    const annotation = result.responses?.[0]?.safeSearchAnnotation;
    if (!annotation) {
      throw new Error('No SafeSearch annotation returned from Cloud Vision API');
    }

    const violations = [];
    for (const [category, threshold] of Object.entries(this.thresholds)) {
      if (threshold === null) continue;
      const level = LIKELIHOOD[annotation[category]] ?? 0;
      if (level >= threshold) {
        violations.push({ category, level, threshold });
      }
    }

    return violations.length === 0
      ? { safe: true }
      : { safe: false, violations };
  }

  async recordStrike(userId, category, details = {}) {
    const now = new Date();

    await supabaseAdmin.from('content_strikes').insert({
      user_id: userId,
      category,
      details,
      created_at: now.toISOString(),
    });

    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const { count, error } = await supabaseAdmin
      .from('content_strikes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo.toISOString());

    if (error) throw new Error(`Strike count query failed: ${error.message}`);

    if (count >= 3) {
      const mutedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      await supabaseAdmin
        .from('profiles')
        .update({ muted_until: mutedUntil })
        .eq('id', userId);
      return { muted: true, mutedUntil, strikes: count };
    }

    return { muted: false, strikes: count };
  }

  async deleteFromStorage(publicUrl, allowedBuckets) {
    const SAFE_BUCKETS = allowedBuckets || new Set([
      'profile_images', 'review_images', 'profile_photos',
      'club_logos', 'event_posters', 'club_media_videos',
    ]);
    try {
      const url = new URL(publicUrl);
      const supabaseHost = new URL(process.env.SUPABASE_URL).hostname;
      if (url.hostname !== supabaseHost || url.protocol !== 'https:') return;

      const parts = url.pathname.split('/storage/v1/object/public/');
      if (parts.length !== 2) return;
      const segments = parts[1].split('/');
      const bucket = segments[0];
      if (!SAFE_BUCKETS.has(bucket)) return;

      const path = segments.slice(1).join('/');
      await supabaseAdmin.storage.from(bucket).remove([path]);
    } catch (err) {
      console.error(`Failed to delete ${publicUrl}:`, err.message);
    }
  }
}

export { ImageModerator, LIKELIHOOD, DEFAULT_THRESHOLDS };
