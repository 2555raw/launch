-- Referrals: every walker gets a code; a newcomer who signs in through it is
-- linked to the referrer, and when the newcomer's first upload is verified
-- both receive referral_bonus as an approved reward (kind = 'referral').
alter table users add column if not exists referral_code text;
alter table users add column if not exists referred_by uuid references users(id) on delete set null;
alter table users add column if not exists referral_rewarded_at timestamptz;
create unique index if not exists users_referral_code_uq on users (referral_code) where referral_code is not null;
create index if not exists users_referred_by_idx on users (referred_by);
alter table rewards add column if not exists kind text not null default 'steps';
alter table platform_settings add column if not exists referral_bonus numeric(12, 2) not null default 1;
