use {
    anchor_lang::prelude::*,
    solana_program::{pubkey, pubkey::Pubkey},
};

pub const STAKE_POOL_STATE_SEED: &str = "state";
pub const STAKE_POOL_SIZE: usize = 8 + 32 + 32 + 1 + 8 + 32 + 8 + 1 + 1 + 32 + 16 + 16 + 8;

pub const VAULT_SEED: &str = "vault";
pub const VAULT_AUTH_SEED: &str = "vault_authority";

pub const STAKE_ENTRY_SEED: &str = "stake_entry";
pub const STAKE_ENTRY_SIZE: usize = 8 + 32 + 1 + 8 + 8 + 16 + 16;

pub static PROGRAM_AUTHORITY: Pubkey = pubkey!("9MNHTJJ1wd6uQrZfXk46T24qcWNZYpYfwZKk6zho4poV");

pub const MULT: u128 = 10_000_000_000;
pub const RATE_MULT: u128 = 100_000_000_000;


#[account]
pub struct PoolState {
    pub authority: Pubkey,
    pub bump: u8,
    pub amount: u64,
    pub token_vault: Pubkey,
    pub token_mint: Pubkey,
    pub initialized_at: i64,
    pub vault_bump: u8,
    pub vault_auth_bump: u8,
    pub vault_authority: Pubkey,
    pub current_reward_ratio: u128,
    pub current_burn_ratio: u128,
    pub user_deposit_amt: u64
}

#[account]
pub struct StakeEntry {
    pub user: Pubkey,
    pub bump: u8,
    pub balance: u64,
    pub last_staked: i64,
    pub initial_reward_ratio: u128,
    pub initial_burn_ratio: u128
}

pub fn calculate_out_amount(pool_state: &PoolState, user_stake_entry: &StakeEntry) -> u128 {
    let reward_rate: u128;

    if user_stake_entry.initial_reward_ratio == 1 {
        reward_rate = pool_state.current_reward_ratio;
        msg!("Reward rate: {}", reward_rate);
    } else {
        reward_rate = pool_state.current_reward_ratio.checked_mul(RATE_MULT).unwrap()
                                .checked_div(user_stake_entry.initial_reward_ratio).unwrap();
        msg!("Reward rate: {}", reward_rate);
    }

    let burn_rate: u128;

    if user_stake_entry.initial_burn_ratio == 1 {
        burn_rate = pool_state.current_burn_ratio;
        msg!("Reward rate: {}", burn_rate);
    } else {
        burn_rate = pool_state.current_burn_ratio.checked_mul(RATE_MULT).unwrap()
                                .checked_div(user_stake_entry.initial_burn_ratio).unwrap();
        msg!("Burn rate: {}", burn_rate);
    }

    msg!("User staked amount: {}", user_stake_entry.balance);
    let amount = user_stake_entry.balance;
    let mut out_amount: u128;

    // calculate rewards
    out_amount = (amount as u128).checked_mul(reward_rate).unwrap().checked_div(RATE_MULT).unwrap();
    msg!("Amount after rewards: {}", out_amount);


    // calculate burn
    out_amount = (out_amount).checked_mul(burn_rate).unwrap().checked_div(RATE_MULT).unwrap();
    msg!("Amount after burn: {}", out_amount);

    msg!("Amount after rewards/burn: {}", out_amount);

    out_amount
}