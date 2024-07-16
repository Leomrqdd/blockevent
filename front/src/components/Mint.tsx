import React, { useEffect, useState } from 'react';
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { Metaplex, keypairIdentity, sol, walletAdapterIdentity } from "@metaplex-foundation/js";
import { useConnection, useWallet } from '@solana/wallet-adapter-react';

const CANDY_MACHINE_ID = 'HPuaPjVLWM9CnNLoMuTcfSt6Mra29F1UP3dwkaXgKDmD';
const AUTHORITY = "CCaZAXustnWzSegL8x3EwPQ6m39GLXo6HggB8TmTdzps";  

const MintButton = () => {
  const [minting, setMinting] = useState(false);
  const [mintCount, setMintCount] = useState(1);
  const [remaining, setRemaining] = useState(0);
  const [price, setPrice] = useState(0);
  const { publicKey,wallet } = useWallet();
  const { connection } = useConnection();
  const METAPLEX = Metaplex.make(connection).use(walletAdapterIdentity(wallet.adapter));

  useEffect(() => {
    const fetchCandyMachine = async () => {
      try {
        const candyMachine = await METAPLEX.candyMachines().findByAddress({ address: new PublicKey(CANDY_MACHINE_ID) });
        setRemaining(candyMachine.itemsRemaining.toNumber());
        const priceInBasisPoints = candyMachine.candyGuard.guards.solPayment.amount.basisPoints.toNumber();
        setPrice(priceInBasisPoints/1000000000)
      } catch (error) {
        console.error("Failed to fetch candy machine", error);
      }
    };

    fetchCandyMachine();
  }, [METAPLEX]);


  const handleMint = async () => {
    setMinting(true);
    try {
      const candyMachine = await METAPLEX.candyMachines().findByAddress({ address: new PublicKey(CANDY_MACHINE_ID) });
      const { nft, response } = await METAPLEX.candyMachines().mint({
        candyMachine,
        collectionUpdateAuthority: new PublicKey(AUTHORITY),
      },{commitment:'finalized'});
      console.log(`✅ - Minted NFT: ${nft.address.toString()}`);
      console.log(`     https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`);
      console.log(`     https://explorer.solana.com/tx/${response.signature}?cluster=devnet`);
    } catch (error) {
      console.error("Minting failed", error);
    } finally {
      setMinting(false);
    }
  };

  return (
    <div className="bg-gray-900 text-white p-6 rounded-lg text-center w-80 mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div className="text-lg mb-2">Remaining: {remaining}</div>
        <div className="text-lg mb-2">Price: {price} SOL</div>
      </div>
      <button 
        className={`bg-purple-600 text-white px-6 py-3 rounded text-lg ${minting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-700'}`} 
        onClick={handleMint} 
        disabled={minting}
      >
        {minting ? 'Minting...' : 'MINT'}
      </button>
      <div className="mt-4 text-sm text-gray-400">Powered by METAPLEX</div>
    </div>
  );
};

export default MintButton;