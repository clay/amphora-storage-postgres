ALTER TABLE IF EXISTS pages
ADD COLUMN IF NOT EXISTS site_id VARCHAR(255);

UPDATE pages
SET site_id = (SELECT LEFT(id, STRPOS(id, '/_pages') - 1) FROM pages LIMIT 1);
