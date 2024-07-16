import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import {
    mplCandyMachine as mplCoreCandyMachine, create,
    addConfigLines,
    fetchCandyMachine,
    deleteCandyMachine,
    mintV1,
} from "@metaplex-foundation/mpl-core-candy-machine";
import {
    generateSigner,
    transactionBuilder,
    keypairIdentity,
    some,
    sol,
    dateTime,
} from '@metaplex-foundation/umi';
import { createCollectionV1 } from '@metaplex-foundation/mpl-core';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import { readFileSync } from 'fs';

import { publicKey } from "@metaplex-foundation/umi";



// Create Umi Instance
const umi = createUmi('https://api.devnet.solana.com', 'processed').use(mplCoreCandyMachine())

const walletPath = './wallet-keypair.json';
const secretKey = JSON.parse(readFileSync(walletPath, 'utf-8'));

// Create a keypair from your private key
const signer_keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(secretKey))

// Register it to the Umi client.
umi.use(keypairIdentity(signer_keypair))

const txConfig = {
    send: { skipPreflight: true },
    confirm: { commitment: 'processed' },
}

const collectionMint = generateSigner(umi);
const treasury = generateSigner(umi);
const candyMachine = generateSigner(umi);

async function checkCandyMachine(
    umi,
    candyMachine,
    expectedCandyMachineState,
    step
) {
    try {
        const loadedCandyMachine = await fetchCandyMachine(umi, candyMachine, txConfig.confirm);
        const { itemsLoaded, itemsRedeemed, authority, collection } = expectedCandyMachineState;
        if (Number(loadedCandyMachine.itemsRedeemed) !== itemsRedeemed) {
            throw new Error('Incorrect number of items available in the Candy Machine.');
        }
        if (loadedCandyMachine.itemsLoaded !== itemsLoaded) {
            throw new Error('Incorrect number of items loaded in the Candy Machine.');
        }
        if (loadedCandyMachine.authority.toString() !== authority.toString()) {
            throw new Error('Incorrect authority in the Candy Machine.');
        }
        if (loadedCandyMachine.collectionMint.toString() !== collection.toString()) {
            throw new Error('Incorrect collection in the Candy Machine.');
        }
        step && console.log(`${step}. ✅ - Candy Machine has the correct configuration.`);
    } catch (error) {
        if (error instanceof Error) {
            step && console.log(`${step}. ❌ - Candy Machine incorrect configuration: ${error.message}`);
        } else {
            step && console.log(`${step}. ❌ - Error fetching the Candy Machine.`);
        }
    }
}

