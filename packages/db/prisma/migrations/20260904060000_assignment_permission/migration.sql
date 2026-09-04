-- A separate permission for changing WHO a piece of work is assigned to:
-- the assignee on an order (Order Manager) and on a customer (Customer
-- Manager). One key covers both, and it is required in addition to the
-- area's own manage permission, never instead of it.
INSERT INTO "permissions" ("resource", "action", "key")
VALUES ('assignment', 'manage', 'assignment.manage')
ON CONFLICT ("key") DO NOTHING;

-- Every role that can already manage orders or customers keeps the ability it
-- has today, so nothing breaks the moment this deploys. Narrowing is then a
-- deliberate act: the super admin unticks the box for the roles that should
-- not be able to reassign.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT DISTINCT rp."role_id", target."id"
FROM "role_permissions" rp
JOIN "permissions" p ON p."id" = rp."permission_id"
CROSS JOIN (SELECT "id" FROM "permissions" WHERE "key" = 'assignment.manage') target
WHERE p."key" IN ('net_profit_orders.manage', 'customer.manage')
ON CONFLICT DO NOTHING;
