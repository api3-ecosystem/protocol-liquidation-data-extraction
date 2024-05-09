## Script to liquidation data extraction with searcher profits

## setup guide

1. Install dependencies `npm install`

### example config for Aave V2

```
    {
      subgraph: `https://gateway.thegraph.com/api/${process.env.GRAPH_API}/subgraphs/id/84CvqQHYhydZzr2KSth8s1AFYpBRzUbVJXq6PWuZm9U9`,
      name: "Aave V2",
      icon: "https://icons.llamao.fi/icons/protocols/aave?w=48&h=48",
      chainId: 1,
      startDate: "2/4/2024",
      protocolVersion: "aaveV2",
      etherscanApiKey: `${process.env.ETHERSCAN_API}`,
      graphApiKey: `${process.env.GRAPH_API}`,
      wethAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      lendingPool: "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9",
      aaveOracle: "0xA50ba011c48153De246E5192C8f9258A2ba79Ca9",
      rpcs: [
        `https://green-wandering-butterfly.quiknode.pro/${process.env.QUICKNODE_API}/`,
      ],
      active: true,
    }
```

2. Invoke Script to prepare liquidation data with searcher profits `node handler.js`
