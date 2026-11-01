-- Payments collected after an order was placed never updated its stored
-- payment_status. Recompute it from the ledger (IN on the order's live
-- receivable, net of reversals). Cancelled orders are left as they are.
WITH paid AS (
  SELECT d.wholesale_order_id AS order_id,
         COALESCE(SUM(CASE WHEN le.direction = 'IN' THEN le.amount ELSE -le.amount END), 0) AS amount
  FROM dues d
  LEFT JOIN ledger_entries le ON le.due_id = d.id
  WHERE d.wholesale_order_id IS NOT NULL AND d.voided_at IS NULL AND d.kind = 'RECEIVABLE'
  GROUP BY d.wholesale_order_id
)
UPDATE wholesale_orders o
SET payment_status = CASE
  WHEN p.amount <= 0 THEN 'UNPAID'::"WholesalePaymentStatus"
  WHEN p.amount >= o.total THEN 'PAID'::"WholesalePaymentStatus"
  ELSE 'PARTIALLY_PAID'::"WholesalePaymentStatus"
END
FROM paid p
WHERE p.order_id = o.id AND o.status <> 'CANCELLED';
