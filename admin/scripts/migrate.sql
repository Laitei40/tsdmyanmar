-- News table for admin CMS
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT,
  content_html TEXT NOT NULL,
  author TEXT NOT NULL,
  publish_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','published','archived')),
  featured_image TEXT,
  tags TEXT, -- JSON array of strings
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  etag TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS news_changelog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  news_id INTEGER NOT NULL,
  action TEXT NOT NULL, -- create/update/delete
  actor TEXT NOT NULL,
  snapshot TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(news_id) REFERENCES news(id)
);

CREATE INDEX IF NOT EXISTS idx_news_status_date ON news(status, publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);
CREATE INDEX IF NOT EXISTS idx_news_slug ON news(slug);
