import { BrowserProvider, Contract, getAddress } from 'ethers'
import { ERC20_ABI } from './abi.js'
import { sanitizeCustomToken } from './customTokens.js'
import { AppError } from './errors.js'
import { getArcNetwork, NETWORKS } from './networks.js'

// keccak256("Approval(address,address,uint256)")
export const APPROVAL_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'

// One explorer page. A result this large is treated as truncated, not as a full list.
export const MAX_APPROVAL_LOGS = 10_000

// Public Arc RPCs reject eth_getLogs ranges of 10,000 blocks. Keep the inclusive window smaller.
export const RPC_LOG_SPAN = 9_999n

const MAX_BLOCKSCOUT_PAGES = 4
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const EXPLORER_TIMEOUT_MS = 12_000

function canonicalAddress(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value.trim())) return null
  try {
    return getAddress(value.trim())
  } catch {
    return null
  }
}

export function addressFromTopic(topic) {
  if (typeof topic !== 'string' || !/^0x0{24}[0-9a-fA-F]{40}$/i.test(topic)) return null
  const address = canonicalAddress(`0x${topic.slice(-40)}`)
  if (!address || address === ZERO_ADDRESS) return null
  return address
}

export function spendersFromApprovalLogs(logs, owner, token = '') {
  const ownerAddress = canonicalAddress(owner)
  const tokenAddress = token ? canonicalAddress(token) : null
  if (!ownerAddress || !Array.isArray(logs)) return []
  const seen = new Set()
  const spenders = []
  for (const log of logs) {
    const topics = log?.topics
    if (!Array.isArray(topics) || topics.length < 3) continue
    if (String(topics[0]).toLowerCase() !== APPROVAL_TOPIC) continue
    if (tokenAddress && log.address) {
      const loggedToken = canonicalAddress(typeof log.address === 'string' ? log.address : log.address?.hash)
      if (!loggedToken || loggedToken !== tokenAddress) continue
    }
    if (addressFromTopic(topics[1]) !== ownerAddress) continue
    const spender = addressFromTopic(topics[2])
    if (!spender || spender === ownerAddress || spender === ZERO_ADDRESS || seen.has(spender)) continue
    seen.add(spender)
    spenders.push(spender)
  }
  return spenders
}

function officialExplorer(explorer) {
  const base = typeof explorer === 'string' ? explorer.replace(/\/$/, '') : ''
  return NETWORKS.some((network) => network.explorer === base) ? base : ''
}

export function approvalLogsUrl(explorer, token, owner) {
  const base = officialExplorer(explorer)
  if (!base) throw new AppError('Allowance discovery uses the official Arc explorer.')
  const tokenContract = canonicalAddress(token)
  const ownerAddress = canonicalAddress(owner)
  if (!tokenContract || !ownerAddress) {
    throw new AppError('Allowance discovery needs a token and an owner.')
  }
  const params = new URLSearchParams({
    module: 'logs',
    action: 'getLogs',
    fromBlock: '0',
    toBlock: 'latest',
    address: tokenContract.toLowerCase(),
    topic0: APPROVAL_TOPIC,
    topic0_1_opr: 'and',
    topic1: `0x${ownerAddress.slice(2).toLowerCase().padStart(64, '0')}`,
    page: '1',
    offset: String(MAX_APPROVAL_LOGS),
  })
  return `${base}/api?${params.toString()}`
}

export function blockscoutLogsUrl(explorer, token, pageParams) {
  const base = officialExplorer(explorer)
  if (!base) throw new AppError('Allowance discovery uses the official Arc explorer.')
  const tokenContract = canonicalAddress(token)
  if (!tokenContract) throw new AppError('Allowance discovery needs a token and an owner.')
  const url = new URL(`${base}/api/v2/addresses/${tokenContract}/logs`)
  if (pageParams && typeof pageParams === 'object') {
    for (const [key, value] of Object.entries(pageParams)) {
      if (value == null) continue
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

export function recentLogRange(latestBlock) {
  const latest = typeof latestBlock === 'bigint' ? latestBlock : BigInt(latestBlock)
  if (latest < 0n) throw new AppError('The Arc RPC did not return a block.')
  const fromBlock = latest + 1n > RPC_LOG_SPAN ? latest - RPC_LOG_SPAN + 1n : 0n
  return { fromBlock, toBlock: latest }
}

export function logsFromExplorerPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new AppError('The Arc explorer did not return approval logs.')
  }
  if (Array.isArray(payload.result)) return payload.result
  const message = `${payload.message ?? ''} ${payload.result ?? ''}`
  if (/no records found|no logs found/i.test(message)) return []
  throw new AppError('The Arc explorer did not return approval logs.')
}

export function logsFromBlockscoutPayload(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items)) {
    throw new AppError('The Arc explorer did not return approval logs.')
  }
  return payload.items.map((item) => ({
    address: item?.address?.hash ?? item?.address,
    topics: Array.isArray(item?.topics)
      ? item.topics.map((topic) => (typeof topic === 'string' ? topic : '0x'))
      : [],
    data: item?.data,
  }))
}

