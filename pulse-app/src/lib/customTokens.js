import { BrowserProvider, Contract, getAddress } from 'ethers'
import { ERC20_ABI } from './abi.js'
import { AppError } from './errors.js'
import { findOfficialToken, getArcNetwork } from './networks.js'
import { assertAddress } from './parse.js'
import { chooseLedger } from './storage.js'

export const MAX_CUSTOM_TOKENS = 100

const DB_NAME = 'nexoria.ledger'
const DB_STORE = 'wallets'
const SYMBOL = /^[A-Za-z][A-Za-z0-9]{0,31}$/
const PRINTABLE = /^[\x20-\x7E]+$/

export function customTokenStorageKey(address, chainId) {
  const id = Number(chainId)
  if (!Number.isSafeInteger(id) || id <= 0) throw new AppError('Custom tokens need an Arc chain id.')
  return `nexoria.tokens.v1.${assertAddress(address, 'Wallet')}.${id}`
}

export function customTokenId(address) {
  return `custom:${assertAddress(address, 'Token')}`
}

function cleanSymbol(value) {
  const symbol = String(value ?? '').trim()
  if (!SYMBOL.test(symbol)) return ''
  return symbol
}

function cleanName(value, symbol) {
  const name = String(value ?? '').trim()
  if (name.length === 0 || name.length > 64 || !PRINTABLE.test(name)) return symbol
  return name
}

export function sanitizeCustomToken(row, network) {
  if (!row || typeof row !== 'object') return null
  let address
  try {
    address = assertAddress(row.address, 'Token')
  } catch {
    return null
  }
  if (network && findOfficialToken(network, address)) return null
  const decimals = Number(row.decimals)
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) return null
  const symbol = cleanSymbol(row.symbol)
  if (!symbol) return null
  return {
    id: customTokenId(address),
    address,
    symbol,
    name: cleanName(row.name, symbol),
    decimals,
    isOfficial: false,
    gasToken: false,
  }
}

export function sanitizeCustomTokenBook(input, network) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Array.isArray(input.tokens)) {
    throw new AppError('Saved custom tokens have the wrong shape.')
  }
  const tokens = []
  const seen = new Set()
  for (const row of input.tokens) {
    const clean = sanitizeCustomToken(row, network)
    if (!clean || seen.has(clean.address)) continue
    seen.add(clean.address)
    tokens.push(clean)
    if (tokens.length >= MAX_CUSTOM_TOKENS) break
  }
  tokens.sort((a, b) => a.symbol.localeCompare(b.symbol) || a.address.localeCompare(b.address))
  const updatedAt = Number.isSafeInteger(input.updatedAt) && input.updatedAt > 0 ? input.updatedAt : 0
  return { updatedAt, tokens }
}

export function addCustomToken(tokens, input, network) {
  let hinted
  try { hinted = assertAddress(input?.address, 'Token') } catch { hinted = '' }
  if (hinted && network && findOfficialToken(network, hinted)) {
    throw new AppError(`${findOfficialToken(network, hinted).symbol} is already an official Arc token.`)
  }
  const clean = sanitizeCustomToken(input, network)
  if (!clean) throw new AppError('That contract is not a supported custom token on this network.')
  const rows = Array.isArray(tokens) ? tokens.map((row) => ({ ...row })) : []
  const index = rows.findIndex((row) => row.address === clean.address)
  if (index === -1 && rows.length >= MAX_CUSTOM_TOKENS) {
    throw new AppError('This wallet already has 100 custom tokens on this network.')
  }
  if (index === -1) rows.push(clean)
  else rows[index] = clean
  rows.sort((a, b) => a.symbol.localeCompare(b.symbol) || a.address.localeCompare(b.address))
  return rows
}

export function removeCustomToken(tokens, id) {
  const rows = Array.isArray(tokens) ? tokens : []
  const next = rows.filter((row) => row.id !== id)
  if (next.length === rows.length) throw new AppError('That custom token is no longer saved.')
  return next
}

function emptyCode(code) {
  return typeof code !== 'string' || code === '0x' || /^0x0+$/i.test(code)
}

function asProvider(source) {
  if (source?.request) return { provider: new BrowserProvider(source), owned: true }
  if (source && typeof source.getCode === 'function') return { provider: source, owned: false }
  throw new AppError('Connect a wallet before continuing.')
}

