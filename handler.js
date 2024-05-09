const { prepareFinalLiquidationData } = require("./contractCalls.js");
const { fetchLiquidationDataFromGraph } = require("./graph.js");
const config = require("./config.js");

const indexLiquidations = async () => {
  console.log("####### Starting Liquidation Extraction ##########");

  // chose protocol index to prepare liquidation data
  let currentProtocolIndex = 0; //e.g aave v2 is selected

  console.log(
    `######### Indexing Protocol ${config.protocols[currentProtocolIndex].name}  Chain: ${config.protocols[currentProtocolIndex].chainId} ###############`
  );

  // Run next active protocol if current protocol is disabled in config
  while (true) {
    if (!config.protocols[currentProtocolIndex].active) {
      console.log(
        `Inactive Protocol ${config.protocols[currentProtocolIndex].name} skipping `
      );

      currentProtocolIndex = (currentProtocolIndex + 1) % 14;

      console.log(
        `######### Starting Protocol ${config.protocols[currentProtocolIndex].name}  Chain: ${config.protocols[currentProtocolIndex].chainId} ###############`
      );
    } else {
      break;
    }
  }

  const startTime =
    new Date(config.protocols[currentProtocolIndex].startDate).getTime() / 1000;

  const lastGraphDocId = null; //await getLastUpdateStatus(currentProtocolIndex);

  const { liquidations, nextLastDocId } = await fetchLiquidationDataFromGraph(
    startTime,
    lastGraphDocId,
    currentProtocolIndex
  );
  console.log({ liquidationCount: liquidations.length, nextLastDocId });
  if (liquidations.length === 0) {
    return {
      statusCode: 200,
      body: { message: "Liquidations already up to date" },
    };
  }
  const finalLiquidationData = await prepareFinalLiquidationData(
    liquidations,
    currentProtocolIndex
  );

  console.log(
    `######### Prepared ${finalLiquidationData.length} liquidations `
  );
  console.log(finalLiquidationData);

  console.log("########### Done ##############");

  return {
    statusCode: 200,
    body: { message: "Liquidation data updated" },
  };
};

indexLiquidations();
