use anchor_lang::prelude::*;

declare_id!("LaunchRegistry11111111111111111111111111111");

/// Records that `mint` was launched by `creator` through the Launch launchpad.
/// One PDA per mint: seeds = ["launch", mint].
#[program]
pub mod launch_registry {
    use super::*;

    pub fn register_launch(ctx: Context<RegisterLaunch>, metadata_uri: String, total_supply: u64, decimals: u8) -> Result<()> {
        require!(metadata_uri.len() <= 200, LaunchError::UriTooLong);
        let launch = &mut ctx.accounts.launch;
        launch.creator = ctx.accounts.creator.key();
        launch.mint = ctx.accounts.mint.key();
        launch.metadata_uri = metadata_uri;
        launch.total_supply = total_supply;
        launch.decimals = decimals;
        launch.created_at = Clock::get()?.unix_timestamp;
        launch.bump = ctx.bumps.launch;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(metadata_uri: String)]
pub struct RegisterLaunch<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    /// CHECK: the mint is only used as a PDA seed; its validity is enforced by the Token-2022 program when it is created in the same transaction.
    pub mint: UncheckedAccount<'info>,
    #[account(
        init,
        payer = creator,
        space = 8 + Launch::INIT_SPACE,
        seeds = [b"launch", mint.key().as_ref()],
        bump
    )]
    pub launch: Account<'info, Launch>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Launch {
    pub creator: Pubkey,
    pub mint: Pubkey,
    #[max_len(200)]
    pub metadata_uri: String,
    pub total_supply: u64,
    pub decimals: u8,
    pub created_at: i64,
    pub bump: u8,
}

#[error_code]
pub enum LaunchError {
    #[msg("Metadata URI must be at most 200 characters")]
    UriTooLong,
}
