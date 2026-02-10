INSERT OR IGNORE INTO news (slug, title, summary, body, author, publish_date, status, created_by, updated_by, etag)
VALUES
  ('test-article',
   '{"en":"Test Article","mrh":"Test Mrh","my":"Test My"}',
   '{"en":"Summary of the test article."}',
   '{"en":"<p>This is the body of the test article.</p>"}',
   'TSD Admin', '2025-01-15', 'published', 'seed', 'seed', 'test-etag-1'),
  ('draft-article',
   '{"en":"Draft Article"}',
   '{"en":"This is a draft."}',
   '{"en":"<p>Draft body content.</p>"}',
   'TSD Admin', '2025-02-01', 'draft', 'seed', 'seed', 'test-etag-2');
