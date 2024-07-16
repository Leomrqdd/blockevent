import type { NextPage } from "next";
import Head from "next/head";
import { HomeView } from "../views";
import Mint from "../components/Mint"

const Home: NextPage = (props) => {
  return (
    <div>
      <Head>
        <title>Solana Scaffold</title>
        <meta
          name="description"
          content="Solana Scaffold"
        />
      </Head>
      <Mint/>
    </div>
  );
};

export default Home;
