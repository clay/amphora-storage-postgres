UPDATE pages
SET unpublished_at = subquery.unpublish_date
FROM (SELECT DISTINCT ON (id) id,
  events ->> 'action' AS action,
  TO_TIMESTAMP(events ->> 'timestamp', 'YYYY-MM-DD HH24:MI:SSZ') AS unpublish_date
  FROM pages AS p,
    JSONB_ARRAY_ELEMENTS(p.meta -> 'history') AS events
  WHERE meta -> 'history' IS NOT NULL
    AND events ->> 'action' = 'unpublish'
  ORDER BY id, unpublish_date DESC) AS subquery
WHERE pages.id = subquery.id;
