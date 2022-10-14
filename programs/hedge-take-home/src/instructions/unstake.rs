use {
    anchor_lang::prelude::*,
    crate::{state::*, errors::*},
    anchor_spl::{token::{TokenAccount, Token, Transfer, transfer}},
};

pub fn handler(ctx: Context<UnstakeCtx>, amount: u64) -> Result<()> {

    // program signer seeds
    let auth_bump = ctx.accounts.pool.vault_auth_bump;
    let auth_seeds = &[VAULT_AUTH_SEED.as_bytes(), &[auth_bump]];
    let signer = &[&auth_seeds[..]];

    // transfer from vault to user
    transfer(ctx.accounts.transfer_ctx().with_signer(signer), amount)?;

    let pool = &mut ctx.accounts.pool;
    let user_entry = &mut ctx.accounts.user_stake_entry;

     // update pool state amount
    pool.amount = pool.amount.checked_sub(amount).unwrap();

    // update user stake entry
    user_entry.balance = user_entry.balance.checked_sub(amount).unwrap();
    user_entry.last_staked = Clock::get().unwrap().unix_timestamp;

    Ok(())
}

#[derive(Accounts)]
pub struct UnstakeCtx <'info> {
    #[account(
        mut,
        seeds = [pool.token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()],
        bump = pool.bump
    )]
    pub pool: Account<'info, PoolState>,
    #[account(
        mut,
        seeds = [pool.token_mint.key().as_ref(), pool.vault_authority.key().as_ref(), VAULT_SEED.as_bytes()],
        bump = pool.vault_bump
    )]
    pub token_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [user.key().as_ref(), STAKE_ENTRY_SEED.as_bytes()],
        bump = user_stake_entry.bump
    )]
    pub user_stake_entry: Account<'info, StakeEntry>,
    #[account(
        mut,
        constraint = user_token_account.mint == pool.token_mint
        @ StakeError::InvalidMint
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    /// CHECK: This is not dangerous because we're only using this as a program signer
    #[account(
        seeds = [VAULT_AUTH_SEED.as_bytes()],
        bump = pool.vault_auth_bump
    )]
    pub vault_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>
}

impl<'info> UnstakeCtx <'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.token_vault.to_account_info(),
            to: self.user_token_account.to_account_info(),
            authority: self.vault_authority.to_account_info()
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}