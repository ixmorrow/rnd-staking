use {
    anchor_lang::prelude::*,
    crate::{state::*, errors::*},
    anchor_spl::{token::{TokenAccount, Token, Transfer, transfer}},
};

pub fn handler(ctx: Context<StakeCtx>, amount: u64) -> Result<()> {
    // transfer amount from user token acct to vault
    transfer(ctx.accounts.transfer_ctx(), amount)?;

    let pool = &mut ctx.accounts.pool;
    let user_entry = &mut ctx.accounts.user_stake_entry;

    // update pool state amount
    pool.amount += pool.amount.checked_add(amount).unwrap();

    // update user stake entry
    user_entry.balance = user_entry.balance.checked_add(amount).unwrap();
    user_entry.last_staked = Clock::get().unwrap().unix_timestamp;

    Ok(())
}

#[derive(Accounts)]
pub struct StakeCtx <'info> {
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

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>
}

impl<'info> StakeCtx <'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.user_token_account.to_account_info(),
            to: self.token_vault.to_account_info(),
            authority: self.user.to_account_info()
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}