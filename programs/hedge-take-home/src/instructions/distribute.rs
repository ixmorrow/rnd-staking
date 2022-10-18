use {
    anchor_lang::prelude::*,
    crate::{state::*, errors::*},
    anchor_spl::{token::{TokenAccount, MintTo, Token, Mint, mint_to}},
};

pub fn handler(ctx: Context<DistributeCtx>, amount: u64) -> Result<()> {

    // program signer seeds
    let auth_bump = ctx.accounts.pool_state.vault_auth_bump;
    let auth_seeds = &[VAULT_AUTH_SEED.as_bytes(), &[auth_bump]];
    let signer = &[&auth_seeds[..]];

    // donate RND by minting to vault
    mint_to(ctx.accounts.mint_ctx().with_signer(signer), amount)?;

    // update state
    let pool_state = &mut ctx.accounts.pool_state;
    if pool_state.amount != 0 {
        pool_state.current_reward_ratio = pool_state.current_reward_ratio.checked_add((amount as u128).checked_mul(MULT).unwrap()
        .checked_div(pool_state.amount as u128).unwrap()
        .try_into().unwrap()).unwrap();      

        msg!("Rewards to distribute: {}", amount);
        msg!("Total staked: {}", pool_state.amount);
        msg!("Reward rate: {}", pool_state.current_reward_ratio);
    }

    pool_state.amount = pool_state.amount.checked_add(amount).unwrap();

    Ok(())
}

#[derive(Accounts)]
pub struct DistributeCtx<'info> {
    #[account(
        constraint = program_authority.key() == PROGRAM_AUTHORITY
        @ StakeError::InvalidProgramAuthority
    )]
    pub program_authority: Signer<'info>,
    #[account(
        mut,
        seeds = [token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()],
        bump = pool_state.bump,
    )]
    pub pool_state: Account<'info, PoolState>,
    #[account(
        mut,
        seeds = [token_mint.key().as_ref(), pool_state.vault_authority.key().as_ref(), VAULT_SEED.as_bytes()],
        bump = pool_state.vault_bump,
    )]
    pub token_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = token_mint.key() == pool_state.token_mint
        @ StakeError::InvalidMint
    )]
    pub token_mint: Account<'info, Mint>,
    /// CHECK: This is not dangerous because using as program signer
    #[account(
        constraint = mint_auth.key() == pool_state.vault_authority
        @ StakeError::InvalidMintAuthority
    )]
    pub mint_auth: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

impl<'info> DistributeCtx <'info> {
    pub fn mint_ctx(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = MintTo {
            mint: self.token_mint.to_account_info(),
            to: self.token_vault.to_account_info(),
            authority: self.mint_auth.to_account_info()
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}