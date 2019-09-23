UPDATE pages
SET created_at = subquery.created_at
FROM (SELECT id, meta ->> 'createdAt' as created_at
  FROM pages
  WHERE meta IS NOT NULL
  AND meta ->> 'createdAt' IS NOT NULL) AS subquery
WHERE pages.id = subquery.id;
