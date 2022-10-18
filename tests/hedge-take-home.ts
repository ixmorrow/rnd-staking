import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { HedgeTakeHome } from "../target/types/hedge_take_home"
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, createMint, setAuthority, AuthorityType, getAssociatedTokenAddress, getAccount, getOrCreateAssociatedTokenAccount, burn, amountToUiAmount } from '@solana/spl-token'
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
  let treasuryVault: PublicKey = null
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

    const treasuryVaultAcct = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      programAuthority,
      tokenMint,
      programAuthority.publicKey
      )
      treasuryVault = treasuryVaultAcct.address
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

    await program.methods.initPool()
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
    
    const poolAcct = await program.account.poolState.fetch(pool)
    assert(poolAcct.authority.toBase58() == programAuthority.publicKey.toBase58())
    assert(poolAcct.amount.toNumber() == 0)
    assert(poolAcct.currentRewardRatio.toNumber() == 0)
    assert(poolAcct.currentBurnRatio.toNumber() == 0)
  })

  it("Create user stake entry accounts", async () => {

    const [user1Entry, entryBump] = await PublicKey.findProgramAddress(
      [userKeypair1.publicKey.toBuffer(), tokenMint.toBuffer(), Buffer.from("stake_entry")],
      program.programId
    )
    user1StakeEntry = user1Entry

    let [treasuryVaultAddress, treasuryBump] = await PublicKey.findProgramAddress(
      [tokenMint.toBuffer(), programAuthority.publicKey.toBuffer(), Buffer.from("treasury")],
      program.programId
    )
    treasuryVault = treasuryVaultAddress
    
    let userEntryAcct = await provider.connection.getAccountInfo(user1Entry)

    if(userEntryAcct == null) {
      await program.methods.initStakeEntry()
      .accounts({
        user: userKeypair1.publicKey,
        userStakeEntry: user1StakeEntry,
        poolState: pool
      })
      .signers([userKeypair1])
      .rpc()
    }

    const [user2Entry, entryBump2] = await PublicKey.findProgramAddress(
      [userKeypair2.publicKey.toBuffer(), tokenMint.toBuffer(), Buffer.from("stake_entry")],
      program.programId
    )
    user2StakeEntry = user2Entry

    userEntryAcct = await provider.connection.getAccountInfo(user2Entry)
    if (userEntryAcct == null) {
      await program.methods.initStakeEntry()
      .accounts({
        user: userKeypair2.publicKey,
        userStakeEntry: user2StakeEntry,
        poolState: pool
      })
      .signers([userKeypair2])
      .rpc()
    }

    const [user3Entry, entryBump3] = await PublicKey.findProgramAddress(
      [userKeypair3.publicKey.toBuffer(), tokenMint.toBuffer(), Buffer.from("stake_entry")],
      program.programId
    )
    user3StakeEntry = user3Entry

    userEntryAcct = await provider.connection.getAccountInfo(user3Entry)
    if(userEntryAcct == null) {
      await program.methods.initStakeEntry()
      .accounts({
        user: userKeypair3.publicKey,
        userStakeEntry: user3StakeEntry,
        poolState: pool
      })
      .signers([userKeypair3])
      .rpc()
    }

    const user1Acct = await program.account.stakeEntry.fetch(user1Entry)
    assert(user1Acct.user.toBase58() == userKeypair1.publicKey.toBase58())
    assert(user1Acct.bump == entryBump)
    assert(user1Acct.balance.toNumber() == 0)

    const user2Acct = await program.account.stakeEntry.fetch(user2Entry)
    assert(user2Acct.user.toBase58() == userKeypair2.publicKey.toBase58())
    assert(user2Acct.bump == entryBump2)
    assert(user2Acct.balance.toNumber() == 0)


    const user3Acct = await program.account.stakeEntry.fetch(user3Entry)
    assert(user3Acct.user.toBase58() == userKeypair3.publicKey.toBase58())
    assert(user3Acct.bump == entryBump3)
    assert(user3Acct.balance.toNumber() == 0)
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

    await program.methods.stake(new BN(100 * LAMPORTS_PER_SOL))
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
    assert(userTokenAcct.amount == initialUserBalance - BigInt(100*LAMPORTS_PER_SOL))
    assert(stakeVaultAcct.amount == initialVaultBalance + BigInt(100*LAMPORTS_PER_SOL))

    let updatedUserEntryAcct = await program.account.stakeEntry.fetch(user1StakeEntry)
    assert(updatedUserEntryAcct.balance.toNumber() / LAMPORTS_PER_SOL == initialEntryBalance.toNumber()+100)

    poolAcct = await program.account.poolState.fetch(pool)
    assert(poolAcct.amount.toNumber() / LAMPORTS_PER_SOL == initialPoolAmt.toNumber() + 100)
    assert(poolAcct.amount.toNumber() == updatedUserEntryAcct.balance.toNumber())
    assert(poolAcct.currentRewardRatio.toNumber() == updatedUserEntryAcct.initialRewardRatio.toNumber())
    assert(poolAcct.currentBurnRatio.toNumber() == updatedUserEntryAcct.initialBurnRatio.toNumber())
  })

  it('User 2 stakes RND', async () => {
    const userAta = await getAssociatedTokenAddress(tokenMint, userKeypair2.publicKey)

    let userTokenAcct = await getAccount(provider.connection, userAta)
    let initialUserBalance = userTokenAcct.amount

    let stakeVaultAcct = await getAccount(provider.connection, stakeVault)
    let initialVaultBalance = stakeVaultAcct.amount

    let poolAcct = await program.account.poolState.fetch(pool)
    let initialPoolAmt = poolAcct.amount

    let userEntryAcct = await program.account.stakeEntry.fetch(user2StakeEntry)
    let initialEntryBalance = userEntryAcct.balance

    await program.methods.stake(new BN(400 * LAMPORTS_PER_SOL))
    .accounts({
      pool: pool,
      tokenVault: stakeVault,
      user: userKeypair2.publicKey,
      userStakeEntry: user2StakeEntry,
      userTokenAccount: userAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    })
    .signers([userKeypair2])
    .rpc()

    userTokenAcct = await getAccount(provider.connection, userAta)
    stakeVaultAcct = await getAccount(provider.connection, stakeVault)
    assert(userTokenAcct.amount == initialUserBalance - BigInt(400*LAMPORTS_PER_SOL))
    assert(stakeVaultAcct.amount == initialVaultBalance + BigInt(400*LAMPORTS_PER_SOL))

    let updatedUserEntryAcct = await program.account.stakeEntry.fetch(user2StakeEntry)
    assert(updatedUserEntryAcct.balance.toNumber() == initialEntryBalance.toNumber() + (400*LAMPORTS_PER_SOL))

    poolAcct = await program.account.poolState.fetch(pool)
    assert(poolAcct.amount.toNumber() == initialPoolAmt.toNumber() + (400*LAMPORTS_PER_SOL))
    assert(poolAcct.currentRewardRatio.toNumber() == updatedUserEntryAcct.initialRewardRatio.toNumber())
    assert(poolAcct.currentBurnRatio.toNumber() == updatedUserEntryAcct.initialBurnRatio.toNumber())
  })

  it('Permissioned RND distribution', async () => {
    let poolAcct = await program.account.poolState.fetch(pool)
    const initialStakeAmt = poolAcct.amount

    let vaultAcct = await getAccount(provider.connection, stakeVault)
    const initialVaultAmt = vaultAcct.amount

    await program.methods.distribute(new BN(250 * LAMPORTS_PER_SOL))
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
    assert(poolAcct.amount.toNumber() == initialStakeAmt.toNumber() + (250*LAMPORTS_PER_SOL))
    
    vaultAcct = await getAccount(provider.connection, stakeVault)
    assert(vaultAcct.amount == initialVaultAmt + BigInt(250*LAMPORTS_PER_SOL))

    let rewardRate = (250*LAMPORTS_PER_SOL)/initialStakeAmt.toNumber()
    console.log("Derived reward Rate: ", rewardRate)
    assert(poolAcct.currentRewardRatio.toNumber()/LAMPORTS_PER_SOL == rewardRate)
  })

  it('User 3 stakes RND', async () => {
    const userAta = await getAssociatedTokenAddress(tokenMint, userKeypair3.publicKey)

    let userTokenAcct = await getAccount(provider.connection, userAta)
    let initialUserBalance = userTokenAcct.amount

    let stakeVaultAcct = await getAccount(provider.connection, stakeVault)
    let initialVaultBalance = stakeVaultAcct.amount

    let poolAcct = await program.account.poolState.fetch(pool)
    let initialPoolAmt = poolAcct.amount

    let userEntryAcct = await program.account.stakeEntry.fetch(user3StakeEntry)
    let initialEntryBalance = userEntryAcct.balance

    await program.methods.stake(new BN(250 * LAMPORTS_PER_SOL))
    .accounts({
      pool: pool,
      tokenVault: stakeVault,
      user: userKeypair3.publicKey,
      userStakeEntry: user3StakeEntry,
      userTokenAccount: userAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    })
    .signers([userKeypair3])
    .rpc()

    userTokenAcct = await getAccount(provider.connection, userAta)
    stakeVaultAcct = await getAccount(provider.connection, stakeVault)
    assert(userTokenAcct.amount == initialUserBalance - BigInt(250*LAMPORTS_PER_SOL))
    assert(stakeVaultAcct.amount == initialVaultBalance + BigInt(250*LAMPORTS_PER_SOL))

    let updatedUserEntryAcct = await program.account.stakeEntry.fetch(user3StakeEntry)
    assert(updatedUserEntryAcct.balance.toNumber() == initialEntryBalance.toNumber() + (250*LAMPORTS_PER_SOL))

    poolAcct = await program.account.poolState.fetch(pool)
    assert(poolAcct.amount.toNumber() == initialPoolAmt.toNumber() + (250*LAMPORTS_PER_SOL))
    assert(poolAcct.currentRewardRatio.toNumber() == updatedUserEntryAcct.initialRewardRatio.toNumber())
    assert(poolAcct.currentBurnRatio.toNumber() == updatedUserEntryAcct.initialBurnRatio.toNumber())
  })

  it('Permissioned RND reward burn', async () => {
    let poolAcct = await program.account.poolState.fetch(pool)
    const initialStakeAmt = poolAcct.amount

    let vaultAcct = await getAccount(provider.connection, stakeVault)
    const initialVaultAmt = vaultAcct.amount

    await program.methods.burn(new BN(20*LAMPORTS_PER_SOL))
    .accounts({
      programAuthority: programAuthority.publicKey,
      poolState: pool,
      tokenVault: stakeVault,
      vaultAuthority: vaultAuthority,
      tokenMint: tokenMint,
      tokenProgram: TOKEN_PROGRAM_ID
    })
    .signers([programAuthority])
    .rpc()

    poolAcct = await program.account.poolState.fetch(pool)
    assert(poolAcct.amount.toNumber() == initialStakeAmt.toNumber() - (20*LAMPORTS_PER_SOL))
    
    vaultAcct = await getAccount(provider.connection, stakeVault)
    assert(vaultAcct.amount == initialVaultAmt - BigInt(20*LAMPORTS_PER_SOL))

    let burnRate = (20*LAMPORTS_PER_SOL)/initialStakeAmt.toNumber()
    console.log("Derived burn rate: ", burnRate)
    assert(poolAcct.currentBurnRatio.toNumber()/LAMPORTS_PER_SOL == burnRate)
  })

  it('User 1 unstakes RND', async () => {
    const userAta = await getAssociatedTokenAddress(tokenMint, userKeypair1.publicKey)

    let userTokenAcct = await getAccount(provider.connection, userAta)
    let initialUserBalance = Number(userTokenAcct.amount)

    let stakeVaultAcct = await getAccount(provider.connection, stakeVault)
    let initialVaultBalance = Number(stakeVaultAcct.amount)

    let poolAcct = await program.account.poolState.fetch(pool)
    let initialPoolAmt = Number(poolAcct.amount)

    let userEntryAcct = await program.account.stakeEntry.fetch(user1StakeEntry)
    let initialEntryBalance = Number(userEntryAcct.balance)

    await program.methods.unstake()
    .accounts({
      pool: pool,
      tokenVault: stakeVault,
      user: userKeypair1.publicKey,
      userStakeEntry: user1StakeEntry,
      userTokenAccount: userAta,
      vaultAuthority: vaultAuthority,
      tokenMint: tokenMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    })
    .signers([userKeypair1])
    .rpc()

    userTokenAcct = await getAccount(provider.connection, userAta)
    stakeVaultAcct = await getAccount(provider.connection, stakeVault)
    const rewardRate = (poolAcct.currentRewardRatio.toNumber() - userEntryAcct.initialRewardRatio.toNumber()) / LAMPORTS_PER_SOL
    const burnRate = (poolAcct.currentBurnRatio.toNumber() - userEntryAcct.initialBurnRatio.toNumber()) / LAMPORTS_PER_SOL
    let amtAfterRewards = initialEntryBalance + (initialEntryBalance*rewardRate)
    let expectedAmt = amtAfterRewards - (amtAfterRewards*burnRate)
    console.log("Expected amount: ", expectedAmt)

    assert(Number(userTokenAcct.amount) == initialUserBalance + expectedAmt)
    assert(Number(stakeVaultAcct.amount) == initialVaultBalance - expectedAmt)

    let updatedUserEntryAcct = await program.account.stakeEntry.fetch(user1StakeEntry)
    assert(updatedUserEntryAcct.balance.toNumber() == 0)

    poolAcct = await program.account.poolState.fetch(pool)
    assert(poolAcct.amount.toNumber() == initialPoolAmt - expectedAmt)
  })

  it('User 2 adds to staking position', async () => {
    const userAta = await getAssociatedTokenAddress(tokenMint, userKeypair2.publicKey)

    let userTokenAcct = await getAccount(provider.connection, userAta)
    let initialUserBalance = userTokenAcct.amount

    let stakeVaultAcct = await getAccount(provider.connection, stakeVault)
    let initialVaultBalance = stakeVaultAcct.amount

    let poolAcct = await program.account.poolState.fetch(pool)
    let initialPoolAmt = poolAcct.amount

    let userEntryAcct = await program.account.stakeEntry.fetch(user2StakeEntry)
    let initialEntryBalance = userEntryAcct.balance

    await program.methods.stake(new BN(25 * LAMPORTS_PER_SOL))
    .accounts({
      pool: pool,
      tokenVault: stakeVault,
      user: userKeypair2.publicKey,
      userStakeEntry: user2StakeEntry,
      userTokenAccount: userAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    })
    .signers([userKeypair2])
    .rpc()

    userTokenAcct = await getAccount(provider.connection, userAta)
    stakeVaultAcct = await getAccount(provider.connection, stakeVault)
    assert(userTokenAcct.amount == initialUserBalance - BigInt(25*LAMPORTS_PER_SOL))
    assert(stakeVaultAcct.amount == initialVaultBalance + BigInt(25*LAMPORTS_PER_SOL))

    let updatedUserEntryAcct = await program.account.stakeEntry.fetch(user2StakeEntry)
    assert(updatedUserEntryAcct.balance.toNumber() == initialEntryBalance.toNumber() + (25*LAMPORTS_PER_SOL))

    poolAcct = await program.account.poolState.fetch(pool)
    assert(poolAcct.amount.toNumber() == initialPoolAmt.toNumber() + (25*LAMPORTS_PER_SOL))
    assert(poolAcct.currentRewardRatio.toNumber() != updatedUserEntryAcct.initialRewardRatio.toNumber())
    assert(poolAcct.currentBurnRatio.toNumber() != updatedUserEntryAcct.initialBurnRatio.toNumber())
    assert(userEntryAcct.initialRewardRatio.toNumber() == updatedUserEntryAcct.initialRewardRatio.toNumber())
    assert(userEntryAcct.initialBurnRatio.toNumber() == updatedUserEntryAcct.initialBurnRatio.toNumber())
  })
})
