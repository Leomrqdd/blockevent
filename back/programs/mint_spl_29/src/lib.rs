use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to,Mint,MintTo,Token,TokenAccount},
    metadata::{
        create_metadata_accounts_v3,
        mpl_token_metadata::types::DataV2,
        CreateMetadataAccountsV3,
        Metadata as Metaplex,
    },
};
use solana_program::system_instruction;


declare_id!("5wrfmBvkFaayrm8XYgXTvway4Rxt6ZBedt7sB4Z36A9c");

#[program]
mod token_minter {
    use super::*;

    pub fn init_token(ctx: Context<InitToken>, metadata: InitTokenParams) -> Result<()> {
        let seeds = &["mint".as_bytes(),&[ctx.bumps.mint]];
        let signer = [&seeds[..]];

        let token_data : DataV2 = DataV2 {
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
            seller_fee_basis_points : 0,
            creators : None,
            collection : None,
            uses : None,
        };


        let metadata_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                payer : ctx.accounts.payer.to_account_info(),
                update_authority : ctx.accounts.mint.to_account_info(),
                mint : ctx.accounts.mint.to_account_info(),
                metadata : ctx.accounts.metadata.to_account_info(),
                mint_authority : ctx.accounts.mint.to_account_info(),
                system_program : ctx.accounts.system_program.to_account_info(),
                rent : ctx.accounts.rent.to_account_info(),
            },
            &signer,
        );

        create_metadata_accounts_v3(
            metadata_ctx,
            token_data,
            false,
            true,
            None,
        )?;
        msg!("Token mint created successfully.");
        Ok(())
    }

    pub fn mint_tokens(ctx: Context<MintTokens>, quantity: u64) -> Result<()> {
        msg!("Minting tokens: {:?}", quantity);
        let seeds = &["mint".as_bytes(),&[ctx.bumps.mint]];
        let signer = [&seeds[..]];

        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    authority : ctx.accounts.mint.to_account_info(),
                    to : ctx.accounts.destination.to_account_info(),
                    mint : ctx.accounts.mint.to_account_info(),
                },
                &signer,
            ),
            quantity,
        )?;

        msg!("Tokens minted successfully.");

        Ok(())
    }

    pub fn start_auction(ctx: Context<StartAuction>, duration: i64) -> Result<()> {
        //duration in seconds 
        let auction = &mut ctx.accounts.auction;
        auction.token_mint = ctx.accounts.mint.key();
        auction.highest_bid = 0;
        auction.highest_bidder = Pubkey::default();
        auction.end_time = Clock::get()?.unix_timestamp + duration;
        auction.claimed = false;
        Ok(())
    }

    pub fn place_bid(ctx: Context<PlaceBid>, bid_amount: u64) -> Result<()> {
        //place bid in lamports
        let auction = &mut ctx.accounts.auction;
        let clock = Clock::get()?;
        require!(clock.unix_timestamp < auction.end_time, AuctionError::AuctionEnded);

        if bid_amount > auction.highest_bid {
            auction.highest_bid = bid_amount;
            auction.highest_bidder = ctx.accounts.bidder.key();
        } else {
            return Err(AuctionError::BidTooLow.into());
        }

        Ok(())
    }

    pub fn claim_nft(ctx: Context<ClaimNft>) -> Result<()> { // one instruction
        let auction = &mut ctx.accounts.auction;
        let clock = Clock::get()?;
        require!(clock.unix_timestamp >= auction.end_time, AuctionError::AuctionNotEnded);
        require!(ctx.accounts.claimant.key() == auction.highest_bidder, AuctionError::NotHighestBidder);
        require!(auction.claimed == false, AuctionError::AlreadyClaimed);

        // Transfer SOL from highest bidder to the auction creator
        let ix = system_instruction::transfer(
            &ctx.accounts.claimant.key(),
            &ctx.accounts.treasury.key(),
            auction.highest_bid,
        );
        anchor_lang::solana_program::program::invoke(  // if invoke failed, instruction failed and not mint
            &ix,
            &[
                ctx.accounts.claimant.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info()
            ],
        )?;

        let seeds = &["mint".as_bytes(), &[ctx.bumps.mint]];
        let signer = [&seeds[..]];
    
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    authority: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.highest_bidder_token_account.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                },
                &signer,
            ),
            1, // Minting 1 token (NFT) to the highest bidder
        )?;

        auction.claimed = true;

        Ok(())
    }
}



#[derive(Accounts)]
#[instruction(params:InitTokenParams)]
pub struct InitToken<'info> {
     /// CHECK: This account is unchecked because we are creating a new metadata account.

    #[account(mut)]
    pub metadata : UncheckedAccount<'info>,
    #[account(
        init,
        seeds = [b"mint"],
        bump,
        payer = payer,
        mint::decimals = params.decimals,
        mint::authority = mint,
    )]
    pub mint : Account<'info, Mint>,
    #[account(mut)]
    pub payer : Signer<'info>,
    pub rent : Sysvar<'info, Rent>,
    pub system_program : Program<'info, System>,
    pub token_program : Program<'info, Token>,
    pub token_metadata_program : Program<'info, Metaplex>,


}


#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(
        mut,
        seeds = [b"mint"],
        bump,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub destination: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}



#[derive(AnchorSerialize,AnchorDeserialize,Debug,Clone)]
pub struct InitTokenParams {
    pub name: String,
    pub symbol : String,
    pub uri : String,
    pub decimals : u8,
}


#[derive(Accounts)]
pub struct StartAuction<'info> {
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + 32 + 8 + 32 + 8 + 8,
        seeds = [b"auction", mint.key().as_ref()],
        bump
    )]
    pub auction: Account<'info, Auction>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBid<'info> {
    #[account(mut)]
    pub auction: Account<'info, Auction>,
    #[account(mut)]
    pub bidder: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimNft<'info> {
    #[account(mut)]
    pub auction: Account<'info, Auction>,
    // #[account(mut)]
    // pub token_account: Account<'info, TokenAccount>,
    #[account(init_if_needed, payer = claimant, associated_token::mint = mint, associated_token::authority = claimant)]
    pub highest_bidder_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub claimant: Signer<'info>,
    #[account(mut)]
    pub treasury: AccountInfo<'info>, //treasury account 
    #[account(
        mut,
        seeds = [b"mint"],
        bump,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}




#[account]
pub struct Auction {
    pub token_mint: Pubkey,
    pub highest_bid: u64,
    pub highest_bidder: Pubkey,
    pub end_time: i64,
    pub claimed : bool,
}




#[error_code]
pub enum AuctionError {
    #[msg("The auction has already ended.")]
    AuctionEnded,
    #[msg("The bid is too low.")]
    BidTooLow,
    #[msg("The auction has not ended yet.")]
    AuctionNotEnded,
    #[msg("The claimant is not the highest bidder.")]
    NotHighestBidder,
    #[msg("The auction has already been claimed.")]
    AlreadyClaimed,

}

