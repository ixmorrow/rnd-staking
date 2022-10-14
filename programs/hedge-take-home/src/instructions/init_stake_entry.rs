use {
    anchor_lang::prelude::*,
    crate::{state::*},
};

pub fn handler(ctx: Context<InitEntryCtx>) -> Result<()> {
    let user_entry = &mut ctx.accounts.user_stake_entry;
    user_entry.user = ctx.accounts.user.key();
    user_entry.bump = *ctx.bumps.get("user_stake_entry").unwrap();
    user_entry.balance = 0;

    Ok(())
}

#[derive(Accounts)]
pub struct InitEntryCtx <'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        seeds = [user.key().as_ref(), STAKE_ENTRY_SEED.as_bytes()],
        bump,
        payer = user,
        space = STAKE_ENTRY_SIZE
    )]
    pub user_stake_entry: Account<'info, StakeEntry>,
    pub system_program: Program<'info, System>,
}