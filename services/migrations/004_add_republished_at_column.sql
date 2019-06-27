ALTER TABLE IF EXISTS pages
ADD COLUMN IF NOT EXISTS republished_at TIMESTAMPTZ;

UPDATE pages
SET published_at = subquery.republish_time
FROM (SELECT id, TO_TIMESTAMP(meta ->> 'publishTime', 'YYYY-MM-DD HH24:MI:SSZ') AS republish_time
  FROM pages
  WHERE meta IS NOT NULL
  AND meta ->> 'publishTime' IS NOT NULL) AS subquery
WHERE pages.id = subquery.id;
