UPDATE pages
SET published_at = subquery.first_publish_time
FROM (SELECT id, TO_TIMESTAMP(meta ->> 'firstPublishTime', 'YYYY-MM-DD HH24:MI:SSZ') as first_publish_time
  FROM pages
  WHERE meta IS NOT NULL
  AND meta ->> 'firstPublishTime' IS NOT NULL) AS subquery
WHERE pages.id = subquery.id;
