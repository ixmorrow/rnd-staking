# Reward Distribution Program
This repo contains a staking contract that allows users to stake their `RND` tokens in a pool. An authorized user can mint more `RND` tokens to the pool that is distributed pro rata to all stakers according to their stake weight. The authorized user is also able to burn `RND` tokens from the pool, taking tokens away from each staker pro rata. 

The program makes use of a pull based system where each user's total rewards gained and tokens burned are derived once the user issues an instruction to unstake their tokens.

The algorithm used in this program borrows heavily from the Scalable Rewards Distribution algorithms described in these two papers for the Ethereum network. The algorithm used in this program is slightly different, but is essentially a version of the methods described there implemented on Solana.

* [Scalable Rewards Distribution on the Ethereum Blockchain](https://uploads-ssl.webflow.com/5ad71ffeb79acc67c8bcdaba/5ad8d1193a40977462982470_scalable-reward-distribution-paper.pdf)
* [Scalable Rewards Distribution with Compounding Stakes](https://github.com/liquity/liquity/blob/master/papers/Scalable_Reward_Distribution_with_Compounding_Stakes.pdf)

| Cluster | Address |
| --- | --- |
| `Devnet` | [2wMP4GLFkKV3eZnr17PnB4JStRzUN4oet4xmvmgHWq9t](https://explorer.solana.com/address/2wMP4GLFkKV3eZnr17PnB4JStRzUN4oet4xmvmgHWq9t?cluster=devnet) |

## Instructions

### `init_pool`
Initializes a new staking pool, requires a signature from the `program_authority`. The pool is a pda with the address of the token mint that the pool is intended for and "state" as seeds.

### `init_stake_entry`
Initializes an account to hold state about a user's stake position. PDA with the User's pubkey, mint of token, and "stake_entry" as seeds.

### `stake`
Transfers tokens from a User token account to the program token vault, where they are kept while staked.

### `distribute`
This instruction mints tokens to the staking pool where they are distributed evenly to all stakers in proportion to their stake weight.

Requires a signature from the `program_authority`.


### `burn`
Burns tokens from the staking pool and each staker loses tokens evenly in proportion to their stake weight.

Requires a signature from the `program_authority`.


### `unstake`
Transfers tokens from the staking pool back to a user. The amount of tokens transferred is dependent upon the amount of rewards and burns that have occurred while a user was staked.

User can call this at any time.

Users can only unstake tokens that they have staked themselves.
