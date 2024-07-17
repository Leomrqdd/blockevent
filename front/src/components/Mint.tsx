import React, { useEffect, useState } from 'react';
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { Metaplex, keypairIdentity, sol, walletAdapterIdentity } from "@metaplex-foundation/js";
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { notify } from 'utils/notifications';

const CANDY_MACHINE_ID = 'GFL2Q47XzJxZedjm6Dskdhviw82c73AxPh8epcbgaZtz';
const AUTHORITY = "CCaZAXustnWzSegL8x3EwPQ6m39GLXo6HggB8TmTdzps";  

const MintButton = () => {
  const [minting, setMinting] = useState(false);
  const [mintCount, setMintCount] = useState(1);
  const [remaining, setRemaining] = useState(0);
  const [price, setPrice] = useState(0);
  const { publicKey,wallet } = useWallet();
  const { connection } = useConnection();
  const [metaplex, setMetaplex] = useState(null);


  const isWalletConnected = publicKey !== null && publicKey !== undefined;

  useEffect(() => {
    if (wallet && wallet.adapter) {
      const metaplexInstance = Metaplex.make(connection).use(walletAdapterIdentity(wallet.adapter));
      setMetaplex(metaplexInstance);
    }
  }, [wallet, connection]);


  useEffect(() => {
    const fetchCandyMachine = async () => {
      if (!metaplex) return;
      try {
        const candyMachine = await metaplex.candyMachines().findByAddress({ address: new PublicKey(CANDY_MACHINE_ID) });
        setRemaining(candyMachine.itemsRemaining.toNumber());
        const priceInBasisPoints = candyMachine.candyGuard.guards.solPayment.amount.basisPoints.toNumber();
        setPrice(priceInBasisPoints/1000000000)
      } catch (error) {
        console.error("Failed to fetch candy machine", error);
      }
    };

    fetchCandyMachine();
  }, [metaplex,mintCount]);


  const handleMint = async () => {
    setMinting(true);
    try {
      const candyMachine = await metaplex.candyMachines().findByAddress({ address: new PublicKey(CANDY_MACHINE_ID) });
      const { nft, response } = await metaplex.candyMachines().mint({
        candyMachine,
        collectionUpdateAuthority: new PublicKey(AUTHORITY),
      },{commitment:'finalized'});
      console.log(`✅ - Minted NFT: ${nft.address.toString()}`);
      console.log(`     https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`);
      console.log(`     https://explorer.solana.com/tx/${response.signature}?cluster=devnet`);
      notify({ type: 'success', message: `Mint Successful ! `, txid: response.signature });
      setMintCount(prevCount => prevCount + 1);

    } catch (error) {
      console.error("Minting failed", error);
      notify({ type: 'error', message: `❌ - Minting failed: ${error.message}` });
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
        className={`bg-purple-600 text-white px-6 py-3 rounded text-lg ${minting || !isWalletConnected ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-700'}`} 
        onClick={handleMint} 
        disabled={minting || !isWalletConnected}
      >
        {minting ? 'Minting...' : 'MINT'}
      </button>
      <div className="mt-4 text-sm text-gray-400">Powered by METAPLEX</div>
    </div>
  );
};

export default MintButton;