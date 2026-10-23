DROP INDEX IF EXISTS idx_sale_items_sold;

DROP INDEX IF EXISTS idx_customers_name;

CREATE VIEW IF NOT EXISTS v_item_costs AS
SELECT si.sold_id,
       si.buy_id,
       b.product_name,
       si.quantity,
       ROUND(b.purchase_cost / b.quantity, 2) AS unit_cost,
       ROUND(b.associated_costs / b.quantity, 2) AS unit_assoc
FROM sale_items si
JOIN buys b ON b.id = si.buy_id;

CREATE VIEW IF NOT EXISTS v_sold_costs AS
SELECT s.id AS sold_id,
       s.sale_price,
       s.associated_costs,
       COALESCE(ic.cogs_purchase, 0) AS cogs_purchase,
       COALESCE(ic.cogs_associated, 0) AS cogs_associated,
       s.sale_price - s.associated_costs
         - COALESCE(ic.cogs_purchase, 0)
         - COALESCE(ic.cogs_associated, 0) AS profit
FROM solds s
LEFT JOIN (
  SELECT sold_id,
         SUM(quantity * unit_cost) AS cogs_purchase,
         SUM(quantity * unit_assoc) AS cogs_associated
  FROM v_item_costs
  GROUP BY sold_id
) ic ON ic.sold_id = s.id;
