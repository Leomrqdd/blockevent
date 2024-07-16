import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Metaplex, keypairIdentity, bundlrStorage, toMetaplexFile, toBigNumber, toDateTime, sol, TransactionBuilder} from "@metaplex-foundation/js";
import { readFile } from 'fs/promises';


const REACT_APP_RPC_URL='https://api.devnet.solana.com'
const SOLANA_CONNECTION = new Connection(REACT_APP_RPC_URL, { commitment: 'finalized' });

const secret = JSON.parse(await readFile(new URL('./my-wallet.json', import.meta.url)));
const WALLET = Keypair.fromSecretKey(new Uint8Array(secret));
const NFT_METADATA = 'https://arweave.net/p5-KcvElq76IHyHukVcKGo_y1vM5C7asQowUhfn_0Xs'; 
const COLLECTION_NFT_MINT = 'CmwZNwE1vp9FRkQoRhaFNDCgzX19tpaP9H6XSji9idLm'; 
const CANDY_MACHINE_ID = 'HPuaPjVLWM9CnNLoMuTcfSt6Mra29F1UP3dwkaXgKDmD';
const METAPLEX = Metaplex.make(SOLANA_CONNECTION)
    .use(keypairIdentity(WALLET));


// async function createCollectionNft() {
//     const { nft: collectionNft } = await METAPLEX.nfts().create({
//         name: "Vieilles Charrues",
//         uri: NFT_METADATA,
//         sellerFeeBasisPoints: 0,
//         isCollection: true,
//         updateAuthority: WALLET,
//       });

//       console.log(`✅ - Minted Collection NFT: ${collectionNft.address.toString()}`);
//       console.log(`     https://explorer.solana.com/address/${collectionNft.address.toString()}?cluster=devnet`);
// }

// createCollectionNft();


// async function generateCandyMachine() {
//     const candyMachineSettings =
//         {
//             itemsAvailable: toBigNumber(3), // Collection Size: 3
//             sellerFeeBasisPoints: 500, // 5% Royalties on Collection
//             symbol: "VC",
//             maxEditionSupply: toBigNumber(0), // 0 reproductions of each NFT allowed
//             isMutable: true,
//             creators: [
//                 { address: WALLET.publicKey, share: 100 },
//             ],
//             collection: {
//                 address: new PublicKey(COLLECTION_NFT_MINT), // Can replace with your own NFT or upload a new one
//                 updateAuthority: WALLET,
//             },
//         };
//     const { candyMachine } = await METAPLEX.candyMachines().create(candyMachineSettings);
//     console.log(`✅ - Created Candy Machine: ${candyMachine.address.toString()}`);
//     console.log(`     https://explorer.solana.com/address/${candyMachine.address.toString()}?cluster=devnet`);
// }

// generateCandyMachine();


// async function updateCandyMachine() {
//     const candyMachine = await METAPLEX
//         .candyMachines()
//         .findByAddress({ address: new PublicKey(CANDY_MACHINE_ID) });

//     const { response } = await METAPLEX.candyMachines().update({
//         candyMachine,
//         guards: {
//             // startDate: { date: toDateTime("2022-10-17T16:00:00Z") },
//             mintLimit: {
//                 id: 1,
//                 limit: 2,
//             },
//             solPayment: {
//                 amount: sol(0.1),
//                 destination: new PublicKey('GSSZFXo6SmU5ENTjMbxu2nZMcP24vjfo96VfiRSC1Z8w'), //my wallet on Phantom
//             },
//         }
//     })
    
//     console.log(`✅ - Updated Candy Machine: ${CANDY_MACHINE_ID}`);
//     console.log(`     https://explorer.solana.com/tx/${response.signature}?cluster=devnet`);
// }


// updateCandyMachine();


async function addItems() {
    const candyMachine = await METAPLEX
        .candyMachines()
        .findByAddress({ address: new PublicKey(CANDY_MACHINE_ID) }); 
    const items = [];
    for (let i = 0; i < 3; i++ ) { // Add 3 NFTs (the size of our collection)
        items.push({
            name: `Tickets # ${i+1}`,
            uri: NFT_METADATA
        })
    }
    const { response } = await METAPLEX.candyMachines().insertItems({
        candyMachine,
        items: items,
      },{commitment:'finalized'});

    console.log(`✅ - Items added to Candy Machine: ${CANDY_MACHINE_ID}`);
    console.log(`     https://explorer.solana.com/tx/${response.signature}?cluster=devnet`);
}

addItems();