import { BrowserProvider, Contract, getAddress } from 'ethers'
import { ERC20_ABI } from './abi.js'
import { USDC_ERC20_DECIMALS } from './constants.js'
import { AppError } from './errors.js'
import { getArcNetwork, tokenAddress } from './networks.js'

// keccak256("Approval(address,address,uint256)")
export const APPROVAL_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'

// The Arc Testnet explorer returns the filtered set in one response and ignores
// page and offset. A result this large is treated as truncated, not as a full list.
export const MAX_APPROVAL_LOGS = 10_000

const ASSETS = ['usdc', 'eurc']
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
      const loggedToken = canonicalAddress(log.address)
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

export function approvalLogsUrl(explorer, token, owner) {
  const base = typeof explorer === 'string' ? explorer.replace(/\/$/, '') : ''
  if (base !== 'https://explorer.testnet.arc.io') {
    throw new AppError('Allowance discovery is available on Arc Testnet.')
  }
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
  })
  return `${base}/api?${params.toString()}`
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

export function activeAllowanceRows(asset, spenders, values) {
  if (asset !== 'usdc' && asset !== 'eurc') throw new AppError('Unsupported asset.')
  if (!Array.isArray(spenders) || !Array.isArray(values) || spenders.length !== values.length) {
    throw new AppError('Allowance results did not match the spender list.')
  }
  const rows = []
  for (let index = 0; index < spenders.length; index += 1) {
    const value = values[index]
    if (typeof value !== 'bigint' || value <= 0n) continue
    rows.push({ asset, spender: spenders[index], value })
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

export async function fetchApprovalLogs({ explorer, token, owner, fetchImpl }) {
  const request = fetchImpl ?? globalThis.fetch
  if (typeof request !== 'function') {
    throw new AppError('This browser cannot reach the Arc explorer.')
  }
  const url = approvalLogsUrl(explorer, token, owner)
  let response
  try {
    response = await request(url, {
      headers: { accept: 'application/json' },
      signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(EXPLORER_TIMEOUT_MS)
        : undefined,
    })
  } catch (error) {
    throw new AppError('The Arc explorer did not return approval logs.', { cause: error })
  }
  if (!response?.ok || typeof response.json !== 'function') {
    throw new AppError('The Arc explorer did not return approval logs.')
  }
  let payload
  try {
    payload = await response.json()
  } catch (error) {
    throw new AppError('The Arc explorer did not return approval logs.', { cause: error })
  }
  const logs = logsFromExplorerPayload(payload)
  if (logs.length >= MAX_APPROVAL_LOGS) {
    throw new AppError('This wallet has too many approval events to list safely.')
  }
  return logs
}

async function allowancesForAsset(provider, arc, account, asset, fetchImpl) {
  const token = tokenAddress(arc, asset)
  const contract = new Contract(token, ERC20_ABI, provider)
  const [decimals, logs] = await Promise.all([
    contract.decimals(),
    fetchApprovalLogs({ explorer: arc.explorer, token, owner: account, fetchImpl }),
  ])
  if (Number(decimals) !== USDC_ERC20_DECIMALS) {
    throw new AppError('Token decimals are not 6. Allowances were not listed.')
  }
  const spenders = spendersFromApprovalLogs(logs, account, token)
  const values = await mapPool(spenders, 8, (spender) => contract.allowance(account, spender))
  return activeAllowanceRows(asset, spenders, values)
}

export async function listActiveAllowances({ eip1193, expectedChainId, fetchImpl }) {
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
    if (!arc?.testnet) throw new AppError('Switch to Arc Testnet to list USDC and EURC allowances.')

    const groups = await Promise.all(ASSETS.map((asset) => (
      allowancesForAsset(provider, arc, account, asset, fetchImpl)
    )))
    const currentAccount = getAddress(await (await provider.getSigner()).getAddress())
    const currentChainId = Number((await provider.getNetwork()).chainId)
    if (currentAccount !== account) {
      throw new AppError('The wallet account changed. Read the allowances again.')
    }
    if (currentChainId !== chainId) {
      throw new AppError('The wallet network changed. Review the allowance list and try again.')
    }
    return groups.flat()
  } finally {
    provider.destroy()
  }
}
