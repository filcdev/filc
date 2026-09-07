UPDATE "role"
SET "can" = array_append("can", 'navigator:manage')
WHERE "name" = 'admin'
  AND NOT ('navigator:manage' = ANY ("can"));
