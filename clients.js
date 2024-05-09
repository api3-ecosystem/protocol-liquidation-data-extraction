const { CHAINS } = require("@api3/chains");

const { createPublicClient, http } = require("viem");

const getPublicClient = (chainId, rpc) => {
  let chainInfo = CHAINS.find(
    (chain) => chain.id.toString() === chainId.toString()
  );

  if (!chainInfo) {
    throw new Error(`Error getting client for chainID: ${chainId}`);
  }

  // Create a client
  const client = createPublicClient({
    chain: {
      id: parseInt(chainInfo.id),
      name: chainInfo.name,
      nativeCurrency: {
        name: chainInfo.name,
        symbol: chainInfo.symbol,
        decimals: chainInfo.decimals,
      },

      rpcUrls: {
        default: { http: [rpc || ""], webSocket: [] },
        public: { http: [rpc || ""], webSocket: [] },
      },
    },
    transport: http(rpc),
  });

  return client;
};

module.exports = {
  getPublicClient,
};
