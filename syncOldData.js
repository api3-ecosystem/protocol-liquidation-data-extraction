const fs = require("fs");
async function main() {
  const filePath =
    "/Users/aamir/Desktop/api3/liquidation-ashar/processedData/eth/" +
    "aaveV2Liquidations.json";

  let list = fs.readFileSync(filePath, "utf-8");
  list = JSON.parse(list);

  console.log("list length ", list.length);
}

main();
