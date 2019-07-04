UPDATE uris
SET site_id = subquery.site_slug
FROM (SELECT id, meta ->> 'siteSlug' as site_slug
  FROM pages
  WHERE meta IS NOT NULL
  AND meta ->> 'siteSlug' IS NOT NULL) AS subquery
WHERE uris.data = subquery.id;
