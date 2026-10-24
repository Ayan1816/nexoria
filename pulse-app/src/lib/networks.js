// Wallet nativeCurrency.decimals stays 18. Arc accounts for gas and native value in 18-decimal USDC.
// ERC-20 USDC at the precompile uses 6 decimals and spends that same balance. Other tokens use their own decimals.
// Every address below was read from Arc contract docs and checked with eth_getCode, name, symbol, and decimals
// on https://rpc.mainnet.arc.io (chain 5042) and https://rpc.testnet.arc.io (chain 5042002).

const USDC = '0x3600000000000000000000000000000000000000'
const MEMO = '0x5294E9927c3306DcBaDb03fe70b92e01cCede505'
const MULTICALL3_FROM = '0x522fAf9A91c41c443c66765030741e4AaCe147D0'

function officialToken({ id, symbol, name, address, decimals, gasToken = false }) {
  return { id, symbol, name, address, decimals, isOfficial: true, gasToken }
}

const USDC_TOKEN = officialToken({
  id: 'usdc',
  symbol: 'USDC',
  name: 'USDC',
  address: USDC,
  decimals: 6,
  gasToken: true,
})

const MAINNET_TOKENS = [
  USDC_TOKEN,
  officialToken({
    id: 'eurc',
    symbol: 'EURC',
    name: 'EURC',
    address: '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1',
    decimals: 6,
  }),
  officialToken({
    id: 'usyc',
    symbol: 'USYC',
    name: 'US Yield Coin',
    address: '0x8a5D989Bbb96929F689B0200f435f53dA42bF490',
    decimals: 6,
  }),
  officialToken({
    id: 'cirbtc',
    symbol: 'cirBTC',
    name: 'Circle Wrapped Bitcoin',
    address: '0x171A4217b86A807A64eB94757Db6849fb4bDbAA0',
    decimals: 8,
  }),
  officialToken({
    id: 'weth',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x128cC466B61f542da60c70e3aA11c10e19B84EDB',
    decimals: 18,
  }),
]

const TESTNET_TOKENS = [
  USDC_TOKEN,
  officialToken({
    id: 'eurc',
    symbol: 'EURC',
    name: 'EURC',
    address: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
    decimals: 6,
  }),
  officialToken({
    id: 'usyc',
    symbol: 'USYC',
    name: 'US Yield Coin',
    address: '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C',
    decimals: 6,
  }),
  officialToken({
    id: 'cirbtc',
    symbol: 'cirBTC',
    name: 'Circle Wrapped Bitcoin',
    address: '0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF',
    decimals: 8,
  }),
  officialToken({
    id: 'weth',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x2c4047028a72803939b6fb674D01bC059B5C4961',
    decimals: 18,
  }),
]

export const ARC_TESTNET = {
  chainId: 5042002,
  hexChainId: '0x4cef52',
  name: 'Arc Testnet',
  testnet: true,
  rpcUrls: ['https://rpc.testnet.arc.io'],
  explorer: 'https://explorer.testnet.arc.io',
  faucet: 'https://faucet.circle.com',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  contracts: {
    usdc: USDC,
    eurc: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
    memo: MEMO,
    multicall3From: MULTICALL3_FROM,
  },
  tokens: TESTNET_TOKENS,
}

export const ARC_MAINNET = {
  chainId: 5042,
  hexChainId: '0x13b2',
  name: 'Arc',
  testnet: false,
  rpcUrls: ['https://rpc.mainnet.arc.io'],
  explorer: 'https://explorer.arc.io',
  faucet: '',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  contracts: {
    usdc: USDC,
    eurc: '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1',
    memo: MEMO,
    multicall3From: MULTICALL3_FROM,
  },
  tokens: MAINNET_TOKENS,
}

// Arc mainnet is the production network. Testnet stays selectable for faucet-funded use.
export const NETWORKS = [ARC_MAINNET, ARC_TESTNET]
export const DEFAULT_NETWORK = ARC_MAINNET

export function getArcNetwork(chainId) {
  const id = typeof chainId === 'bigint' ? Number(chainId) : Number(chainId)
  return NETWORKS.find((network) => network.chainId === id) ?? null
}

export function chainParams(network) {
  return {
    chainId: network.hexChainId,
    chainName: network.name,
    nativeCurrency: network.nativeCurrency,
    rpcUrls: network.rpcUrls,
    blockExplorerUrls: [network.explorer],
  }
}

export function officialTokens(network) {
  return Array.isArray(network?.tokens) ? network.tokens : []
}

export function findOfficialToken(network, idOrAddress) {
  if (idOrAddress == null) return null
  const key = String(idOrAddress).trim().toLowerCase()
  if (!key) return null
  return officialTokens(network).find((token) => (
    token.id === key || token.address.toLowerCase() === key
  )) ?? null
}

export function tokenAddress(network, asset) {
  return findOfficialToken(network, asset)?.address ?? ''
}
