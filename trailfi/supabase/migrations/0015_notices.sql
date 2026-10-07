-- Walkers get a notice the next time they open Stepit when one of their uploads
-- is reviewed or a payout lands. These columns remember which ones they saw.
alter table step_entries add column if not exists result_seen_at timestamptz;
alter table payouts add column if not exists seen_at timestamptz;
