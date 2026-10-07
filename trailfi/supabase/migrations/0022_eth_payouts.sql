-- Payouts move from USDG to native ETH on Robinhood Chain. Rewards stay in US
-- dollars; each payout converts its dollar total to ETH at a spot price taken
-- when it is created (or requoted) and remembers both. Native ETH is stored
-- under the 0xEeee…EEeE sentinel address with 18 decimals. Nothing is paid out
-- right now (the data was just reset), so switching the token is safe.
update platform_settings
   set payout_token_symbol = 'ETH',
       payout_token_address = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
       payout_token_decimals = 18,
       updated_at = now()
 where id = 1;

-- An ETH amount needs all 18 decimals to match the wei sent on chain.
alter table payouts alter column amount type numeric(38, 18);

-- The dollar value a native payout stands for (same scale as rewards.amount),
-- the ETH/USD price used to convert it and when that price was taken. All stay
-- null for ERC20 payouts, where amount is already the dollar stablecoin.
alter table payouts add column if not exists usd_amount numeric(24, 6);
alter table payouts add column if not exists eth_usd_price numeric(14, 2);
alter table payouts add column if not exists quoted_at timestamptz;

-- Rewards waiting to be paid are dollar amounts either way: label them with the
-- new payout token so they can still be paid (there should be none after the reset).
update rewards set token_symbol = 'ETH'
 where token_symbol = 'USDG' and status in ('pending', 'approved') and payout_id is null;
