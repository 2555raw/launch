-- Weekly prize: the walker with the most verified steps in a UTC week (Monday
-- to Sunday) wins weekly_prize USDG, credited as an approved reward of kind
-- 'prize' once the admin awards it. One prize per week.
alter table platform_settings add column if not exists weekly_prize numeric(12, 2) not null default 50;
create unique index if not exists rewards_weekly_prize_uq on rewards (period_start) where kind = 'prize';
