-- The hardcoded section rendered after every managed section. Seed it as a real
-- section in that same place (last), active, with the same heading and the
-- same tags (empty tagIds = first 6 published), so the live homepage looks
-- identical until an admin edits or hides it. Skipped if one already exists.
WITH new_section AS (
  INSERT INTO "homepage_sections" ("type", "sort_order", "is_active", "config", "updated_at")
  SELECT 'HEALTH_CONCERN', COALESCE(MAX("sort_order"), -1) + 1, true, '{"tagIds": []}'::jsonb, CURRENT_TIMESTAMP
  FROM "homepage_sections"
  WHERE NOT EXISTS (SELECT 1 FROM "homepage_sections" WHERE "type" = 'HEALTH_CONCERN')
  RETURNING "id"
)
INSERT INTO "homepage_section_translations" ("section_id", "locale", "heading")
SELECT new_section."id", l."locale"::"Locale", 'Shop By Health Concern'
FROM new_section CROSS JOIN (VALUES ('EN'), ('BN')) AS l("locale");
