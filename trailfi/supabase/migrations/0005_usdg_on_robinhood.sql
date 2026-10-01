-- Stepit pays on Robinhood Chain, where the dollar stablecoin is USDG
-- (0x5fc5…d168, 6 decimals). Replace the original Base Sepolia USDC
-- default, but leave any token an admin has already chosen.
update platform_settings
   set payout_token_symbol = 'USDG',
       payout_token_address = '0x5fc5360d0400a0fd4f2af552add042d716f1d168',
       payout_token_decimals = 6,
       updated_at = now()
 where id = 1
   and payout_token_address = '0x036cbd53842c5426634e7929541ec2318f3dcf7e';
