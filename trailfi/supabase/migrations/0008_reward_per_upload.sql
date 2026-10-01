-- Verifying a day's upload now credits that day's reward straight away
-- (status 'approved'), instead of waiting for a distribution run.
alter table rewards alter column distribution_id drop not null;
alter table rewards add column if not exists step_entry_id uuid references step_entries(id) on delete set null;
create unique index if not exists rewards_step_entry_uq on rewards (step_entry_id) where step_entry_id is not null;