export function activeAllowanceRows(asset, spenders, values, extra = {}) {
  if (typeof asset !== 'string' || asset.length === 0 || asset.length > 80) {
    throw new AppError('Unsupported asset.')
  }
  if (!Array.isArray(spenders) || !Array.isArray(values) || spenders.length !== values.length) {
    throw new AppError('Allowance results did not match the spender list.')
  }
  const rows = []
  for (let index = 0; index < spenders.length; index += 1) {
    const value = values[index]
    if (typeof value !== 'bigint' || value <= 0n) continue
    const row = { asset, spender: spenders[index], value }
    if (extra.symbol) row.symbol = extra.symbol
    if (Number.isInteger(extra.decimals)) row.decimals = extra.decimals
    if (extra.token) row.token = extra.token
    if (extra.partial) row.partial = true
    rows.push(row)
  }
  return rows
}

async function mapPool(items, limit, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  const workers = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workers }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index])
    }
  }))
  return results
}

function explorerSignal() {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(EXPLORER_TIMEOUT_MS)
    : undefined
}

async function readExplorerJson(response) {
  if (!response || response.ok === false || typeof response.json !== 'function') {
    throw new AppError('The Arc explorer did not return approval logs.')
  }
  const type = typeof response.headers?.get === 'function' ? response.headers.get('content-type') ?? '' : ''
  if (type.includes('text/html')) {
    throw new AppError('The Arc explorer did not return approval logs.')
  }
  try {
    return await response.json()
  } catch (error) {
    throw new AppError('The Arc explorer did not return approval logs.', { cause: error })
  }
}

export async function fetchApprovalLogs({ explorer, token, owner, fetchImpl }) {
  const request = fetchImpl ?? globalThis.fetch
  if (typeof request !== 'function') {
    throw new AppError('This browser cannot reach the Arc explorer.')
  }
  const url = approvalLogsUrl(explorer, token, owner)
  let response
  try {
    response = await request(url, { headers: { accept: 'application/json' }, signal: explorerSignal() })
  } catch (error) {
    throw new AppError('The Arc explorer did not return approval logs.', { cause: error })
  }
  const payload = await readExplorerJson(response)
  const logs = logsFromExplorerPayload(payload)
  if (logs.length >= MAX_APPROVAL_LOGS) {
    throw new AppError('This wallet has too many approval events to list safely.')
  }
  return logs
}

export async function fetchBlockscoutApprovalLogs({ explorer, token, fetchImpl }) {
  const request = fetchImpl ?? globalThis.fetch
  if (typeof request !== 'function') {
    throw new AppError('This browser cannot reach the Arc explorer.')
  }
  const logs = []
  let pageParams = null
  for (let page = 0; page < MAX_BLOCKSCOUT_PAGES; page += 1) {
    const url = blockscoutLogsUrl(explorer, token, pageParams)
    let response
    try {
      response = await request(url, { headers: { accept: 'application/json' }, signal: explorerSignal() })
    } catch (error) {
      throw new AppError('The Arc explorer did not return approval logs.', { cause: error })
    }
    const payload = await readExplorerJson(response)
    logs.push(...logsFromBlockscoutPayload(payload))
    pageParams = payload.next_page_params ?? null
    if (!pageParams) return { logs, partial: false }
  }
  return { logs, partial: true }
}

export async function fetchRecentRpcLogs({ provider, token, owner }) {
  if (!provider || typeof provider.getBlock !== 'function' || typeof provider.getLogs !== 'function') {
    throw new AppError('This wallet cannot read recent approval logs.')
  }
  const block = await provider.getBlock('latest')
  const number = block?.number
  if (typeof number !== 'number' && typeof number !== 'bigint') {
    throw new AppError('The Arc RPC did not return a block.')
  }
  const range = recentLogRange(number)
  const ownerAddress = canonicalAddress(owner)
  const tokenAddress = canonicalAddress(token)
  if (!ownerAddress || !tokenAddress) throw new AppError('Allowance discovery needs a token and an owner.')
  let logs
  try {
    logs = await provider.getLogs({
      address: tokenAddress,
      fromBlock: Number(range.fromBlock),
      toBlock: Number(range.toBlock),
      topics: [APPROVAL_TOPIC, `0x${ownerAddress.slice(2).toLowerCase().padStart(64, '0')}`],
    })
  } catch (error) {
    throw new AppError('The Arc RPC did not return approval logs.', { cause: error })
  }
  if (!Array.isArray(logs)) throw new AppError('The Arc RPC did not return approval logs.')
  return { logs, partial: true, fromBlock: range.fromBlock, toBlock: range.toBlock }
}

