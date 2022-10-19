import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { HedgeTakeHome } from "../target/types/hedge_take_home"
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, createMint, setAuthority, AuthorityType, getAssociatedTokenAddress } from '@solana/spl-token'
import { delay, initializeTestUsers, safeAirdrop } from './utils/util'
import { incorrectProgramAuthority, programAuthority, userKeypair1 } from './testKeypairs/testKeypairs'
import { expect } from "chai"
import { BN } from "bn.js"


describe("test persmissioned instructions", async () => {
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

    it("Distribute and burn tokens with incorrect authority", async () => {
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
    
        try {
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

            const userAta = await getAssociatedTokenAddress(tokenMint, userKeypair1.publicKey)
            
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
        } catch (e) {
            console.log(e)
        }

        // call distribute instruction with incorrect program authority
        try {
            await program.methods.distribute(new BN(250 * LAMPORTS_PER_SOL))
                .accounts({
                programAuthority: incorrectProgramAuthority.publicKey,
                poolState: pool,
                tokenVault: stakeVault,
                tokenMint: tokenMint,
                mintAuth: vaultAuthority,
                tokenProgram: TOKEN_PROGRAM_ID
                })
                .signers([incorrectProgramAuthority])
                .rpc()
            expect(true, "promise should fail").eq(false)
        } catch (e) {
            console.log(e.message)
            expect(e.message).to.eq("AnchorError caused by account: program_authority. Error Code: InvalidProgramAuthority. Error Number: 6003. Error Message: Incorrect program authority.")
        }

        // call distribute instruction without program authority signature
        try {
            await program.methods.distribute(new BN(250 * LAMPORTS_PER_SOL))
                .accounts({
                programAuthority: programAuthority.publicKey,
                poolState: pool,
                tokenVault: stakeVault,
                tokenMint: tokenMint,
                mintAuth: vaultAuthority,
                tokenProgram: TOKEN_PROGRAM_ID
                })
                .rpc()
            expect(true, "promise should fail").eq(false)
        } catch (e) {
            console.log(e.message)
            expect(e.message).to.eq("Signature verification failed")
        }

        // call burn instruction with incorrect program authority
        try {
            await program.methods.burn(new BN(25 * LAMPORTS_PER_SOL))
                .accounts({
                programAuthority: incorrectProgramAuthority.publicKey,
                poolState: pool,
                tokenVault: stakeVault,
                tokenMint: tokenMint,
                vaultAuthority: vaultAuthority,
                tokenProgram: TOKEN_PROGRAM_ID
                })
                .signers([incorrectProgramAuthority])
                .rpc()
            expect(true, "promise should fail").eq(false)
        } catch (e) {
            console.log(e.message)
            expect(e.message).to.eq("AnchorError caused by account: program_authority. Error Code: InvalidProgramAuthority. Error Number: 6003. Error Message: Incorrect program authority.")
        }

        // call burn instruction without program authority signature
        try {
            await program.methods.burn(new BN(25 * LAMPORTS_PER_SOL))
                .accounts({
                programAuthority: programAuthority.publicKey,
                poolState: pool,
                tokenVault: stakeVault,
                tokenMint: tokenMint,
                vaultAuthority: vaultAuthority,
                tokenProgram: TOKEN_PROGRAM_ID
                })
                .rpc()
            expect(true, "promise should fail").eq(false)
        } catch (e) {
            console.log(e.message)
            expect(e.message).to.eq("Signature verification failed")
        }
    })
})