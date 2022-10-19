use {
    anchor_lang::prelude::*,
    crate::{state::*, errors::*},
    anchor_spl::{token::{TokenAccount, Token, Transfer, transfer}},
};

pub fn handler(ctx: Context<StakeCtx>, mut stake_amount: u64) -> Result<()> {
    // transfer amount from user token acct to vault
    transfer(ctx.accounts.transfer_ctx(), stake_amount)?;

    let pool = &mut ctx.accounts.pool;
    let user_entry = &mut ctx.accounts.user_stake_entry;
    msg!("Pool initial total: {}", pool.amount);
    msg!("Initial user deposits: {}", pool.user_deposit_amt);
    msg!("User entry initial balance: {}", user_entry.balance);

    if user_entry.balance == 0 {
        // this should not change after a user has staked for the first time
        // allows for adding to a stake position
        user_entry.initial_reward_ratio = pool.current_reward_ratio;
        user_entry.initial_burn_ratio = pool.current_burn_ratio;
    } 
    else {
        msg!("User adding to original stake position");
        // calculate difference between current reward rate and rate when initially staked
        let reward_rate: u128 = pool.current_reward_ratio
        .checked_sub(user_entry.initial_reward_ratio).unwrap();

        // calculate difference between current burn rate and rate when initially staked
        let burn_rate: u128 = pool.current_burn_ratio
            .checked_sub(user_entry.initial_burn_ratio).unwrap();

        msg!("User staked amount: {}", user_entry.balance);
        let current_amount = user_entry.balance;

        msg!("Burn rate: {}", burn_rate);
        // calculate amount burned over stake period and subtract from out_amount
        let mut out_amount: u128 = (current_amount as u128).checked_sub((current_amount as u128).checked_mul(burn_rate).unwrap()
            .checked_div(MULT).unwrap()
            .try_into().unwrap()).unwrap();
        msg!("Amount after burn applied: {}", out_amount);

        msg!("Reward rate: {}", reward_rate);
        // calculate rewards accrued over stake period and add to out_amount
        out_amount = (out_amount).checked_add((current_amount as u128).checked_mul(reward_rate).unwrap()
            .checked_div(MULT).unwrap()
            .try_into().unwrap()).unwrap();
        msg!("Amount after reward applied: {}", out_amount);

        pool.user_deposit_amt = pool.user_deposit_amt.checked_sub(current_amount as u64).unwrap()
            .checked_add(out_amount as u64).unwrap();
        msg!("Deposit amt: {}", pool.user_deposit_amt);

        user_entry.balance = out_amount as u64;
        msg!("User stake balance: {}", user_entry.balance);

        user_entry.initial_reward_ratio = pool.current_reward_ratio;
        user_entry.initial_burn_ratio = pool.current_burn_ratio;
    }

    // update pool state amount
    pool.amount = pool.amount.checked_add(stake_amount).unwrap();
    pool.user_deposit_amt = pool.user_deposit_amt.checked_add(stake_amount).unwrap();
    msg!("Current pool total: {}", pool.amount);
    msg!("Amount of tokens deposited by users: {}", pool.user_deposit_amt);

    // update user stake entry
    user_entry.balance = user_entry.balance.checked_add(stake_amount).unwrap();
    msg!("User entry balance: {}", user_entry.balance);
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
    #[account(
        mut,
        constraint = user.key() == user_stake_entry.user
        @ StakeError::InvalidUser
    )]
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