-- Seed sample news rows for admin CMS
INSERT INTO news (slug, title, category, content_html, author, publish_date, status, featured_image, tags, created_by, updated_by, etag)
VALUES
('community-health', 'Community health outreach reaches 500 people', 'Health', '<p>Mobile clinics and health education reached hundreds with vaccinations and preventive care.</p>', 'TSD Comms', '2026-01-08', 'published', 'https://via.placeholder.com/800x400?text=Health', '["health","outreach"]', 'seed', 'seed', 'seed-etag-1'),
('solar-pumps', 'Solar pumps installation project', 'Water', '<p>Installing solar-powered pumps to improve access to clean water.</p>', 'TSD Comms', '2026-01-11', 'published', 'https://via.placeholder.com/800x400?text=Solar', '["water","energy"]', 'seed', 'seed', 'seed-etag-2'),
('volunteer-call', 'Volunteer call — March 2026', 'Volunteers', '<p>Seeking volunteers for upcoming outreach programs.</p>', 'TSD Comms', '2026-01-05', 'draft', NULL, '["volunteer"]', 'seed', 'seed', 'seed-etag-3');