export async function readCustomTokenMetadata(source, tokenAddress, network) {
  const address = assertAddress(tokenAddress, 'Token')
  const arc = network ?? null
  if (arc && findOfficialToken(arc, address)) {
    const official = findOfficialToken(arc, address)
    throw new AppError(`${official.symbol} is already an official Arc token.`)
  }
  const { provider, owned } = asProvider(source)
  try {
    const code = await provider.getCode(address)
    if (emptyCode(code)) throw new AppError('That address has no contract code on this network.')
    const contract = new Contract(getAddress(address), ERC20_ABI, provider)
    let name
    let symbol
    let decimals
    try {
      ;[name, symbol, decimals] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
      ])
    } catch (error) {
      throw new AppError('That contract did not return name, symbol, and decimals.', { cause: error })
    }
    const clean = sanitizeCustomToken({
      address,
      name: String(name ?? ''),
      symbol: String(symbol ?? ''),
      decimals: Number(decimals),
    }, arc)
    if (!clean) {
      throw new AppError('That contract did not return a usable name, symbol, and decimals.')
    }
    return clean
  } finally {
    if (owned) provider.destroy()
  }
}

function openTokenDb() {
  const factory = globalThis.indexedDB
  if (!factory || typeof factory.open !== 'function') return Promise.resolve(null)
  return new Promise((resolve) => {
    let request
    try {
      request = factory.open(DB_NAME, 1)
    } catch (error) {
      console.error(error)
      resolve(null)
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

function browserIo() {
  return {
    readLocal(key) {
      const store = globalThis.localStorage
      if (!store || typeof store.getItem !== 'function') return null
      return store.getItem(key)
    },
    writeLocal(key, value) {
      const store = globalThis.localStorage
      if (!store || typeof store.setItem !== 'function') {
        throw new AppError('This browser has no local storage.')
      }
      try {
        store.setItem(key, JSON.stringify(value))
      } catch (error) {
        throw new AppError('This browser blocked local saving. Free some space and try again.', { cause: error })
      }
    },
    async readIndexed(key) {
      const db = await openTokenDb()
      if (!db) return null
      try {
        return await new Promise((resolve, reject) => {
          const request = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key)
          request.onsuccess = () => resolve(request.result ?? null)
          request.onerror = () => reject(request.error)
        })
      } finally {
        db.close()
      }
    },
    async writeIndexed(key, value) {
      const db = await openTokenDb()
      if (!db) return false
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(DB_STORE, 'readwrite')
          tx.objectStore(DB_STORE).put(value, key)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
          tx.onabort = () => reject(tx.error ?? new Error('IndexedDB aborted the token write.'))
        })
        return true
      } finally {
        db.close()
      }
    },
  }
}

async function readBook(read, network) {
  try {
    const raw = await read()
    if (raw == null || raw === '') return { book: null, failed: false }
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    return { book: sanitizeCustomTokenBook(value, network), failed: false }
  } catch (error) {
    console.error(error)
    return { book: null, failed: true }
  }
}

export async function loadCustomTokens(address, chainId, io = browserIo()) {
  const network = getArcNetwork(chainId)
  const key = customTokenStorageKey(address, chainId)
  const local = await readBook(() => io.readLocal(key), network)
  const indexed = await readBook(() => io.readIndexed(key), network)
  const book = chooseLedger(local.book, indexed.book)
  if (book && (!local.book || local.book.updatedAt !== book.updatedAt)) {
    try { io.writeLocal(key, book) } catch (error) { console.error(error) }
  }
  if (book && (!indexed.book || indexed.book.updatedAt !== book.updatedAt)) {
    try { await io.writeIndexed(key, book) } catch (error) { console.error(error) }
  }
  if (!book && local.failed && indexed.failed) {
    throw new AppError('Saved custom tokens in this browser are unreadable.')
  }
  return book?.tokens ?? []
}

export async function saveCustomTokens(address, chainId, tokens, io = browserIo()) {
  const network = getArcNetwork(chainId)
  const clean = sanitizeCustomTokenBook({ updatedAt: 1, tokens }, network).tokens
  if (clean.length !== (Array.isArray(tokens) ? tokens.length : 0)) {
    throw new AppError('A custom token could not be saved.')
  }
  const book = { updatedAt: Date.now(), tokens: clean }
  const key = customTokenStorageKey(address, chainId)
  let saved = false
  try {
    io.writeLocal(key, book)
    saved = true
  } catch (error) {
    console.error(error)
  }
  try {
    saved = (await io.writeIndexed(key, book)) || saved
  } catch (error) {
    console.error(error)
  }
  if (!saved) throw new AppError('This browser blocked local saving. Free some space and try again.')
  return clean
}
