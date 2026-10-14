import { AppError } from './errors.js'
import { chainParams } from './networks.js'

const UNKNOWN_CHAIN = /unrecognized chain id|unknown chain id|chain id .{0,40}not (?:been )?added|try adding the chain|wallet_addethereumchain/i

function walkErrors(error, visit) {
  const pending = [error]
  const seen = new Set()
  while (pending.length > 0 && seen.size < 8) {
    const current = pending.pop()
    if (!current || typeof current !== 'object' || seen.has(current)) continue
    seen.add(current)
    visit(current)
    for (const key of ['error', 'data', 'cause', 'info', 'originalError']) {
      const nested = current[key]
      if (nested && typeof nested === 'object') pending.push(nested)
    }
  }
}

export function isUnknownChainError(error) {
  if (typeof error === 'string') return UNKNOWN_CHAIN.test(error)
  let unknown = false
  walkErrors(error, (current) => {
    if (Number(current.code) === 4902) unknown = true
    const text = [current.message, current.shortMessage, current.reason].filter((part) => typeof part === 'string').join('\n')
    if (UNKNOWN_CHAIN.test(text)) unknown = true
  })
  return unknown
}

function requestParams(network) {
  const params = chainParams(network)
  return {
    chainId: params.chainId,
    chainName: params.chainName,
    nativeCurrency: { ...params.nativeCurrency },
    rpcUrls: [...params.rpcUrls],
    blockExplorerUrls: [...params.blockExplorerUrls],
  }
}

export async function switchOrAddChain(provider, network) {
  if (!provider?.request) throw new AppError('Connect a wallet before switching networks.')
  const params = requestParams(network)
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: params.chainId }],
    })
    return
  } catch (error) {
    if (!isUnknownChainError(error)) throw error
  }
  await provider.request({
    method: 'wallet_addEthereumChain',
    params: [params],
  })
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: params.chainId }],
    })
  } catch (error) {
    if (isUnknownChainError(error)) {
      throw new AppError('The wallet added this Arc network but did not switch to it.', { cause: error })
    }
    throw error
  }
}
