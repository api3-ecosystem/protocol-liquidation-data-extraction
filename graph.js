const { GraphQLClient, gql } = require("graphql-request");
const config = require("./config");

async function querySubgraph(subgraphUrl, query) {
  try {
    const client = new GraphQLClient(subgraphUrl, { headers: {} });

    const response = await client.request(query);

    return response;
  } catch (error) {
    console.log("fetch error ", error);
    return null;
  }
}

async function extractLiquidations(graphUrl, startTime, lastDocId) {
  let query = "";

  if (!lastDocId) {
    query = gql`
      query {
        liquidates(first: 100, where: { timestamp_gte: "${startTime}" }, orderBy: blockNumber) {
          id
          amount
          amountUSD
          blockNumber
          hash
          timestamp
          liquidator { id }
          liquidatee { id }
          asset {
            decimals
            id
            name
            symbol
            lastPriceUSD
            lastPriceBlockNumber
          }
          profitUSD
        }
      }
    `;
  } else {
    query = gql`
      query {
        liquidates(
          first: 100,
          where: { id_gt: "${lastDocId}", timestamp_gt: "${startTime}" },
          orderBy: blockNumber
        ) {
          id
          amount
          amountUSD
          blockNumber
          hash
          timestamp
          liquidator { id }
          liquidatee { id }
          asset {
            decimals
            id
            name
            symbol
            lastPriceUSD
            lastPriceBlockNumber
          }
          profitUSD
        }
      }
    `;
  }

  try {
    const result = await querySubgraph(graphUrl, query);
    console.log("fetched ", result?.liquidates?.length);

    return result?.liquidates;
  } catch (error) {
    console.log("something went wrong ", error);
    return [];
  }
}

async function fetchLiquidationDataFromGraph(
  startTime,
  lastDocId,
  currentProtocolIndex
) {
  const subgraphUrl = config.protocols?.[currentProtocolIndex]?.subgraph;
  let results;
  let nextLastDocId;
  if (!lastDocId) {
    results = await extractLiquidations(subgraphUrl, startTime, null);
    nextLastDocId = results?.[results?.length - 1]?.id;
  } else {
    results = await extractLiquidations(subgraphUrl, startTime, lastDocId);
    nextLastDocId = results?.[results?.length - 1]?.id;
  }

  return { liquidations: results, nextLastDocId };
}

module.exports = {
  fetchLiquidationDataFromGraph,
};
