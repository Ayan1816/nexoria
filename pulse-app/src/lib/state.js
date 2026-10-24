import { parseAmount } from './amounts.js'
import { HISTORY_LIMIT, MAX_DELAY_MINUTES, TASK_LIMIT } from './constants.js'
import { AppError } from './errors.js'
import { NETWORKS } from './networks.js'

const HASH = /^0x[a-fA-F0-9]{64}$/
const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const TASK_STATUS = new Set(['pending', 'ready', 'submitting', 'completed', 'failed', 'cancelled', 'unknown'])
const HISTORY_STATUS = new Set(['confirmed', 'reverted'])

export function emptyState() {
  return { updatedAt: 0, txHistory: [], tasks: [], dropped: { history: 0, tasks: 0 } }
}

export function sanitizeState(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError('Saved wallet data has the wrong shape.')
  }
  const dropped = { history: 0, tasks: 0 }
  const txHistory = []
  if (input.txHistory != null) {
    if (!Array.isArray(input.txHistory)) throw new AppError('Saved history has the wrong shape.')
    for (const row of input.txHistory) {
      const clean = sanitizeHistory(row)
      if (clean) txHistory.push(clean)
      else dropped.history += 1
    }
  }
  const tasks = []
  if (input.tasks != null) {
    if (!Array.isArray(input.tasks)) throw new AppError('Saved tasks have the wrong shape.')
    for (let index = 0; index < input.tasks.length; index += 1) {
      const clean = sanitizeTask(input.tasks[index], index)
      if (clean) tasks.push(clean)
      else dropped.tasks += 1
    }
  }
  const updatedAt = Number.isSafeInteger(input.updatedAt) && input.updatedAt > 0 ? input.updatedAt : 0
  return {
    updatedAt,
    txHistory: txHistory.slice(0, HISTORY_LIMIT),
    tasks: tasks.slice(0, TASK_LIMIT),
    dropped,
  }
}

export function normalizeTasks(tasks, now = Date.now()) {
  return tasks.map((task) => {
    if (task.status === 'submitting') {
      return {
        ...task,
        status: 'unknown',
        error: 'A send was in progress when the app closed. Check the wallet before sending again.',
      }
    }
    if (task.status === 'pending' && task.triggerAt <= now) return { ...task, status: 'ready' }
    return task
  })
}

export function createId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const FINISHED_TASK = new Set(['completed', 'cancelled'])

export function mergeReceipts(state, rows, now = Date.now()) {
  return sanitizeState({
    updatedAt: now,
    txHistory: [...rows, ...(state?.txHistory ?? [])],
    tasks: state?.tasks ?? [],
  })
}

export function capTasks(rows) {
  const next = Array.isArray(rows) ? rows.slice() : []
  while (next.length > TASK_LIMIT) {
    const index = next.findIndex((task) => FINISHED_TASK.has(task?.status))
    if (index === -1) break
    next.splice(index, 1)
  }
  return next.slice(-TASK_LIMIT)
}

function sanitizeHistory(row) {
  if (!row || typeof row !== 'object') return null
  if (typeof row.hash !== 'string' || !HASH.test(row.hash)) return null
  const token = legacyToken(row.token)
  const status = legacyHistoryStatus(row.status)
  if (!token || !status) return null
  if (typeof row.to !== 'string' || !ADDRESS.test(row.to)) return null
  const chainId = Number.isSafeInteger(row.chainId) ? row.chainId : 5042002
  const amount = String(row.amount ?? '')
  const time = String(row.time ?? '')
  if (amount.length === 0 || amount.length > 80 || time.length === 0 || time.length > 40) return null
  let id = String(row.id ?? '').trim()
  if (id.length === 0) id = row.hash
  if (id.length === 0 || id.length > 80) return null
  return {
    id,
    hash: row.hash,
    amount,
    token,
    to: row.to.toLowerCase(),
    time,
    status,
    chainId,
  }
}

