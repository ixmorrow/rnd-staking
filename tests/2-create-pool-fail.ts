import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { HedgeTakeHome } from "../target/types/hedge_take_home"
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, createMint, setAuthority, AuthorityType } from '@solana/spl-token'
import { delay, initializeTestUsers, safeAirdrop } from './utils/util'
import { incorrectProgramAuthority } from './testKeypairs/testKeypairs'
import { expect } from "chai"


describe("test persmissioned instructions", async () => {
    anchor.setProvider(anchor.AnchorProvider.env())

    const program = anchor.workspace.HedgeTakeHome as Program<HedgeTakeHome>
    const provider = anchor.AnchorProvider.env()

    let tokenMint: PublicKey = null
    let stakeVault: PublicKey = null
    let pool: PublicKey = null

    // generate new keypair for incorrect program authority
    const programAuthority = incorrectProgramAuthority


    let [vaultAuthority, vaultAuthBump] = await PublicKey.findProgramAddress(
        [Buffer.from("vault_authority")],
        program.programId
    )

    it("Create stake pool with incorrect program authority", async () => {
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
                expect(true, "promise should fail").eq(false)
        } catch (e) {
            console.log(e.message)
            expect(e.message).to.eq("AnchorError caused by account: program_authority. Error Code: InvalidProgramAuthority. Error Number: 6003. Error Message: Incorrect program authority.")
        }
    })
})