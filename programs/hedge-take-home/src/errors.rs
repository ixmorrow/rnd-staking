use anchor_lang::prelude::*;

#[error_code]
pub enum StakeError {
    #[msg("Token mint is invalid")]
    InvalidMint,
    #[msg("Mathematical overflow occured")]
    MathematicalOverflowError
}