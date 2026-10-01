-- Rates as a list of milestones [steps, amount]; a day pays the straight-line
-- value between the two milestones around its step count, and the last amount
-- from the last milestone on.
alter table platform_settings
  add column if not exists rate_points jsonb not null default '[[0, 0], [3500, 2.25], [7000, 3.7], [10000, 5]]';
update platform_settings set rate_points = '[[0, 0], [3500, 2.25], [7000, 3.7], [10000, 5]]', updated_at = now() where id = 1;
