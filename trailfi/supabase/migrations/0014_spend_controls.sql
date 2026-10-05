-- Spending controls for the owner.
--   daily_budget    most USDG that can be credited per UTC day by verifying uploads (0 = no limit)
--   signups_paused  when true, wallets without an account can't join; existing walkers carry on
alter table platform_settings add column if not exists daily_budget numeric(12, 2) not null default 0;
alter table platform_settings add column if not exists signups_paused boolean not null default false;
