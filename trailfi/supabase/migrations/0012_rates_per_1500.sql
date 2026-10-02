-- Owner's rule: about $1 for every 1,500 steps, reaching the $5 maximum at
-- 10,000 steps. Between milestones a day pays the proportional amount.
update platform_settings
   set rate_points = '[[0, 0], [1500, 1], [3000, 2], [4500, 3], [6000, 4], [10000, 5]]',
       updated_at = now()
 where id = 1;