function truncatedExplorerError(error) {
  return /too many approval events/i.test(String(error?.message ?? ''))
}

export async function discoverApprovalLogs({ explorer, token, owner, fetchImpl, provider }) {
  try {
    const logs = await fetchApprovalLogs({ explorer, token, owner, fetchImpl })
    return { logs, partial: false, source: 'explorer' }
  } catch (explorerError) {
    if (truncatedExplorerError(explorerError)) throw explorerError
    try {
      const found = await fetchBlockscoutApprovalLogs({ explorer, token, fetchImpl })
      return { logs: found.logs, partial: found.partial, source: 'blockscout' }
    } catch (blockscoutError) {
      if (!provider) {
        throw new AppError('The Arc explorer did not return approval logs.', { cause: blockscoutError })
      }
      try {
        const found = await fetchRecentRpcLogs({ provider, token, owner })
        return { logs: found.logs, partial: true, source: 'rpc' }
      } catch (rpcError) {
        throw new AppError(
          'Approval logs could not be read from the Arc explorer or from the last 9,999 blocks.',
          { cause: rpcError },
        )
      }
    }
  }
}

async function allowancesForToken(provider, arc, account, token, fetchImpl) {
  const contract = new Contract(token.address, ERC20_ABI, provider)
  const [decimals, found] = await Promise.all([
    contract.decimals(),
    discoverApprovalLogs({
      explorer: arc.explorer,
      token: token.address,
      owner: account,
      fetchImpl,
      provider,
    }),
  ])
  if (Number(decimals) !== token.decimals) {
    throw new AppError(`${token.symbol} reported ${Number(decimals)} decimals, not ${token.decimals}. Allowances were not listed.`)
  }
  const spenders = spendersFromApprovalLogs(found.logs, account, token.address)
  const values = await mapPool(spenders, 8, (spender) => contract.allowance(account, spender))
  return {
    partial: found.partial,
    rows: activeAllowanceRows(token.id, spenders, values, {
      symbol: token.symbol,
      decimals: token.decimals,
      token: token.address,
      partial: found.partial,
    }),
  }
}

function tokensToScan(arc, extra) {
  const tokens = [...arc.tokens]
  const seen = new Set(tokens.map((token) => token.address.toLowerCase()))
  for (const row of Array.isArray(extra) ? extra : []) {
    const clean = sanitizeCustomToken(row, arc)
    if (!clean || seen.has(clean.address)) continue
    seen.add(clean.address)
    tokens.push(clean)
  }
  return tokens
}

export async function listActiveAllowances({ eip1193, expectedChainId, fetchImpl, tokens = [] }) {
  if (!eip1193?.request) throw new AppError('Connect a wallet before continuing.')
  const provider = new BrowserProvider(eip1193)
  try {
    const signer = await provider.getSigner()
    const account = getAddress(await signer.getAddress())
    const chainId = Number((await provider.getNetwork()).chainId)
    if (!Number.isSafeInteger(chainId)) throw new AppError('The wallet returned an invalid chain id.')
    if (expectedChainId != null && chainId !== expectedChainId) {
      throw new AppError('The wallet network changed. Review the allowance list and try again.')
    }
    const arc = getArcNetwork(chainId)
    if (!arc) throw new AppError('Switch to Arc to list token allowances.')

    const groups = await Promise.all(tokensToScan(arc, tokens).map((token) => (
      allowancesForToken(provider, arc, account, token, fetchImpl)
    )))
    const currentAccount = getAddress(await (await provider.getSigner()).getAddress())
    const currentChainId = Number((await provider.getNetwork()).chainId)
    if (currentAccount !== account) {
      throw new AppError('The wallet account changed. Read the allowances again.')
    }
    if (currentChainId !== chainId) {
      throw new AppError('The wallet network changed. Review the allowance list and try again.')
    }
    return {
      rows: groups.flatMap((group) => group.rows),
      partial: groups.some((group) => group.partial),
    }
  } finally {
    provider.destroy()
  }
}
