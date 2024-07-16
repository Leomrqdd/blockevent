// Next, React
import { FC, useEffect, useState } from 'react';
import Link from 'next/link';
import { Metaplex, PublicKey, keypairIdentity, walletAdapterIdentity } from "@metaplex-foundation/js";

// Wallet
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

// Store
import NavElement from 'components/nav-element';

const CANDY_MACHINE_ID = 'GFL2Q47XzJxZedjm6Dskdhviw82c73AxPh8epcbgaZtz';
const TOKEN_ACCOUNT = '8ixLuvikkC8skxPVDbuYXoz63dFFY8wEqFDyPTnXEY6f';

export const MyNFTsView: FC = ({ }) => {
  const { wallet } = useWallet();
  const { connection } = useConnection();
  const [isNavOpen, setIsNavOpen] = useState(false);

  const [metaplex, setMetaplex] = useState(null);
  const [myNfts, setMyNfts] = useState([]);

  useEffect(() => {
    if (wallet.adapter) {
      const metaplexInstance = Metaplex.make(connection).use(walletAdapterIdentity(wallet.adapter));
      setMetaplex(metaplexInstance);
    }
  }, [wallet, connection])

  useEffect(() => {
    const fetchCandyMachine = async () => {
      if (!metaplex) return;
      try {
        const candyMachine = await metaplex.candyMachines().findByAddress({ address: new PublicKey(CANDY_MACHINE_ID) });
        console.log('IN MY NFTS - candyMachine  c => ' ,candyMachine)
        // const candyMachinPublicKey = await candyMachine.address
        // const test = new PublicKey(candyMachinPublicKey)
        // console.log('IN MY NFTS - candyMachine - candyMachinPublicKey  => ' , test)
        // const b = await metaplex.nfts().findAllByOwner("")
        const tokenAccountPublicKey = new PublicKey(TOKEN_ACCOUNT)
        // getTokenAccountBalance
        const val = await connection.getTokenAccountBalance(tokenAccountPublicKey)
        // const val = await connection.getTokenAccountsByOwner(wallet.adapter.publicKey, { mint: wallet.adapter.publicKey })
        console.log('IN MY NFTS - val => ' , val)
        // console.log('IN MY NFTS - metaplex => ' , metaplex.nfts().getBalance())
        // setRemaining(candyMachine.itemsRemaining.toNumber());
        // const priceInBasisPoints = candyMachine.candyGuard.guards.solPayment.amount.basisPoints.toNumber();
        // setPrice(priceInBasisPoints/1000000000)
      } catch (error) {
        console.error("Failed to fetch candy machine", error);
      }
    };

    fetchCandyMachine();
  }, [metaplex]);

  return (
    <div className="md:hero mx-auto p-4">
      <div className="md:hero-content flex flex-col">
        <div className='mt-6'>
          <h1 className="text-center text-5xl md:pl-12 font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 to-fuchsia-500 mb-4">
            My NFTS
          </h1>
        </div>

        { myNfts.length === 0 && 
        <div>
          <h2 className="text-center text-4xl md:pl-12 font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 to-fuchsia-500 mb-4">
            You don't have NFTs on your wallet ! 
          </h2>
          <NavElement
            label="Mint NFTS"
            href="/"
            navigationStarts={() => setIsNavOpen(false)}
            />
        </div>
        }
      </div>
    </div>
  );
};
