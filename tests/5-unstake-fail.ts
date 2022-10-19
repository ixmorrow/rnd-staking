import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { HedgeTakeHome } from "../target/types/hedge_take_home"
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, createMint, setAuthority, AuthorityType, getAssociatedTokenAddress } from '@solana/spl-token'
import { delay, initializeTestUsers, safeAirdrop } from './utils/util'
import { incorrectProgramAuthority, programAuthority, userKeypair1, userKeypair2 } from './testKeypairs/testKeypairs'
import { expect } from "chai"
import { BN } from "bn.js"


describe("test staking tokens without ownership", async () => {
    anchor.setProvider(anchor.AnchorProvider.env())

    const program = anchor.workspace.HedgeTakeHome as Program<HedgeTakeHome>
    const provider = anchor.AnchorProvider.env()

    let tokenMint: PublicKey = null
    let stakeVault: PublicKey = null
    let pool: PublicKey = null

    let [vaultAuthority, vaultAuthBump] = await PublicKey.findProgramAddress(
        [Buffer.from("vault_authority")],
        program.programId
    )

    it("Attempt to unstake another user's tokens", async () => {
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

        const [user1Entry, entryBump] = await PublicKey.findProgramAddress(
            [userKeypair1.publicKey.toBuffer(), tokenMint.toBuffer(), Buffer.from("stake_entry")],
            program.programId
        )

        await program.methods.initStakeEntry()
            .accounts({
            user: userKeypair1.publicKey,
            userStakeEntry: user1Entry,
            poolState: pool
            })
            .signers([userKeypair1])
            .rpc()

        let userAta = await getAssociatedTokenAddress(tokenMint, userKeypair1.publicKey)

        await program.methods.stake(new BN(100 * LAMPORTS_PER_SOL))
            .accounts({
                pool: pool,
                tokenVault: stakeVault,
                user: userKeypair1.publicKey,
                userStakeEntry: user1Entry,
                userTokenAccount: userAta,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId
            })
            .signers([userKeypair1])
            .rpc()

        // try to unstake another user's tokens
        try {
            userAta = await getAssociatedTokenAddress(tokenMint, userKeypair2.publicKey)
            await program.methods.unstake()
                .accounts({
                    pool: pool,
                    tokenVault: stakeVault,
                    user: userKeypair2.publicKey,
                    userStakeEntry: user1Entry,
                    userTokenAccount: userAta,
                    vaultAuthority: vaultAuthority,
                    tokenMint: tokenMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId
                })
                .signers([userKeypair2])
                .rpc()
        } catch (e) {
            console.log(e.message)
            expect(e.message).to.eq("AnchorError caused by account: user. Error Code: InvalidUser. Error Number: 6005. Error Message: Invalid user provided.")
        }
    })
})