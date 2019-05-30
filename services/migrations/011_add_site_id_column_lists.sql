ALTER TABLE IF EXISTS lists
ADD COLUMN IF NOT EXISTS site_id VARCHAR(255);

UPDATE lists
SET site_id = (SELECT LEFT(id, STRPOS(id, '/_lists') - 1) FROM lists LIMIT 1);
