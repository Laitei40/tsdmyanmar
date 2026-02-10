-- TSD Myanmar News Database Schema
-- Run: wrangler d1 execute tsd_updates --local --persist-to .wrangler/state --file=admin/scripts/schema.sql

DROP TABLE IF EXISTS news_changelog;
DROP TABLE IF EXISTS news;

-- Core news table with i18n JSON fields
CREATE TABLE news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '{}',         -- JSON: {"en":"...","mrh":"...","my":"..."}
  summary TEXT NOT NULL DEFAULT '{}',       -- JSON i18n
  body TEXT NOT NULL DEFAULT '{}',          -- JSON i18n (HTML content)
  category TEXT,                            -- news | report | announcement | story
  content_html TEXT NOT NULL DEFAULT '',    -- legacy column (unused, kept for compat)
  author TEXT NOT NULL,
  publish_date TEXT NOT NULL,               -- YYYY-MM-DD
  status TEXT NOT NULL CHECK (status IN ('draft','published','archived')),
  featured_image TEXT,
  tags TEXT,                                -- JSON array: ["tag1","tag2"]
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  etag TEXT NOT NULL
);

-- Audit log
CREATE TABLE news_changelog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  news_id INTEGER NOT NULL,
  action TEXT NOT NULL,                     -- create | update | delete
  actor TEXT NOT NULL,
  snapshot TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(news_id) REFERENCES news(id)
);

-- Performance indexes
CREATE INDEX idx_news_status_date ON news(status, publish_date DESC);
CREATE INDEX idx_news_category ON news(category);
CREATE INDEX idx_news_slug ON news(slug);

-- ============================================================
-- Seed: Sample published articles (one per language) for dev/testing
-- ============================================================

INSERT INTO news (slug, title, summary, body, category, content_html, author, publish_date, status, featured_image, tags, created_by, updated_by, etag)
VALUES
-- English-only article
(
  'community-health-initiative-2026',
  '{"en":"Community Health Initiative Launches in Chin State","mrh":"","my":""}',
  '{"en":"TSD Myanmar partners with local clinics to bring essential healthcare services to remote communities in Chin State.","mrh":"","my":""}',
  '{"en":"<h2>Bringing Healthcare to Remote Communities</h2><p>In January 2026, TSD Myanmar launched a new community health initiative in partnership with local clinics across <strong>Chin State</strong>. The program focuses on maternal healthcare, childhood immunization, and health education.</p><p>Our team of trained health workers has already reached over <strong>500 families</strong> in the first month, providing essential check-ups and distributing medical supplies to underserved villages.</p><blockquote>Healthcare is a fundamental right, not a privilege. We are committed to ensuring every community has access to basic medical services.</blockquote><p>The initiative will expand to three additional townships by mid-2026, with plans to establish permanent health posts in collaboration with the Ministry of Health.</p>","mrh":"","my":""}',
  'news',
  '',
  'TSD Communications',
  '2026-01-15',
  'published',
  NULL,
  '["health","chin-state","community"]',
  'dev@localhost',
  'dev@localhost',
  'seed-0001'
),
-- Mara (Chin) language article
(
  'mara-community-health-program',
  '{"en":"","mrh":"Mara Rama Ram Hriamnakih Program","my":""}',
  '{"en":"","mrh":"TSD Myanmar nih Mara rama sungah ram hriamnakih program a tlâng tih, innchûng tam takte a bâwih.","my":""}',
  '{"en":"","mrh":"<h2>Ram Hriamnakih Chhuihthâna</h2><p>TSD Myanmar nih Mara rama sungah ram hriamnakih program a tlâng tih. Ram hriamnakih sipâ paih thâr 45 pa ei training kha zo tih.</p><p>Hei program nih nâu nei pa hriamnakih, ngahchia châbeih, leh hriammi do aw kha a bâwih. Ram hriamnakih sipâ paih thâr ei training a pêh tih, hriamnakih rawl leh sii hna kha ram hriamnakih a thlâk lo miphûn hna hnênah a pêh tih.</p><blockquote>Hriamnakih cu miphûn po po ih a tlâkah a si. Khuavêng tawlh lo ih ram hriamnakih kha ei lo thei aw kha TSD ei bâwih.</blockquote><p>2026 khâ karlâk ah township thum ah a phanh saw aw tih.</p>","my":""}',
  'news',
  '',
  'TSD Communications',
  '2026-02-09',
  'published',
  NULL,
  '["health","mara","community"]',
  'dev@localhost',
  'dev@localhost',
  'seed-0002'
),
-- Burmese (Myanmar) language article
(
  'myanmar-education-expansion',
  '{"en":"","mrh":"","my":"မြန်မာနိုင်ငံတွင် ပညာရေးအစီအစဥ် တိုးချဲ့ခြင်း"}',
  '{"en":"","mrh":"","my":"TSD Myanmar သည် ပညာရေးအစီအစဥ်များကို မြို့နယ်သစ် သုံးခုသို့ တိုးချဲ့လိုက်ပါသည်။"}',
  '{"en":"","mrh":"","my":"<h2>ပညာရေးအတွက် ကျွန်ုပ်တို့၏ လုပ်ဆောင်မှုများ</h2><p>ကျွန်ုပ်တို့၏ ပညာရေးလုပ်ငန်းများကို မြန်မာနိုင်ငံရှိ မြို့နယ်သစ် <strong>သုံးခု</strong>သို့ တိုးချဲ့ကြောင်း ဝမ်းမြောက်စွာ ကြေညာအပ်ပါသည်။</p><p>ဤတိုးချဲ့မှုသည် ကျောင်းသား <strong>၅၀၀</strong> ကျော်အတွက် အရည်အသွေးမြင့် သင်ယူရေးအရင်းအမြစ်များ ရရှိနိုင်ရန် ဆောင်ရွက်ပေးမည်ဖြစ်ပါသည်။ ကျောင်းသုံးပစ္စည်းများ၊ ဆရာအတတ်ပညာ သင်တန်းများနှင့် ဒစ်ဂျစ်တယ် စာတတ်မြောက်ရေး သင်တန်းများ ပါဝင်ပါသည်။</p><blockquote>ပညာရေးသည် အနာဂတ်ကို ပုံဖော်ရန် အကောင်းဆုံး နည်းလမ်းဖြစ်သည်။ ကျွန်ုပ်တို့သည် အသိုက်အဝန်းတိုင်းတွင် အရည်အသွေးမြင့် ပညာရေး ရရှိနိုင်ရန် ကတိပြုပါသည်။</blockquote><p>ကျွန်ုပ်တို့၏ မိတ်ဖက်များနှင့် အလှူရှင်များကို ကျေးဇူးတင်ပါသည်။</p>"}',
  'news',
  '',
  'Education Team',
  '2026-02-10',
  'published',
  NULL,
  '["education","myanmar","expansion"]',
  'dev@localhost',
  'dev@localhost',
  'seed-0003'
);
