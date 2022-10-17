pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

use {anchor_lang::prelude::*, instructions::*};

declare_id!("4Cs5Z12AAr7F1qPQoba27kFogYs3JwncDiRpe4SUCHYa");

#[program]
pub mod hedge_take_home {
    use super::*;

    pub fn init_pool(ctx: Context<InitializePool>) -> Result<()> {
        init_pool::handler(ctx)
    }

    pub fn init_stake_entry(ctx: Context<InitEntryCtx>) -> Result<()> {
        init_stake_entry::handler(ctx)
    }

    pub fn stake(ctx: Context<StakeCtx>, amount: u64) -> Result<()> {
        stake::handler(ctx, amount)
    }

    pub fn unstake(ctx: Context<UnstakeCtx>) -> Result<()> {
        unstake::handler(ctx)
    }

    pub fn distribute(ctx: Context<DistributeCtx>, amount: u64) -> Result<()> {
        distribute::handler(ctx, amount)
    }

    pub fn burn(ctx: Context<BurnCtx>, amount: u64) -> Result<()> {
        burn::handler(ctx, amount)
    }
}