function officialTaskMeta(id) {
  for (const network of NETWORKS) {
    const token = network.tokens.find((item) => item.id === id)
    if (token) return token
  }
  return null
}

function taskAssetId(row) {
  if (row.asset === 'eurc' || row.token === 'EURC') return 'eurc'
  if (row.asset === 'usdc' || row.token === 'NATIVE' || row.token === 'USDC') return 'usdc'
  if (typeof row.asset === 'string') {
    const meta = officialTaskMeta(row.asset)
    if (meta) return meta.id
  }
  return ''
}

function sanitizeTask(row, index) {
  if (!row || typeof row !== 'object') return null
  const address = typeof row.address === 'string' ? row.address : ''
  if (!ADDRESS.test(address)) return null
  const status = legacyTaskStatus(row.status)
  if (!status) return null
  const amount = String(row.amount ?? '').trim()
  if (amount.length === 0 || amount.length > 40) return null
  const delayMinutes = Number.isSafeInteger(row.delayMinutes) && row.delayMinutes >= 1
    ? row.delayMinutes
    : Number(row.time)
  if (!Number.isSafeInteger(delayMinutes) || delayMinutes < 1 || delayMinutes > MAX_DELAY_MINUTES) return null
  const triggerAt = Number.isSafeInteger(row.triggerAt) && row.triggerAt >= 0 ? row.triggerAt : 0
  const chainId = Number.isSafeInteger(row.chainId) ? row.chainId : 5042002
  let id = String(row.id ?? '').trim()
  if (id.length === 0) id = `${index}-${address.toLowerCase()}-${amount}-${delayMinutes}`.slice(0, 80)
  if (id.length === 0 || id.length > 80) return null
  const error = typeof row.error === 'string' ? row.error.slice(0, 180) : ''
  const officialId = taskAssetId(row)
  if (officialId) {
    const meta = officialTaskMeta(officialId)
    try {
      if (parseAmount(amount, meta.decimals) <= 0n) return null
    } catch {
      return null
    }
    return {
      id,
      address: address.toLowerCase(),
      amount,
      asset: meta.id,
      symbol: meta.symbol,
      decimals: meta.decimals,
      delayMinutes,
      status,
      triggerAt,
      chainId,
      error,
    }
  }
  return sanitizeCustomTask(row, { id, address, amount, delayMinutes, status, triggerAt, chainId, error })
}

function sanitizeCustomTask(row, base) {
  const tokenAddress = typeof row.tokenAddress === 'string' ? row.tokenAddress.toLowerCase() : ''
  if (!ADDRESS.test(tokenAddress) || /^0x0{40}$/i.test(tokenAddress)) return null
  const decimals = Number(row.decimals)
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) return null
  const symbol = typeof row.symbol === 'string' ? row.symbol.trim() : ''
  if (!/^[A-Za-z][A-Za-z0-9]{0,31}$/.test(symbol)) return null
  try {
    if (parseAmount(base.amount, decimals) <= 0n) return null
  } catch {
    return null
  }
  return {
    ...base,
    address: base.address.toLowerCase(),
    asset: `custom:${tokenAddress}`,
    symbol,
    decimals,
    tokenAddress,
  }
}

function legacyToken(token) {
  if (token === 'USDC' || token === 'NATIVE' || token === 'MSG') return 'USDC'
  if (token === 'EURC') return 'EURC'
  if (token === 'TOKEN') return 'TOKEN'
  if (typeof token === 'string' && /^[A-Za-z][A-Za-z0-9]{0,31}$/.test(token)) return token
  return null
}

function legacyHistoryStatus(status) {
  if (status == null || status === 'Success' || status === 'success') return 'confirmed'
  if (status === 'Failed' || status === 'failed' || status === 'Reverted') return 'reverted'
  return HISTORY_STATUS.has(status) ? status : null
}

function legacyTaskStatus(status) {
  if (status === 'Pending') return 'pending'
  if (status === 'Completed') return 'completed'
  if (status === 'Failed') return 'failed'
  return TASK_STATUS.has(status) ? status : null
}
