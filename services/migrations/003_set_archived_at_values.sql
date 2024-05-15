UPDATE pages
SET archived_at = subquery.archive_date
FROM (SELECT DISTINCT ON (id) id,
  events ->> 'action' AS action,
  TO_TIMESTAMP(events ->> 'timestamp', 'YYYY-MM-DD HH24:MI:SSZ') AS archive_date
  FROM pages AS p,
    JSONB_ARRAY_ELEMENTS(p.meta -> 'history') AS events
  WHERE meta -> 'history' IS NOT NULL
    AND events ->> 'action' = 'archive'
  ORDER BY id, archive_date DESC) AS subquery
WHERE pages.id = subquery.id;
