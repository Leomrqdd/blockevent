import type { NextPage } from "next";
import Head from "next/head";
import { MyNFTsView } from "../views";

const MyNFTs: NextPage = (props) => {
  return (
    <div>
      <Head>
        <title>My NFTS</title>
        <meta
          name="description"
          content="Basic Functionality"
        />
      </Head>
      <MyNFTsView />
    </div>
  );
};

export default MyNFTs;
