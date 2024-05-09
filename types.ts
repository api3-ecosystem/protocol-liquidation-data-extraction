export interface Liquidation {
  date: String;
  timestamp: String;
  user: String;
  hash: String;
  liquidatedCollateralUSD: String;
  liquidatedCollateral: String;
  sentToBuilder: String;
  sentToBuilderUSD: String;
  collateralAsset: String;
  blockNumber: number;
  madeBySearcherUSD: String;
  incentiveUSD: String;
  txCostUSD: String;
  builder: String;
}

export interface ProtocolConfig {
  subgraph: string;
  name: string;
  icon: string;
  chainId: number;
  startDate: string;
  protocolVersion: string;
  etherscanApiKey: string;
  graphApiKey: string;
  wethAddress: string;
  lendingPool: string;
  aaveOracle: string;
  rpcs: string[];
  active: true;
}

export interface LiquidationTotal {
  slug: string;
  hide: boolean;
  trueHide: boolean;
  name: string;
  totalLiquidated: string;
  totalSentToBuilderUSD: string;
  totalProfitUSD: string;
  totalIncentiveUSD: string;
  oevRate: number;
  withOEV: number;
}

export interface LiquidationChart {
  slug: string;
  chainId: number;
  period: string;
  data: Array<any[]>;
}
