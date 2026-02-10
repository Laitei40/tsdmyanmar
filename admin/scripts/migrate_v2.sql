-- Migration v2: Consolidate news + updates tables
-- The admin now manages a single `news` table with i18n JSON fields.
-- The old `updates` table data is migrated into `news`.
-- Run: wrangler d1 execute tsd_updates --file=scripts/migrate_v2.sql

-- 1. Add new columns to news table (summary, body as JSON i18n fields)
ALTER TABLE news ADD COLUMN summary TEXT DEFAULT '{}';
ALTER TABLE news ADD COLUMN body TEXT DEFAULT '{}';

-- 2. Convert existing flat title/content_html to i18n JSON
--    title (flat string) → title JSON: {"en": "<old value>"}
--    content_html → body JSON: {"en": "<old value>"}
UPDATE news SET
  title   = json_object('en', title),
  summary = '{}',
  body    = json_object('en', content_html)
WHERE json_valid(title) = 0;

-- 3. Migrate rows from old `updates` table into `news` (skip duplicates)
INSERT OR IGNORE INTO news (slug, title, summary, body, category, author, publish_date, status, featured_image, tags, created_by, updated_by, etag)
SELECT
  'update-' || id,      -- slug
  title,                 -- already JSON i18n
  COALESCE(summary,'{}'),
  COALESCE(body,'{}'),
  NULL,                  -- category
  'TSD Comms',           -- author
  date,                  -- publish_date
  'published',           -- status
  NULL,                  -- featured_image
  NULL,                  -- tags
  'migration',           -- created_by
  'migration',           -- updated_by
  hex(randomblob(8))     -- etag
FROM updates
WHERE NOT EXISTS (SELECT 1 FROM news n WHERE n.slug = 'update-' || updates.id);

-- 4. content_html column is now redundant (kept for backward compat, not used)
-- DROP COLUMN not supported in SQLite; leave as nullable unused column.

-- 5. Ensure indexes
CREATE INDEX IF NOT EXISTS idx_news_status_date ON news(status, publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);
CREATE INDEX IF NOT EXISTS idx_news_slug ON news(slug);
