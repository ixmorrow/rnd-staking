use {
    anchor_lang::prelude::*,
    crate::{state::*, errors::*},
    anchor_spl::{token::{TokenAccount, Token, Mint}},
    solana_program::{program::invoke_signed},
    spl_token::instruction::transfer_checked,
};

pub fn handler(ctx: Context<UnstakeCtx>) -> Result<()> {
    let reward_rate: u128 = ctx.accounts.pool.current_reward_ratio
        .checked_sub(ctx.accounts.user_stake_entry.initial_reward_ratio).unwrap();

    let burn_rate: u128 = ctx.accounts.pool.current_burn_ratio
        .checked_sub(ctx.accounts.user_stake_entry.initial_burn_ratio).unwrap();

    msg!("User staked amount: {}", ctx.accounts.user_stake_entry.balance);
    let amount = ctx.accounts.user_stake_entry.balance;

    msg!("Reward rate: {}", reward_rate);
    // calculate reward amount accrued
    let mut out_amount: u128 = (amount as u128).checked_add((amount as u128).checked_mul(reward_rate).unwrap()
        .checked_div(MULT).unwrap()
        .try_into().unwrap()).unwrap();
    msg!("Amount after reward distribution: {}", out_amount);

    msg!("Burn rate: {}", burn_rate);
    // calculate amount burned
    out_amount = out_amount.checked_sub((out_amount as u128).checked_mul(burn_rate).unwrap()
        .checked_div(MULT).unwrap()
        .try_into().unwrap()).unwrap();
    msg!("Amount after burn applied: {}", out_amount);


    // program signer seeds
    let auth_bump = ctx.accounts.pool.vault_auth_bump;
    let auth_seeds = &[VAULT_AUTH_SEED.as_bytes(), &[auth_bump]];
    let signer = &[&auth_seeds[..]];

    let transfer_ix = transfer_checked(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.token_vault.key(),
        &ctx.accounts.token_mint.key(),
        &ctx.accounts.user_token_account.key(),
        &ctx.accounts.vault_authority.key(),
        &[&ctx.accounts.vault_authority.key()],
        out_amount as u64,
        9
    ).unwrap();

    invoke_signed(
        &transfer_ix,
        &[
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.token_vault.to_account_info(),
            ctx.accounts.token_mint.to_account_info(),
            ctx.accounts.user_token_account.to_account_info(),
            ctx.accounts.vault_authority.to_account_info()
        ],
        signer
    )?;

    let pool = &mut ctx.accounts.pool;
    let user_entry = &mut ctx.accounts.user_stake_entry;

     // update pool state amount
    pool.amount = pool.amount.checked_sub(out_amount.try_into().unwrap()).unwrap();
    msg!("Total staked after withdrawal: {}", pool.amount);

    // update user stake entry
    user_entry.balance = 0;
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
        seeds = [user.key().as_ref(), pool.token_mint.key().as_ref(), STAKE_ENTRY_SEED.as_bytes()],
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
    #[account(
        mut,
        constraint = token_mint.key() == pool.token_mint
        @ StakeError::InvalidMint
    )]
    pub token_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>
}