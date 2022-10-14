import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { HedgeTakeHome } from "../target/types/hedge_take_home"
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, createMint, setAuthority, AuthorityType, getAssociatedTokenAddress, getAccount } from '@solana/spl-token'
import { delay, initializeTestUsers, safeAirdrop } from './utils/util'
import { userKeypair1, userKeypair2, userKeypair3, programAuthority } from './testKeypairs/testKeypairs'
import { assert } from "chai"
import { BN } from "bn.js"

describe("hedge-take-home", async () => {
  anchor.setProvider(anchor.AnchorProvider.env())

  const program = anchor.workspace.HedgeTakeHome as Program<HedgeTakeHome>
  const provider = anchor.AnchorProvider.env()

  let tokenMint: PublicKey = null
  let stakeVault: PublicKey = null
  let pool: PublicKey = null
  let user1StakeEntry: PublicKey = null
  let user2StakeEntry: PublicKey = null
  let user3StakeEntry: PublicKey = null


  let [vaultAuthority, vaultAuthBump] = await PublicKey.findProgramAddress(
    [Buffer.from("vault_authority")],
    program.programId
  )


  it("Create RND Token mint", async () => {
    await safeAirdrop(programAuthority.publicKey, provider.connection)
    delay(10000)

    // create RND mint
    tokenMint = await createMint(
      provider.connection,
      programAuthority,
      programAuthority.publicKey,
      programAuthority.publicKey,
      9,
    )

    // mint RND to test users
    await initializeTestUsers(provider.connection, tokenMint, programAuthority)

    // assign RND mint to a PDA of the staking program
    await setAuthority(
      provider.connection,
      programAuthority,
      tokenMint,
      programAuthority,
      AuthorityType.MintTokens,
      vaultAuthority
    )
  })

  it("Initialize Stake Pool", async () => {

    const [poolState, poolBump] = await PublicKey.findProgramAddress(
      [tokenMint.toBuffer(), Buffer.from("state")],
      program.programId
    )
    pool = poolState

    const [vault, vaultBump] = await PublicKey.findProgramAddress(
      [tokenMint.toBuffer(), vaultAuthority.toBuffer(), Buffer.from("vault")],
      program.programId
    )
    stakeVault = vault

    const tx = await program.methods.initPool()
    .accounts({
      poolState: pool,
      tokenVault: stakeVault,
      tokenMint: tokenMint,
      programAuthority: programAuthority.publicKey,
      vaultAuthority: vaultAuthority,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY
    })
    .signers([programAuthority])
    .rpc()    
  })

  it("Create user stake entry accounts", async () => {

    const [user1Entry, entryBump] = await PublicKey.findProgramAddress(
      [userKeypair1.publicKey.toBuffer(), Buffer.from("stake_entry")],
      program.programId
    )
    user1StakeEntry = user1Entry
    
    let userEntryAcct = await provider.connection.getAccountInfo(user1Entry)

    if(userEntryAcct == null) {
      const tx = await program.methods.initStakeEntry()
      .accounts({
        user: userKeypair1.publicKey,
        userStakeEntry: user1StakeEntry
      })
      .signers([userKeypair1])
      .rpc()
    }

    const [user2Entry, entryBump2] = await PublicKey.findProgramAddress(
      [userKeypair2.publicKey.toBuffer(), Buffer.from("stake_entry")],
      program.programId
    )
    user2StakeEntry = user2Entry

    userEntryAcct = await provider.connection.getAccountInfo(user2Entry)
    if (userEntryAcct == null) {
      const tx2 = await program.methods.initStakeEntry()
      .accounts({
        user: userKeypair2.publicKey,
        userStakeEntry: user2StakeEntry
      })
      .signers([userKeypair2])
      .rpc()
    }

    const [user3Entry, entryBump3] = await PublicKey.findProgramAddress(
      [userKeypair3.publicKey.toBuffer(), Buffer.from("stake_entry")],
      program.programId
    )
    user3StakeEntry = user3Entry

    userEntryAcct = await provider.connection.getAccountInfo(user3Entry)
    if(userEntryAcct == null) {
      const tx3 = await program.methods.initStakeEntry()
      .accounts({
        user: userKeypair3.publicKey,
        userStakeEntry: user3StakeEntry
      })
      .signers([userKeypair3])
      .rpc()
    }

    const user1Acct = await program.account.stakeEntry.fetch(user1Entry)
    assert(user1Acct.user.toBase58() == userKeypair1.publicKey.toBase58())
    assert(user1Acct.bump == entryBump)

    const user2Acct = await program.account.stakeEntry.fetch(user2Entry)
    assert(user2Acct.user.toBase58() == userKeypair2.publicKey.toBase58())
    assert(user2Acct.bump == entryBump2)

    const user3Acct = await program.account.stakeEntry.fetch(user3Entry)
    assert(user3Acct.user.toBase58() == userKeypair3.publicKey.toBase58())
    assert(user3Acct.bump == entryBump3)
  })

  it('User 1 stakes RND', async () => {
    const userAta = await getAssociatedTokenAddress(tokenMint, userKeypair1.publicKey)

    let userTokenAcct = await getAccount(provider.connection, userAta)
    let initialUserBalance = userTokenAcct.amount

    let stakeVaultAcct = await getAccount(provider.connection, stakeVault)
    let initialVaultBalance = stakeVaultAcct.amount

    let poolAcct = await program.account.poolState.fetch(pool)
    let initialPoolAmt = poolAcct.amount

    let userEntryAcct = await program.account.stakeEntry.fetch(user1StakeEntry)
    let initialEntryBalance = userEntryAcct.balance

    const tx = await program.methods.stake(new BN(15))
    .accounts({
      pool: pool,
      tokenVault: stakeVault,
      user: userKeypair1.publicKey,
      userStakeEntry: user1StakeEntry,
      userTokenAccount: userAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    })
    .signers([userKeypair1])
    .rpc()

    userTokenAcct = await getAccount(provider.connection, userAta)
    stakeVaultAcct = await getAccount(provider.connection, stakeVault)
    assert(userTokenAcct.amount == initialUserBalance - BigInt(15))
    assert(stakeVaultAcct.amount == initialVaultBalance + BigInt(15))

    let updatedUserEntryAcct = await program.account.stakeEntry.fetch(user1StakeEntry)
    assert(updatedUserEntryAcct.balance.toNumber() == initialEntryBalance.toNumber()+ 15)

    poolAcct = await program.account.poolState.fetch(pool)
    assert(poolAcct.amount.toNumber() == initialPoolAmt.toNumber() + 15)
  })

  it('User 1 unstakes RND', async () => {
    const userAta = await getAssociatedTokenAddress(tokenMint, userKeypair1.publicKey)

    let userTokenAcct = await getAccount(provider.connection, userAta)
    let initialUserBalance = userTokenAcct.amount

    let stakeVaultAcct = await getAccount(provider.connection, stakeVault)
    let initialVaultBalance = stakeVaultAcct.amount

    let poolAcct = await program.account.poolState.fetch(pool)
    let initialPoolAmt = poolAcct.amount

    let userEntryAcct = await program.account.stakeEntry.fetch(user1StakeEntry)
    let initialEntryBalance = userEntryAcct.balance

    const tx = await program.methods.unstake(new BN(5))
    .accounts({
      pool: pool,
      tokenVault: stakeVault,
      user: userKeypair1.publicKey,
      userStakeEntry: user1StakeEntry,
      userTokenAccount: userAta,
      vaultAuthority: vaultAuthority,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    })
    .signers([userKeypair1])
    .rpc()

    userTokenAcct = await getAccount(provider.connection, userAta)
    stakeVaultAcct = await getAccount(provider.connection, stakeVault)
    assert(userTokenAcct.amount == initialUserBalance + BigInt(5))
    assert(stakeVaultAcct.amount == initialVaultBalance - BigInt(5))

    let updatedUserEntryAcct = await program.account.stakeEntry.fetch(user1StakeEntry)
    assert(updatedUserEntryAcct.balance.toNumber() == initialEntryBalance.toNumber() - 5)

    poolAcct = await program.account.poolState.fetch(pool)
    assert(poolAcct.amount.toNumber() == initialPoolAmt.toNumber() - 5)
  })

  it('Permissioned RND donation', async () => {
    let poolAcct = await program.account.poolState.fetch(pool)
    const initialPoolDonationAmt = poolAcct.rndDonations
    const initialStakeAmt = poolAcct.amount

    let vaultAcct = await getAccount(provider.connection, stakeVault)
    const initialVaultAmt = vaultAcct.amount

    const tx = await program.methods.donate(new BN(25))
    .accounts({
      programAuthority: programAuthority.publicKey,
      poolState: pool,
      tokenVault: stakeVault,
      tokenMint: tokenMint,
      mintAuth: vaultAuthority,
      tokenProgram: TOKEN_PROGRAM_ID
    })
    .signers([programAuthority])
    .rpc()

    poolAcct = await program.account.poolState.fetch(pool)
    assert(poolAcct.rndDonations.toNumber() == initialPoolDonationAmt.toNumber() + 25)
    assert(initialStakeAmt.toNumber() == poolAcct.amount.toNumber())
    console.log("Initial stake: ", initialStakeAmt.toNumber())
    console.log("Current: (should be same)", poolAcct.amount.toNumber())
    
    vaultAcct = await getAccount(provider.connection, stakeVault)
    assert(vaultAcct.amount == initialVaultAmt + BigInt(25))
  })
})
