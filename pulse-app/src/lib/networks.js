// Wallet nativeCurrency.decimals stays 18. Arc accounts for gas and native value in 18-decimal USDC.
// Transfers in this app use the ERC-20 interface, which has 6 decimals and spends that same balance.

const USDC = '0x3600000000000000000000000000000000000000'
const MEMO = '0x5294E9927c3306DcBaDb03fe70b92e01cCede505'
const MULTICALL3_FROM = '0x522fAf9A91c41c443c66765030741e4AaCe147D0'

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
}

export const NETWORKS = [ARC_MAINNET, ARC_TESTNET]

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

export function tokenAddress(network, asset) {
  if (asset === 'usdc') return network.contracts.usdc
  if (asset === 'eurc') return network.contracts.eurc
  return ''
}
