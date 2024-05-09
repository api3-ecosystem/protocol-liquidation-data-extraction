const config = require("./config.js");
const BigNumber = require("bignumber.js");
const builders = require("./builders.json");
const axios = require("axios");
const LendingPoolABI = require("./abis/lendingPoolABI.json");
const { formatEther, formatUnits } = require("viem");
const { getPublicClient } = require("./clients.js");

async function fetchPriceFromAaveV2Oracle(
  asset,
  blockNumber,
  aaveV2OracleAddress,
  currentProtocolIndex,
  retries = 0
) {
  try {
    if (retries > 20) {
      throw new Error(
        "failed fetchPriceFromAaveV2Oracle func after max retries!"
      );
    }

    const abi = [
      {
        inputs: [{ internalType: "address", name: "asset", type: "address" }],
        name: "getAssetPrice",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ];

    const _config = config.protocols[currentProtocolIndex];

    const client = getPublicClient(_config.chainId, _config.rpcs[0]);

    // usdc address on ethereum mainnet
    const usdc = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

    const usdcPrice = await client.readContract({
      address: aaveV2OracleAddress,
      abi: abi,
      functionName: "getAssetPrice",
      args: [usdc],
      blockNumber: blockNumber,
    });

    const ethPrice = new BigNumber(1)
      .dividedBy(formatEther(usdcPrice.toString()))
      .toFixed(8);

    console.log("####### fetchPriceFromAaveV2Oracle: #######", {
      ethPrice,
      usdcPrice,
    });

    return ethPrice;
  } catch (error) {
    console.log("params ", {
      asset,
      blockNumber,
      aaveV2OracleAddress,
      currentProtocolIndex,
    });
    console.log("error in fetchPriceFromAaveV2Oracle retrying... ", error);

    await sleep(5000);
    return fetchPriceFromAaveV2Oracle(
      asset,
      blockNumber,
      aaveV2OracleAddress,
      currentProtocolIndex,
      retries + 1
    );
  }
}

async function fetchPriceFromAaveV3Oracle(
  asset,
  blockNumber,
  aaveV3OracleAddress,
  currentProtocolIndex,
  retries = 0
) {
  try {
    if (retries > 20) {
      throw new Error(
        "failed fetchPriceFromAaveV3Oracle func after max retries!"
      );
    }

    const abi = [
      {
        inputs: [{ internalType: "address", name: "asset", type: "address" }],
        name: "getAssetPrice",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ];

    const _config = config.protocols[currentProtocolIndex];

    const client = getPublicClient(_config.chainId, _config.rpcs[0]);

    const price = await client.readContract({
      abi: abi,
      address: aaveV3OracleAddress,
      functionName: "getAssetPrice",
      args: [asset],
      blockNumber: blockNumber,
    });

    return formatUnits(price.toString(), 8);
  } catch (error) {
    console.log("call failed fetchPriceFromAaveV3Oracle retrying...", {
      asset,
      blockNumber,
      aaveV3OracleAddress,
      currentProtocolIndex,
      retries,
    });
    await sleep(500);
    return fetchPriceFromAaveV3Oracle(
      asset,
      blockNumber,
      aaveV3OracleAddress,
      currentProtocolIndex,
      retries + 1
    );
  }
}

const getLiquidationIncetivePercentage = async (
  collateral,
  currentProtocolIndex,
  retries = 0
) => {
  try {
    if (retries > 20) {
      throw new Error(
        "failed getLiquidationIncetivePercentage func after max retries!"
      );
    }

    const _config = config.protocols[currentProtocolIndex];
    const client = getPublicClient(_config.chainId, _config.rpcs[0]);

    const lendingPoolAddress = _config.lendingPool;
    const configuration = await client.readContract({
      abi: LendingPoolABI,
      address: lendingPoolAddress,
      functionName: "getConfiguration",
      args: [collateral],
    });

    if (!configuration.data) {
      throw new Error(
        "failed getLiquidationIncetivePercentage configuration recieved undefined!"
      );
    }

    let number = configuration.data?.toString();
    let shiftedNumber = BigInt(number) >> BigInt(32); // Convert 'number' to BigInt explicitly
    let extractedBits = shiftedNumber & BigInt(0xffff);
    return Number(extractedBits) / 100 - 100;
  } catch (error) {
    console.log(
      "call failed getLiquidationIncetivePercentage retrying ...",
      error
    );
    await sleep(500);
    getLiquidationIncetivePercentage(
      collateral,
      currentProtocolIndex,
      retries + 1
    );
  }
};

const getLiquidationCall = async (
  txHash,
  currentProtocolIndex,
  retries = 0
) => {
  try {
    if (retries > 20) {
      throw new Error("failed getLiquidationCall func after max retries!");
    }

    const _config = config.protocols[currentProtocolIndex];

    const client = getPublicClient(_config.chainId, _config.rpcs[0]);

    const transaction = await client.getTransactionReceipt({ hash: txHash });

    const lendingPoolAddress = _config.lendingPool;

    const filter = await client.createContractEventFilter({
      abi: LendingPoolABI,
      address: lendingPoolAddress,
      eventName: "LiquidationCall",
      args: { collateralAsset: null, debtAsset: null, user: null },
      fromBlock: transaction.blockNumber,
      toBlock: transaction.blockNumber,
      strict: true,
    });

    const logs = await client.getFilterLogs({ filter: filter });

    const { collateralAsset, debtAsset, user } = logs[0]?.args;

    const { gasUsed, effectiveGasPrice } = transaction;

    const txCost = formatEther(effectiveGasPrice * gasUsed);

    return {
      txCost,
      collateralAsset,
      debtAsset,
      user,
      blockNumber: transaction.blockNumber,
    };
  } catch (error) {
    console.log("getLiquidationCall error retrying... ", error);
    await sleep(500);
    return getLiquidationCall(txHash, currentProtocolIndex, retries + 1);
  }
};
const getGasCost = async (txHash, currentProtocolIndex, retries = 0) => {
  try {
    if (retries > 20) {
      throw new Error("failed getGasCost func after max retries!");
    }

    const _config = config.protocols[currentProtocolIndex];

    const client = getPublicClient(_config.chainId, _config.rpcs[0]);

    const transaction = await client.getTransactionReceipt({ hash: txHash });

    const { gasUsed, effectiveGasPrice } = transaction;

    const txCost = formatEther(effectiveGasPrice * gasUsed);

    console.log("####### getGasCost #######", {
      txCost,
      effectiveGasPrice,
      gasUsed,
    });

    return { txCost, blockNumber: transaction?.blockNumber };
  } catch (error) {
    console.log("rpc call failed getGasCost", error);
    await sleep(500);
    return getGasCost(txHash, currentProtocolIndex, retries + 1);
  }
};

const getAaveV2LiquidationInfo = async (
  txHash,
  liquidatedCollateralUSD,
  currentProtocolIndex
) => {
  const { txCost, collateralAsset, debtAsset, user, blockNumber } =
    await getLiquidationCall(txHash, currentProtocolIndex);

  const incentivePercentage = await getLiquidationIncetivePercentage(
    collateralAsset,
    currentProtocolIndex
  );

  console.log("incentivePercentage", incentivePercentage);
  // const incentive =
  //   (Number(liquidatedCollateralUSD) * incentivePercentage) / 100;

  const incentiveUSD = new BigNumber(liquidatedCollateralUSD)
    .multipliedBy(incentivePercentage)
    .dividedBy(100)
    .toString();

  const aaveV2OracleAddress = config.protocols[currentProtocolIndex].aaveOracle;
  const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const ethPrice = await fetchPriceFromAaveV2Oracle(
    WETH_ADDRESS,
    blockNumber,
    aaveV2OracleAddress,
    currentProtocolIndex
  );
  console.log({ ethPrice, blockNumber });

  const txCostUSD = new BigNumber(txCost).multipliedBy(ethPrice).toString();

  return {
    incentiveUSD,
    txCostUSD,
    ethPrice,
  };
};

const getAaveV3LiquidationInfo = async (
  txHash,
  liquidatedCollateralUSD,
  currentProtocolIndex
) => {
  const { txCost, collateralAsset, blockNumber } = await getLiquidationCall(
    txHash,
    currentProtocolIndex
  );

  const incentivePercentage = await getLiquidationIncetivePercentage(
    collateralAsset,
    currentProtocolIndex
  );
  console.log(
    "########### incentivePercentage ###########",
    incentivePercentage
  );

  const incentiveUSD = new BigNumber(liquidatedCollateralUSD)
    .multipliedBy(incentivePercentage)
    .dividedBy(100)
    .toString();

  const aaveOracle = config.protocols[currentProtocolIndex].aaveOracle;
  const WETH_ADDRESS = config.protocols[currentProtocolIndex].wethAddress;
  const ethPrice = await fetchPriceFromAaveV3Oracle(
    WETH_ADDRESS,
    blockNumber,
    aaveOracle,
    currentProtocolIndex
  );
  console.log({ ethPrice, blockNumber });

  const txCostUSD = new BigNumber(txCost).multipliedBy(ethPrice).toString();

  return {
    incentiveUSD,
    txCostUSD,
    ethPrice,
  };
};

const getCompoundV3LiquidationInfo = async (
  txHash,
  liquidatedCollateralUSD,
  currentProtocolIndex
) => {
  const { txCost, blockNumber } = await getGasCost(
    txHash,
    currentProtocolIndex
  );

  const aaveOracle = config.protocols[currentProtocolIndex].aaveOracle;
  const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const ethPrice = await fetchPriceFromAaveV2Oracle(
    WETH_ADDRESS,
    blockNumber,
    aaveOracle,
    currentProtocolIndex
  );
  console.log({ ethPrice, blockNumber });

  const txCostUSD = new BigNumber(txCost).multipliedBy(ethPrice).toString();

  return {
    txCostUSD,
    ethPrice,
  };
};

const getPriceFromChainLink = async (
  tokenAddress,
  blockNumber,
  currentProtocolIndex
) => {
  const abi = [
    {
      inputs: [{ internalType: "address", name: "asset", type: "address" }],
      name: "getPrice",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
  ];
  const _config = config.protocols[currentProtocolIndex];
  const oracle = "0x1B2103441A0A108daD8848D8F5d790e4D402921F";

  const client = getPublicClient(_config.chainId, _config.rpcs[0]);
  const result = await client.readContract({
    abi: abi,
    address: oracle,
    functionName: "getPrice",
    args: [tokenAddress],
    blockNumber: blockNumber,
  });

  return result;
};

const getBSCLiquidationInfo = async (
  txHash,
  liquidatedCollateralUSD,
  currentProtocolIndex
) => {
  const { txCost, blockNumber } = await getGasCost(
    txHash,
    currentProtocolIndex
  );

  const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
  let bnbPrice = await getPriceFromChainLink(
    WBNB,
    blockNumber,
    currentProtocolIndex
  );
  bnbPrice = formatUnits(bnbPrice, 18);
  const txCostUSD = new BigNumber(txCost).multipliedBy(bnbPrice).toString();
  console.log({ txCost, bnbPrice, txCostUSD });

  return {
    txCostUSD,
    ethPrice: bnbPrice,
  };
};

const getNonEthereumLiquidationInfo = async (
  txHash,
  liquidatedCollateralUSD,
  currentProtocolIndex
) => {
  const { txCost, blockNumber } = await getGasCost(
    txHash,
    currentProtocolIndex
  );

  // get timestamp of current network's  given block
  const _config = config.protocols[currentProtocolIndex];
  const client = getPublicClient(_config.chainId, _config.rpcs[0]);
  const blockDetail = await client.getBlock();
  const timestamp = blockDetail.timestamp;

  // get respective eth block number near by the timestamp
  const ethBlock = await getEthereumBlock(timestamp);

  // v3 oracle
  const aaveOracle = config.protocols[1].aaveOracle;
  const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  // use ethereum config
  const _currentProtocolIndex = 1;
  const ethPrice = await fetchPriceFromAaveV3Oracle(
    WETH_ADDRESS,
    ethBlock,
    aaveOracle,
    _currentProtocolIndex
  );

  const txCostUSD = new BigNumber(txCost).multipliedBy(ethPrice).toString();
  console.log({ txCost, ethPrice, txCostUSD });

  return {
    txCostUSD,
    ethPrice,
  };
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchFundsMovedToBuilder(hash, retries = 0) {
  try {
    if (retries > 20) {
      throw new Error(
        "failed fetchFundsMovedToBuilder func after max retries!"
      );
    }

    const apiUrl = `https://api.etherscan.io/api?module=account&action=txlistinternal&txhash=${hash}&apikey=${config?.protocols?.[0]?.etherscanApiKey}`;
    const response = await axios.get(apiUrl);
    const internalTransactions = response?.data?.result;

    let fundsMoved = 0;
    let builder;
    for (let i = 0; i < internalTransactions?.length; i++) {
      const transaction = internalTransactions?.[i];
      if (
        builders
          .map((el) => el.toLowerCase())
          .includes(transaction.to.toLowerCase())
      ) {
        console.log(
          `Funds moved to builder From: ${transaction.from}, To: ${transaction.to}, Value: ${transaction.value}`
        );

        builder = transaction?.to;
        fundsMoved = transaction.value?.toString();
      }
    }

    return { fundsMoved, builder };
  } catch (error) {
    console.log("error fetchFundsMovedToBuilder", error);
    await sleep(500);
    console.log("retrying fetchInternaltrx");
    return fetchFundsMovedToBuilder(hash, retries + 1);
  }
}

async function getEthereumBlock(timestamp, retries = 0) {
  try {
    if (retries > 20) {
      throw new Error("failed getEthereumBlock func after max retries!");
    }

    const YourApiKeyToken = "36QV5RR1WHHYWBH81P4V3KY2DKCZ7RR4ZH";
    const api = `https://api.etherscan.io/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${YourApiKeyToken}`;
    const result = await axios.get(api);
    const block = await result.data?.result;

    console.log({ block });
    return block;
  } catch (error) {
    console.log("call failed getEthereumBlock", error);
    await sleep(500);
    return getEthereumBlock(timestamp, retries + 1);
  }
}

const protocolVersions = {
  aaveV2: "aaveV2",
  aaveV3: "aaveV3",
  compoundV2: "compoundV2",
  compoundV3: "compoundV3",
  creamFinance: "creamFinance",
  makerDao: "makerDao",
  morphoAaveV2: "morphoAaveV2",
  morphoComp: "morphoComp",
  aaveV3Arb: "aaveV3Arb",
  compoundV3Arb: "compoundV3Arb",
  aaveV3Avl: "aaveV3Avl",
  compoundV3Base: "compoundV3Base",
  venusBsc: "venusBsc",
  aaveV3Op: "aaveV3Op",
  compoundV3Pol: "compoundV3Pol",
  aaveV3Pol: "aaveV3Pol",
};
async function prepareFinalLiquidationData(list, currentProtocolIndex) {
  console.log("list size ", list?.length);
  const finalList = [];

  const _config = config.protocols[currentProtocolIndex];

  let i = 0;
  while (i < list.length) {
    const date = new Date(
      Number(list[i].timestamp) * 1000
    ).toLocaleDateString();

    const { builder, fundsMoved } =
      _config.chainId === 1
        ? await fetchFundsMovedToBuilder(list[i].hash)
        : { builder: null, fundsMoved: "0" };

    const sentToBuilder = formatEther(fundsMoved);
    let sentToBuilderUSD = "0";

    // calculate made by searcher , incentive and txCost
    let madeBySearcherUSD = "0";
    let incentiveUSD = "0";
    let txCostUSD = "0";

    // find liquidation info and searcher profit for different protocols
    if (_config.protocolVersion === protocolVersions.aaveV2) {
      console.log(`########## ${_config.protocolVersion} #############`);
      const liqInfo = await getAaveV2LiquidationInfo(
        list[i].hash,
        list[i].amountUSD,
        currentProtocolIndex
      );

      incentiveUSD = liqInfo.incentiveUSD;
      txCostUSD = liqInfo.txCostUSD;
      sentToBuilderUSD = new BigNumber(sentToBuilder)
        .multipliedBy(liqInfo.ethPrice)
        .toString();
      madeBySearcherUSD = new BigNumber(incentiveUSD)
        .minus(sentToBuilderUSD)
        .minus(txCostUSD)
        .toString();
    } else if (
      [
        protocolVersions.aaveV3,
        protocolVersions.aaveV3Arb,
        protocolVersions.aaveV3Avl,
        protocolVersions.aaveV3Op,
        protocolVersions.aaveV3Pol,
      ].includes(_config.protocolVersion)
    ) {
      // profit calculations for aave v3
      console.log(`########## ${_config.protocolVersion} #############`);
      const liqInfo = await getAaveV3LiquidationInfo(
        list[i].hash,
        list[i].amountUSD,
        currentProtocolIndex
      );

      incentiveUSD = liqInfo.incentiveUSD;
      txCostUSD = liqInfo.txCostUSD;
      sentToBuilderUSD = new BigNumber(sentToBuilder)
        .multipliedBy(liqInfo.ethPrice)
        .toString();
      madeBySearcherUSD = new BigNumber(incentiveUSD)
        .minus(sentToBuilderUSD)
        .minus(txCostUSD)
        .toString();
    } else if (
      [
        protocolVersions.compoundV3,
        protocolVersions.compoundV2,
        protocolVersions.makerDao,
        protocolVersions.morphoAaveV2,
        protocolVersions.morphoComp,
      ].includes(_config.protocolVersion)
    ) {
      console.log(`########## ${_config.protocolVersion} #############`);

      const liqInfo = await getCompoundV3LiquidationInfo(
        list[i].hash,
        list[i].amountUSD,
        currentProtocolIndex
      );

      sentToBuilderUSD = new BigNumber(sentToBuilder)
        .multipliedBy(liqInfo.ethPrice)
        .toString();

      incentiveUSD = new BigNumber(list[i].profitUSD)
        .plus(sentToBuilderUSD)
        .toString();

      txCostUSD = liqInfo.txCostUSD;

      madeBySearcherUSD = new BigNumber(incentiveUSD)
        .minus(sentToBuilderUSD)
        .minus(txCostUSD)
        .toString();
    } else if (
      [
        protocolVersions.compoundV3Arb,
        protocolVersions.compoundV3Base,
        protocolVersions.compoundV3Pol,
      ].includes(_config.protocolVersion)
    ) {
      console.log(`########## ${_config.protocolVersion} #############`);

      const liqInfo = await getNonEthereumLiquidationInfo(
        list[i].hash,
        list[i].amountUSD,
        currentProtocolIndex
      );

      incentiveUSD = list[i].profitUSD;

      txCostUSD = liqInfo.txCostUSD;

      madeBySearcherUSD = new BigNumber(incentiveUSD)
        .minus(txCostUSD)
        .toString();
    } else if ([protocolVersions.venusBsc].includes(_config.protocolVersion)) {
      console.log(`########## ${_config.protocolVersion} #############`);

      const liqInfo = await getBSCLiquidationInfo(
        list[i].hash,
        list[i].amountUSD,
        currentProtocolIndex
      );

      incentiveUSD = list[i].profitUSD;

      txCostUSD = liqInfo.txCostUSD;

      madeBySearcherUSD = new BigNumber(incentiveUSD)
        .minus(txCostUSD)
        .toString();
    } else {
    }

    const liquidationPayload = {
      date: date,
      timestamp: list[i].timestamp,
      user: list[i].liquidatee.id,
      hash: list[i].hash,
      liquidatedCollateralUSD: list[i].amountUSD,
      liquidatedCollateral: list[i].amount,
      sentToBuilder: sentToBuilder,
      sentToBuilderUSD: sentToBuilderUSD,
      collateralAsset: list[i].asset.id,
      blockNumber: list[i].blockNumber,
      madeBySearcherUSD: madeBySearcherUSD,
      incentiveUSD,
      txCostUSD,
      builder: !builder
        ? "0x0000000000000000000000000000000000000000"
        : builder,
    };
    finalList.push(liquidationPayload);

    console.log({ preparedLiq: liquidationPayload });

    i += 1;
  }

  return finalList;
}

module.exports = { prepareFinalLiquidationData };