async function main() {

    console.log(`Testing Candy Machine Core...`);
    console.log(`Important account information:`)
    console.table({
        keypair: signer_keypair.publicKey.toString(),
        collectionMint: collectionMint.publicKey.toString(),
        treasury: treasury.publicKey.toString(),
        candyMachine: candyMachine.publicKey.toString(),
    });
    const price = 0.01;

    const balance = await umi.rpc.getBalance(signer_keypair.publicKey)
    console.log(`balance => ` , Number(balance.basisPoints) / 1000000000)

    // 1. Airdrop 5 SOL to the keypair
    // if (Number(balance.basisPoints) == 0) {
    //     try {
    //         await umi.rpc.airdrop(signer_keypair.publicKey, sol(5), txConfig.confirm);
    //         console.log(`1. ✅ - Airdropped 100 SOL to the ${signer_keypair.publicKey.toString()}`)
    //     } catch (error) {
    //         console.log('1. ❌ - Error airdropping SOL to the wallet. => ', error);
    //     }
    // } else {
    //     console.log(`1. 💰 - Wallet ${signer_keypair.publicKey.toString()} already have ${Number(balance.basisPoints)} SOL `)
    // }

    // 2. Create a collection
    try {
        console.log(`2. 🚀 - Trying to created collection ...`)
        await createCollectionV1(umi, {
            collection: collectionMint,
            name: 'Vieilles Charrues 2017',
            uri: 'https://arweave.net/p5-KcvElq76IHyHukVcKGo_y1vM5C7asQowUhfn_0Xs',
        }).sendAndConfirm(umi, txConfig);
        console.log(`2. ✅ - Created collection: ${collectionMint.publicKey.toString()}`)
    } catch (error) {
        console.log('2. ❌ - Error creating collection.');
    }

    // 3. Create a Candy Machine
    try {
        console.log(`3. 🚀 - Trying to created Candy Machine ...`)
        const createIx = await create(umi, {
            candyMachine,
            collection: collectionMint.publicKey,
            collectionUpdateAuthority: umi.identity,
            itemsAvailable: 3,
            authority: umi.identity.publicKey,
            isMutable: false,
            configLineSettings: some({
                prefixName: 'Tickets #',
                nameLength: 9,
                prefixUri: 'https://example.com/metadata/',
                uriLength: 29,
                isSequential: false,
            }),
            guards: {
                
                // botTax: some({ lamports: sol(0.001), lastInstruction: true }),
                solPayment: some({ lamports: sol(price) , destination: treasury.publicKey }),
                // startDate: some({ date: dateTime('2023-04-04T16:00:00Z') }),
                // All other guards are disabled...
            }
        })
        await createIx.sendAndConfirm(umi, txConfig);
        console.log(`3. ✅ - Created Candy Machine: ${candyMachine.publicKey.toString()}`)
    } catch (error) {
        console.log('3. ❌ - Error creating Candy Machine.');
    }

    // 4. Add items to the Candy Machine
    try {
        console.log(`4. 🚀 - Trying to adds items to Candy Machine ...`)
        await addConfigLines(umi, {
            candyMachine: candyMachine.publicKey,
            index: 0,
            configLines: [
                { name: '1', uri: '1.json' },
                { name: '2', uri: '2.json' },
                { name: '3', uri: '3.json' },
            ],
        }).sendAndConfirm(umi, txConfig);
        console.log(`4. ✅ - Added items to the Candy Machine: ${candyMachine.publicKey.toString()}`)
    } catch (error) {
        console.log('4. ❌ - Error adding items to the Candy Machine.');
    }

    // 5. Verify the Candy Machine configuration
    await checkCandyMachine(umi, candyMachine.publicKey, {
        itemsLoaded: 3,
        authority: umi.identity.publicKey,
        collection: collectionMint.publicKey,
        itemsRedeemed: 0,
    }, 5);


    //6. Fetch the Candy Machine
    try {
        const candyMachineId = candyMachine.publicKey.toString();
        const candyMachineDatas = await fetchCandyMachine( umi, publicKey(candyMachineId));
    
        console.log(candyMachineDatas)
        console.log('Items:', JSON.stringify(candyMachineDatas.items, null, 2));
        console.log('6. ✅ - Fetched the Candy Machine.');
        console.log('We have ',candyMachineDatas.items.length, 'items waiting to be minted');
        console.log('The price is ', price, 'SOL')

    } catch (error) {
        console.log('6. ❌ - Error fetching the Candy Machine');
    }


//     // 6. Mint NFTs
//     try {
//         console.log(`6. 🚀 - Trying to mint NFT  in collection ${collectionMint.publicKey} ...`)
//         const numMints = 3;
//         let minted = 0;
//         for (let i = 0; i < numMints; i++) {
//             await transactionBuilder()
//                 .add(setComputeUnitLimit(umi, { units: 800_000 }))
//                 .add(
//                     mintV1(umi, {
//                         candyMachine: candyMachine.publicKey,
//                         asset: generateSigner(umi),
//                         collection: collectionMint.publicKey,
//                         mintArgs: {
//                             solPayment: some({ destination: treasury.publicKey, value : 1000000 }),
//                         },
//                     })
//                 )
//                 .sendAndConfirm(umi, txConfig);
//             minted++;
//         }
//         console.log(`6. ✅ - Minted ${minted} NFTs.`);
//     } catch (error) {
//         console.log('6. ❌ - Error minting NFTs.');
//     }

//     // 7. Verify the Candy Machine configuration
//     await checkCandyMachine(umi, candyMachine.publicKey, {
//         itemsLoaded: 3,
//         authority: umi.identity.publicKey,
//         collection: collectionMint.publicKey,
//         itemsRedeemed: 3,
//     }, 7);

//     // 8. Delete the Candy Machine
//     try {
//         console.log(`8. 🚀 - Trying to delete Candy Machine ...`)
//         await deleteCandyMachine(umi, {
//             candyMachine: candyMachine.publicKey,
//         }).sendAndConfirm(umi, txConfig);
//         console.log(`8. ✅ - Deleted the Candy Machine: ${candyMachine.publicKey.toString()}`);
//     } catch (error) {
//         console.log('8. ❌ - Error deleting the Candy Machine.');
//     }

}

main().catch(console.error);