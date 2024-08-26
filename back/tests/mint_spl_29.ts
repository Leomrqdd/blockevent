import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { TokenMinter } from "../target/types/token_minter";
import { assert, expect } from "chai";


describe("bid auction", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  //common setup for all tests
  const program = anchor.workspace.TokenMinter as Program<TokenMinter>;
  const payer = Keypair.generate();
  const treasury = Keypair.generate();
  const highestBidder = Keypair.generate();
  const lowestBidder = Keypair.generate();

  console.log("payer", payer.publicKey.toBase58());
  console.log("treasury", treasury.publicKey.toBase58());
  console.log("highestBidder", highestBidder.publicKey.toBase58());
  console.log("lowestBidder", lowestBidder.publicKey.toBase58());


  const METADATA_SEED = "metadata";
  const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

  const MINT_SEED = "mint"
  const metadata = {
    name : "Vieilles Charrues_SPL",
    symbol : "VC",
    uri : "https://arweave.net/bPd0YFzZXiH6SgXuAqLIpV0vnPbn0PA8rJ1169nnZ8M",
    decimals : 0,
  }

  const mintAmount = 1;
  const [mint] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(MINT_SEED)],
    program.programId
  )


  const [metadataAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(METADATA_SEED),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );


  it("it should initialize the spl token for the bid auction", async () => {
    // Add your test here.
    const airdropSignature = await provider.connection.requestAirdrop(
      payer.publicKey,
      15 * anchor.web3.LAMPORTS_PER_SOL // Airdrop 15 SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);
    const info = await program.provider.connection.getAccountInfo(mint);
    if (info) {
      return; // skip if already initialized
    }
    console.log("Mint not created, Attempting to initialize");

    const context = {
      metadata : metadataAddress,
      mint,
      payer : payer.publicKey,
      rent : anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram : anchor.web3.SystemProgram.programId,
      tokenProgram : TOKEN_PROGRAM_ID,
      tokenMetadataProgram : TOKEN_METADATA_PROGRAM_ID,
    };

    const txHash = await program.methods
    .initToken(metadata)
    .accounts(context)
    .signers([payer])
    .rpc();
    await provider.connection.confirmTransaction(txHash, 'finalized');
    const newInfo = await provider.connection.getAccountInfo(metadataAddress);
    assert(newInfo, "  Mint should be initialized.");
    console.log("Mint initialized");
  });

  it("it should mint a token correctly", async () => {

    const destination = await anchor.utils.token.associatedAddress({
      mint: mint,
      owner: payer.publicKey,
    });

    let initialBalance: number;

    try {
      const balance = (await provider.connection.getTokenAccountBalance(destination))
      initialBalance = balance.value.uiAmount;
    } catch {
      // Token account not yet initiated has 0 balance
      initialBalance = 0;
    } 
    
    const context = {
      mint,
      destination,
      payer: payer.publicKey,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    };

    const txHash = await program.methods
      .mintTokens(new BN(mintAmount * 1 ** metadata.decimals))
      .accounts(context)
      .signers([payer])
      .rpc();
    await provider.connection.confirmTransaction(txHash);


    const postBalance = (
      await provider.connection.getTokenAccountBalance(destination)
    ).value.uiAmount;

    assert.equal(
      initialBalance + mintAmount,
      postBalance,
      "Post balance should equal initial plus mint amount"
    );

    console.log("Tokens minted on the payer ATA");
  });

  it("it should start the auction correctly", async () => {
    const [auction, bump] = await PublicKey.findProgramAddress(
      [Buffer.from("auction"), mint.toBuffer()],
      program.programId
    );
    const duration = 5 ; // seconds

    const txHash = await program.methods
      .startAuction(new anchor.BN(duration))
      .accounts({
        auction: auction,
        mint: mint,
        payer: payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([payer])
      .rpc();
    

    

    const auctionAccount = await program.account.auction.fetch(auction);
    assert.ok(auctionAccount.tokenMint.equals(mint));
    assert.ok(auctionAccount.highestBid.eq(new BN(0)));
    assert.ok(auctionAccount.highestBidder.equals(PublicKey.default));
    
      // Vérification de la durée
    const currentTime = Math.floor(Date.now() / 1000);
    console.log("currentTime", currentTime);
    const expectedEndTime = currentTime + duration;
    console.log("auctionAccount.endTime", Number(auctionAccount.endTime));
    assert.ok(
      Math.abs(Number(auctionAccount.endTime) - expectedEndTime) < 5,
      ` Expected end time to be within 5 seconds of ${expectedEndTime}, but got ${auctionAccount.endTime}`
  );

    console.log("Auction started, duration in seconds : ", duration);

  });


  it("it should place a bid correctly", async () => {
    
    const airdropSignature = await provider.connection.requestAirdrop(
      highestBidder.publicKey,
      15 * anchor.web3.LAMPORTS_PER_SOL // Airdrop 15 SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);

    const [auction, bump] = await PublicKey.findProgramAddress(
      [Buffer.from("auction"), mint.toBuffer()],
      program.programId
    );


    const bidAmount = 200000; //lamports

    await program.methods
    .placeBid(new BN(bidAmount))
    .accounts({
      auction : auction,
      bidder : highestBidder.publicKey,
    })
    .signers([highestBidder])
    .rpc()

    const auctionAccount = await program.account.auction.fetch(auction);
    assert.ok(auctionAccount.highestBid.eq(new BN(bidAmount)));
    assert.ok(auctionAccount.highestBidder.equals(highestBidder.publicKey));

  });

  it("it should fail to place a bid lower than the first one", async () => {
    
    const [auction, bump] = await PublicKey.findProgramAddress(
      [Buffer.from("auction"), mint.toBuffer()],
      program.programId
    );


    const bidAmount = 100000; //lamports

    try {
      await program.methods
      .placeBid(new BN(bidAmount))
      .accounts({
      auction : auction,
      bidder : highestBidder.publicKey,
    })
    .signers([highestBidder])
    .rpc()
    } catch (error) {
      if (error instanceof anchor.AnchorError) {
        assert.include(error.logs.join(" "), "BidTooLow");
      } else {
        console.error("Unexpected error:", error);
        throw error;
      }
    }

  });



  it("it should fail to claim because the auction is not ended", async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const [auction, bump] = await PublicKey.findProgramAddress(
      [Buffer.from("auction"), mint.toBuffer()],
      program.programId
    );

    const highestBidderTokenAccount = await anchor.utils.token.associatedAddress({
      mint: mint,
      owner: highestBidder.publicKey,
    });

    let initialBalance: number;

    try {
      const balance = (await provider.connection.getTokenAccountBalance(highestBidderTokenAccount))
      initialBalance = balance.value.uiAmount;
    } catch {
      // Token account not yet initiated has 0 balance
      initialBalance = 0;
    } 

      try {
        const txHash = await program.methods
        .claimNft()
        .accounts({
        auction : auction,
        highestBidderTokenAccount : highestBidderTokenAccount,
        claimant : highestBidder.publicKey,
        treasury : treasury.publicKey,
        mint : mint,
        tokenProgram : TOKEN_PROGRAM_ID,
        systemProgram : anchor.web3.SystemProgram.programId,
        associatedTokenProgram : anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    
      })
      .signers([highestBidder])
      .rpc();
    } catch (error) {
        if (error instanceof anchor.AnchorError) {
          assert.include(error.logs.join(" "), "NotEnded");
        } else {
          console.error("Unexpected error:", error);
          throw error;
        }
      }
    });

  it("it should fail to claim because the bidder is not the highest bidder", async () => {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const [auction, bump] = await PublicKey.findProgramAddress(
        [Buffer.from("auction"), mint.toBuffer()],
        program.programId
      );
  
      const airdropSignature = await provider.connection.requestAirdrop(
        lowestBidder.publicKey,
        15 * anchor.web3.LAMPORTS_PER_SOL // Airdrop 15 SOL
      );
      await provider.connection.confirmTransaction(airdropSignature);
  
      const lowestBidderTokenAccount = await anchor.utils.token.associatedAddress({
        mint: mint,
        owner: lowestBidder.publicKey,
      });
  
      let initialBalance: number;
  
      try {
        const balance = (await provider.connection.getTokenAccountBalance(lowestBidderTokenAccount))
        initialBalance = balance.value.uiAmount;
      } catch {
        // Token account not yet initiated has 0 balance
        initialBalance = 0;
      } 
  
        try {
          const txHash = await program.methods
          .claimNft()
          .accounts({
          auction : auction,
          highestBidderTokenAccount : lowestBidderTokenAccount,
          claimant : lowestBidder.publicKey,
          treasury : treasury.publicKey,
          mint : mint,
          tokenProgram : TOKEN_PROGRAM_ID,
          systemProgram : anchor.web3.SystemProgram.programId,
          associatedTokenProgram : anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      
        })
        .signers([lowestBidder])
        .rpc();
      } catch (error) {
          if (error instanceof anchor.AnchorError) {
            assert.include(error.logs.join(" "), "NotHighestBidder");
          } else {
            console.error("Unexpected error:", error);
            throw error;
          }
        }
      });
  
  

  it("it should claim the nft correctly", async () => {
    const [auction, bump] = await PublicKey.findProgramAddress(
      [Buffer.from("auction"), mint.toBuffer()],
      program.programId
    );

    const airdropSignature = await provider.connection.requestAirdrop(
      treasury.publicKey,
      15 * anchor.web3.LAMPORTS_PER_SOL // Airdrop 15 SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);
  
  

    const highestBidderTokenAccount = await anchor.utils.token.associatedAddress({
      mint: mint,
      owner: highestBidder.publicKey,
    });

    let initialBalance: number;

    try {
      const balance = (await provider.connection.getTokenAccountBalance(highestBidderTokenAccount))
      initialBalance = balance.value.uiAmount;
    } catch {
      // Token account not yet initiated has 0 balance
      initialBalance = 0;
    } 

      const txHash = await program.methods
      .claimNft()
      .accounts({
        auction : auction,
        highestBidderTokenAccount : highestBidderTokenAccount,
        claimant : highestBidder.publicKey,
        treasury : treasury.publicKey,
        mint : mint,
        tokenProgram : TOKEN_PROGRAM_ID,
        systemProgram : anchor.web3.SystemProgram.programId,
        associatedTokenProgram : anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    
      })
      .signers([highestBidder])
      .rpc();

      await provider.connection.confirmTransaction(txHash);


    const postBalance = (
      await provider.connection.getTokenAccountBalance(highestBidderTokenAccount)
    ).value.uiAmount;

    const auctionAccount = await program.account.auction.fetch(auction);

    assert.equal(
      await provider.connection.getBalance(treasury.publicKey) -15 * anchor.web3.LAMPORTS_PER_SOL,
      Number(auctionAccount.highestBid),
      "Treasury should have the bid amount"
    );

    assert.equal(
      initialBalance + mintAmount,
      postBalance,
      "Post balance should equal initial plus one because highest bidder claimed his nft"
    );
  });

  it("it should fail to claim the nft if it is already claimed", async () => {
        const [auction, bump] = await PublicKey.findProgramAddress(
      [Buffer.from("auction"), mint.toBuffer()],
      program.programId
    );

    const highestBidderTokenAccount = await anchor.utils.token.associatedAddress({
      mint: mint,
      owner: highestBidder.publicKey,
    });


    try {
      await program.methods
        .claimNft()
        .accounts({
          auction: auction,
          highestBidderTokenAccount: highestBidderTokenAccount,
          claimant: highestBidder.publicKey,
          treasury: treasury.publicKey,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([highestBidder])
        .rpc();
        assert.fail("The transaction should have failed");

    } catch (error) {
      if (error instanceof anchor.AnchorError) {
        assert.include(error.logs.join(" "), "AlreadyClaimed");
      } else {
        console.error("Unexpected error:", error);
        throw error;
      }
    }

  });


  it("it should fail to make a bid because the auction is over", async () => {
    const [auction, bump] = await PublicKey.findProgramAddress(
    [Buffer.from("auction"), mint.toBuffer()],
    program.programId
    );


    const bidAmount = 600000; //lamports

    try {
      await program.methods
      .placeBid(new BN(bidAmount))
      .accounts({
      auction : auction,
      bidder : highestBidder.publicKey,
    })
    .signers([highestBidder])
    .rpc()
    } catch (error) {
      if (error instanceof anchor.AnchorError) {
        assert.include(error.logs.join(" "), "AuctionEnded");
      } else {
        console.error("Unexpected error:", error);
        throw error;
      }
    }

  });

});




describe("no initialization", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  //common setup for all tests
  const program = anchor.workspace.TokenMinter as Program<TokenMinter>;
  const payer = Keypair.generate();
  const treasury = Keypair.generate();
  const highestBidder = Keypair.generate();
  const lowestBidder = Keypair.generate();
  const otherBidder = Keypair.generate();

  console.log("payer", payer.publicKey.toBase58());
  console.log("treasury", treasury.publicKey.toBase58());
  console.log("highestBidder", highestBidder.publicKey.toBase58());
  console.log("lowestBidder", lowestBidder.publicKey.toBase58());
  console.log("otherBidder", otherBidder.publicKey.toBase58());


  const METADATA_SEED = "metadata";
  const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

  const MINT_SEED = "mint"
  const metadata = {
    name : "Vieilles Charrues_SPL",
    symbol : "VC",
    uri : "https://arweave.net/bPd0YFzZXiH6SgXuAqLIpV0vnPbn0PA8rJ1169nnZ8M",
    decimals : 0,
  }

  const mintAmount = 1;
  const [mint] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(MINT_SEED)],
    program.programId
  )


  const [metadataAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(METADATA_SEED),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );


  it("it should initialize the spl token for the bid auction", async () => {
    // Add your test here.
    const airdropSignature = await provider.connection.requestAirdrop(
      payer.publicKey,
      15 * anchor.web3.LAMPORTS_PER_SOL // Airdrop 15 SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);
    const info = await program.provider.connection.getAccountInfo(mint);
    if (info) {
      return; // skip if already initialized
    }
    console.log("Mint not created, Attempting to initialize");

    const context = {
      metadata : metadataAddress,
      mint,
      payer : payer.publicKey,
      rent : anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram : anchor.web3.SystemProgram.programId,
      tokenProgram : TOKEN_PROGRAM_ID,
      tokenMetadataProgram : TOKEN_METADATA_PROGRAM_ID,
    };

    const txHash = await program.methods
    .initToken(metadata)
    .accounts(context)
    .signers([payer])
    .rpc();
    await provider.connection.confirmTransaction(txHash, 'finalized');
    const newInfo = await provider.connection.getAccountInfo(metadataAddress);
    assert(newInfo, "  Mint should be initialized.");
    console.log("Mint initialized");
  });

  it("it should mint a token correctly", async () => {

    const destination = await anchor.utils.token.associatedAddress({
      mint: mint,
      owner: payer.publicKey,
    });

    let initialBalance: number;

    try {
      const balance = (await provider.connection.getTokenAccountBalance(destination))
      initialBalance = balance.value.uiAmount;
    } catch {
      // Token account not yet initiated has 0 balance
      initialBalance = 0;
    } 
    
    const context = {
      mint,
      destination,
      payer: payer.publicKey,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    };

    const txHash = await program.methods
      .mintTokens(new BN(mintAmount * 1 ** metadata.decimals))
      .accounts(context)
      .signers([payer])
      .rpc();
    await provider.connection.confirmTransaction(txHash);


    const postBalance = (
      await provider.connection.getTokenAccountBalance(destination)
    ).value.uiAmount;

    assert.equal(
      initialBalance + mintAmount,
      postBalance,
      "Post balance should equal initial plus mint amount"
    );

    console.log("Tokens minted on the payer ATA");
  });



  // it("it should fail to place a bid because the auction is not initialized", async () => {
    
  //   const airdropSignature = await provider.connection.requestAirdrop(
  //     highestBidder.publicKey,
  //     15 * anchor.web3.LAMPORTS_PER_SOL // Airdrop 15 SOL
  //   );
  //   await provider.connection.confirmTransaction(airdropSignature);

  //   const [auction, bump] = await PublicKey.findProgramAddress(
  //     [Buffer.from("auction"), mint.toBuffer()],
  //     program.programId
  //   );


  //   const bidAmount = 200000; //lamports

  //   try {
  //   await program.methods
  //   .placeBid(new BN(bidAmount))
  //   .accounts({
  //     auction : auction,
  //     bidder : highestBidder.publicKey,
  //   })
  //   .signers([highestBidder])
  //   .rpc()
  //   } catch (error) {
  //     console.log("error", error);
  //   }


//});

});
