use {
    anchor_lang::prelude::*,
    crate::{state::*, errors::*},
    anchor_spl::{token::{TokenAccount, Token, Mint, Burn, burn}},
};

pub fn handler(ctx: Context<BurnCtx>, amount: u64) -> Result<()> {

    // verify that amount is <= rnd donations
    // if amount > ctx.accounts.pool_state.rnd_donations {
    //     return err!(StakeError::OverdrawError)
    // }

    // program signer seeds
    let auth_bump = ctx.accounts.pool_state.vault_auth_bump;
    let auth_seeds = &[VAULT_AUTH_SEED.as_bytes(), &[auth_bump]];
    let signer = &[&auth_seeds[..]];

    // burn the tokens
    burn(ctx.accounts.burn_ctx().with_signer(signer), amount)?;

    // calculate new reward rate

    // update state in pool
    // let pool = &mut ctx.accounts.pool_state;
    // pool.rnd_donations = pool.rnd_donations.checked_sub(amount).unwrap();

    Ok(())
}

#[derive(Accounts)]
pub struct BurnCtx<'info> {
    #[account(
        constraint = program_authority.key() == PROGRAM_AUTHORITY
        @ StakeError::InvalidProgramAuthority
    )]
    pub program_authority: Signer<'info>,
    #[account(
        mut,
        seeds = [pool_state.token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()],
        bump = pool_state.bump,
    )]
    pub pool_state: Account<'info, PoolState>,
    #[account(
        mut,
        seeds = [pool_state.token_mint.key().as_ref(), pool_state.vault_authority.key().as_ref(), VAULT_SEED.as_bytes()],
        bump = pool_state.vault_bump,
    )]
    pub token_vault: Account<'info, TokenAccount>,
    /// CHECK: This is not dangerous because we're only using this as a program signer
    #[account(
        seeds = [VAULT_AUTH_SEED.as_bytes()],
        bump = pool_state.vault_auth_bump
    )]
    pub vault_authority: AccountInfo<'info>,
    #[account(
        mut,
        constraint = token_mint.key() == pool_state.token_mint
        @ StakeError::InvalidMint
    )]
    pub token_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>
}

impl<'info> BurnCtx <'info> {
    pub fn burn_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Burn<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = Burn {
            mint: self.token_mint.to_account_info(),
            from: self.token_vault.to_account_info(),
            authority: self.vault_authority.to_account_info()
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}