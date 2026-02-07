/**
 * Contract addresses and ABIs for AutoDCA P2P Grid Trading
 * Update addresses after deployment to Sepolia
 */

// ============================================================================
// CONTRACT ADDRESSES
// ============================================================================

export const CONTRACT_ADDRESSES = {
  // Main contracts (update after deployment)
  escrowImplementation: '0x0000000000000000000000000000000000000000', // Escrow implementation
  escrowFactory: '0x0000000000000000000000000000000000000000',       // EscrowFactory

  // Sepolia Chainlink Price Feeds (official addresses)
  chainlink: {
    btcUsd: '0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43',  // BTC/USD
    ethUsd: '0x694AA1769357215DE4FAC081bf1f309aDC325306',  // ETH/USD
    usdcUsd: '0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E', // USDC/USD
  },

  // Test tokens (mock or existing Sepolia tokens)
  tokens: {
    wbtc: '0x0000000000000000000000000000000000000000',  // TODO: Deploy or use existing
    weth: '0x0000000000000000000000000000000000000000',  // TODO: Deploy or use existing
    usdc: '0x0000000000000000000000000000000000000000',  // TODO: Deploy or use existing
  },
};

// ============================================================================
// ESCROW FACTORY ABI
// ============================================================================

export const ESCROW_FACTORY_ABI = [
  // Read functions
  'function implementation() external view returns (address)',

  // Write functions
  'function createEscrow(tuple(uint256 dcaOrdersSize, uint256 priceDeviationBPS, uint256 takeProfitBPS, uint128 priceMultiplierBPS, uint128 dcaOrderSizeMultiplierBPS, uint128 baseOrderAmount, uint128 dcaOrderAmount) params, address asset0, address asset1, address feed0, address feed1) external returns (address)',

  // Events
  'event EscrowCreated(address indexed escrow, address indexed owner, address asset0, address asset1)',
] as const;

// ============================================================================
// ESCROW ABI
// ============================================================================

export const ESCROW_ABI = [
  // Read functions - Asset Info
  'function asset0() external view returns (address)',
  'function asset1() external view returns (address)',
  'function asset0DecimalsFactor() external view returns (uint256)',
  'function asset1DecimalsFactor() external view returns (uint256)',
  'function oracleAsset0Usd() external view returns (address)',
  'function oracleAsset1Usd() external view returns (address)',
  'function owner() external view returns (address)',

  // Read functions - State
  'function params() external view returns (tuple(uint256 dcaOrdersSize, uint256 priceDeviationBPS, uint256 takeProfitBPS, uint128 priceMultiplierBPS, uint128 dcaOrderSizeMultiplierBPS, uint128 baseOrderAmount, uint128 dcaOrderAmount))',
  'function sellOrders(uint256 index) external view returns (tuple(uint128 amount, uint128 filled, uint128 price))',
  'function lastExecuteOrder() external view returns (uint256)',

  // Read functions - New View Functions
  'function getSellOrders() external view returns (tuple(uint128 amount, uint128 filled, uint128 price)[])',
  'function getAvailableLiquidity() external view returns (uint256)',
  'function getCurrentSpotPrice() external view returns (uint256)',
  'function estimateBuyOutput(uint256 amount1In) external view returns (uint256 amount0Out, uint256[] orderIndicesFilled)',
  'function getTotalSoldAsset0() external view returns (uint256)',
  'function getAverageSellPrice() external view returns (uint256)',

  // Write functions
  'function initialize(tuple(uint256 dcaOrdersSize, uint256 priceDeviationBPS, uint256 takeProfitBPS, uint128 priceMultiplierBPS, uint128 dcaOrderSizeMultiplierBPS, uint128 baseOrderAmount, uint128 dcaOrderAmount) params, address asset0, address asset1, address feed0, address feed1, address owner) external',
  'function buy(uint256 amount1In, uint256 minAmount0Out, uint256 deadline) external',
  'function sell(uint256 amount0In, uint256 minAmount1Out, uint256 deadline) external',

  // Events
  'event Buy(address indexed buyer, uint256 amount1In, uint256 amount0Out)',
  'event Sell(address indexed seller, uint256 amount0In, uint256 amount1Out)',
] as const;

// ============================================================================
// ERC20 ABI
// ============================================================================

export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)',
  'function totalSupply() external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',

  // Events
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
] as const;

// ============================================================================
// CHAINLINK AGGREGATOR V3 ABI
// ============================================================================

export const CHAINLINK_AGGREGATOR_ABI = [
  'function decimals() external view returns (uint8)',
  'function description() external view returns (string)',
  'function version() external view returns (uint256)',
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
] as const;

// ============================================================================
// CHAIN CONFIG
// ============================================================================

export const CHAIN_CONFIG = {
  chainId: 11155111, // Sepolia testnet
  chainName: 'Sepolia',
  nativeCurrency: {
    name: 'Sepolia ETH',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: 'https://sepolia.infura.io/v3/', // Add your Infura key
    public: 'https://rpc.sepolia.org',
    alchemy: 'https://eth-sepolia.g.alchemy.com/v2/', // Add your Alchemy key
  },
  blockExplorer: {
    name: 'Etherscan',
    url: 'https://sepolia.etherscan.io',
  },
  blockTime: 12, // seconds
};

// ============================================================================
// SUPPORTED ASSETS
// ============================================================================

export interface AssetConfig {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  oracleAddress: string;
  icon?: string;
}

export const SUPPORTED_ASSETS: Record<string, AssetConfig> = {
  WBTC: {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    address: CONTRACT_ADDRESSES.tokens.wbtc,
    decimals: 8,
    oracleAddress: CONTRACT_ADDRESSES.chainlink.btcUsd,
  },
  WETH: {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: CONTRACT_ADDRESSES.tokens.weth,
    decimals: 18,
    oracleAddress: CONTRACT_ADDRESSES.chainlink.ethUsd,
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    address: CONTRACT_ADDRESSES.tokens.usdc,
    decimals: 6,
    oracleAddress: CONTRACT_ADDRESSES.chainlink.usdcUsd,
  },
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const CONSTANTS = {
  BPS: 10000,                        // Basis points denominator
  PRICE_SCALE: 100000000,            // 1e8 for price scaling
  MAX_SLIPPAGE_BPS: 1000,            // 10% max slippage
  DEFAULT_SLIPPAGE_BPS: 50,          // 0.5% default slippage
  DEFAULT_DEADLINE_MINUTES: 10,      // 10 minutes
  ORACLE_STALE_THRESHOLD: 3600,      // 1 hour in seconds
  MAX_UINT256: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get transaction explorer URL
 */
export function getTxUrl(txHash: string): string {
  return `${CHAIN_CONFIG.blockExplorer.url}/tx/${txHash}`;
}

/**
 * Get address explorer URL
 */
export function getAddressUrl(address: string): string {
  return `${CHAIN_CONFIG.blockExplorer.url}/address/${address}`;
}

/**
 * Get asset config by symbol
 */
export function getAssetBySymbol(symbol: string): AssetConfig | undefined {
  return SUPPORTED_ASSETS[symbol.toUpperCase()];
}

/**
 * Get asset config by address
 */
export function getAssetByAddress(address: string): AssetConfig | undefined {
  return Object.values(SUPPORTED_ASSETS).find(
    (asset) => asset.address.toLowerCase() === address.toLowerCase()
  );
}

/**
 * Check if address is valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
