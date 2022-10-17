pub mod errors;
pub mod instructions;
pub mod state;

use {anchor_lang::prelude::*, instructions::*};

declare_id!("2caX34vXoWbkVmYJmiV5HP1miKbpfhQkuWcBD13hYuKo");

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

    pub fn unstake(ctx: Context<UnstakeCtx>, amount: u64) -> Result<()> {
        unstake::handler(ctx, amount)
    }

    pub fn donate(ctx: Context<DonateCtx>, amount: u64) -> Result<()> {
        donate::handler(ctx, amount)
    }

    pub fn burn(ctx: Context<BurnCtx>, amount: u64) -> Result<()> {
        burn::handler(ctx, amount)
    }
}