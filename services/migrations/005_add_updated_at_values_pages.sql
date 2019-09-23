UPDATE pages
SET updated_at = subquery.updated_at
FROM (SELECT id, meta ->> 'updateTime' as updated_at
  FROM pages
  WHERE meta IS NOT NULL
  AND meta ->> 'updateTime' IS NOT NULL) AS subquery
WHERE pages.id = subquery.id;
