-- Reward rates: a day earns in proportion to its steps up to tier_threshold
-- (tier_avg at the threshold), then rises to tier_max at tier_cap and stays there.
--   0 … 7,000 steps      → 0 … $3.70
--   7,000 … 10,000 steps → $3.70 … $5.00
--   10,000+ steps        → $5.00
alter table platform_settings add column if not exists tier_cap integer not null default 10000;
update platform_settings
   set tier_min = 0, tier_avg = 3.70, tier_threshold = 7000, tier_max = 5.00, tier_cap = 10000, updated_at = now()
 where id = 1;
