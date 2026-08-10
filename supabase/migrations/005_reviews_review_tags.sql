-- reviews.review_tags does not exist in the database, but five server routes read it and
-- the review form writes it (it is in REVIEW_WRITABLE). Every read 502s with:
--
--   column reviews.review_tags does not exist
--
-- Breaks GET /clubs/review-tags, GET /clubs/:id/top-tags (so club cards render without
-- their tag line), and the tag-boost half of natural-language search, which re-ranks
-- results by matching review tags.
--
-- text[] because the code treats it as an array throughout: Array.isArray() guards in
-- ClubDataProvider, .includes() in search.js, and an unnest(review_tags) query sketched
-- in clubPage.js. Defaults to empty so existing reviews read back as "no tags" rather
-- than null, which the Array.isArray guards would otherwise skip anyway.

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS review_tags text[] NOT NULL DEFAULT '{}';

-- GIN supports the array containment and unnest patterns these routes use.
CREATE INDEX IF NOT EXISTS idx_reviews_review_tags
  ON reviews USING GIN (review_tags);
