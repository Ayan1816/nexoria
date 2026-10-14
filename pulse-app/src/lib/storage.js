import { getAddress } from 'ethers'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { AppError, toUserError } from './errors.js'
import {
  cloudEnabled,
  cloudSessionOpen,
  ensureCloudUser,
  getFirebase,
  isOptionalCloudError,
  noteCloudUnavailable,
} from './firebase.js'
import { emptyState, mergeReceipts, sanitizeState } from './state.js'

const LEDGER_DB = 'nexoria.ledger'
const LEDGER_STORE = 'wallets'
const CLOUD_WAIT_MS = 2000

export function storageKey(address) {
  return `nexoria.v1.${address.toLowerCase()}`
}

function browserLocal() {
  const store = globalThis.localStorage
  if (!store || typeof store.getItem !== 'function' || typeof store.setItem !== 'function') return null
  return store
}

function stampedState(state) {
  return {
    updatedAt: state.updatedAt,
    txHistory: state.txHistory,
    tasks: state.tasks,
  }
}

export function chooseLedger(localState, indexedState) {
  if (!localState) return indexedState ?? null
  if (!indexedState) return localState
  return indexedState.updatedAt > localState.updatedAt ? indexedState : localState
}

export function readLocal(address) {
  const store = browserLocal()
  if (!store) return null
  try {
    const raw = store.getItem(storageKey(address))
    if (!raw) return null
    return sanitizeState(JSON.parse(raw))
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('Saved wallet data in this browser is unreadable.', { cause: error })
  }
}

export function writeLocal(address, state) {
  const store = browserLocal()
  if (!store) throw new AppError('This browser has no local storage.')
  try {
    store.setItem(storageKey(address), JSON.stringify(stampedState(state)))
  } catch (error) {
    throw new AppError('This browser blocked local saving. Free some space and try again.', { cause: error })
  }
}

function openLedgerDb() {
  const factory = globalThis.indexedDB
  if (!factory || typeof factory.open !== 'function') return Promise.resolve(null)
  return new Promise((resolve) => {
    let request
    try {
      request = factory.open(LEDGER_DB, 1)
    } catch (error) {
      console.error(error)
      resolve(null)
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(LEDGER_STORE)) db.createObjectStore(LEDGER_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

async function readIndexed(address) {
  const db = await openLedgerDb()
  if (!db) return null
  return new Promise((resolve, reject) => {
    const request = db.transaction(LEDGER_STORE, 'readonly').objectStore(LEDGER_STORE).get(storageKey(address))
    request.onsuccess = () => {
      try {
        resolve(request.result ? sanitizeState(request.result) : null)
      } catch (error) {
        reject(error)
      }
    }
    request.onerror = () => reject(request.error)
  })
}

async function writeIndexed(address, state) {
  const db = await openLedgerDb()
  if (!db) return false
  const record = stampedState(state)
  await new Promise((resolve, reject) => {
    const tx = db.transaction(LEDGER_STORE, 'readwrite')
    tx.objectStore(LEDGER_STORE).put(record, storageKey(address))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB aborted the ledger write.'))
  })
  return true
}

async function readDurable(address) {
  let localState = null
  let localFailed = false
  try {
    localState = readLocal(address)
  } catch (error) {
    localFailed = true
    console.error(error)
  }
  let indexedState = null
  let indexedFailed = false
  try {
    indexedState = await readIndexed(address)
  } catch (error) {
    indexedFailed = true
    console.error(error)
  }
  const state = chooseLedger(localState, indexedState)
  if (state && (localFailed || !localState || localState.updatedAt !== state.updatedAt)) {
    try { writeLocal(address, state) } catch (error) { console.error(error) }
  }
  if (state && (indexedFailed || !indexedState || indexedState.updatedAt !== state.updatedAt)) {
    try { await writeIndexed(address, state) } catch (error) { console.error(error) }
  }
  const saved = Boolean(state)
  return {
    state,
    localError: saved || (!localFailed && !indexedFailed) ? null : new AppError('Saved wallet data in this browser is unreadable.'),
  }
}

async function writeDurable(address, state) {
  let saved = false
  try {
    writeLocal(address, state)
    saved = true
  } catch (error) {
    console.error(error)
  }
  try {
    saved = await writeIndexed(address, state) || saved
  } catch (error) {
    console.error(error)
  }
  if (saved) return { localError: null }
  return { localError: new AppError('This browser blocked local saving. Free some space and try again.') }
}

export async function readRemote(address) {
  const client = getFirebase()
  if (!client) return { unavailable: true }
  const user = await ensureCloudUser()
  if (!user) return { unavailable: true }
  const ref = doc(client.db, 'nexoria_users', user.uid, 'wallets', address.toLowerCase())
  try {
    const snap = await getDoc(ref)
    if (snap.exists()) return { state: sanitizeState(snap.data()), migrated: false }
    const legacy = await readLegacyRemote(client.db, user.uid, address)
    if (!legacy) return { state: null, migrated: false }
    return { state: legacy, migrated: true }
  } catch (error) {
    if (isOptionalCloudError(error)) {
      noteCloudUnavailable()
      console.error(error)
      return { unavailable: true }
    }
    throw error
  }
}

function readRemoteLimited(address) {
  let timer
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      noteCloudUnavailable()
      resolve({ unavailable: true })
    }, CLOUD_WAIT_MS)
  })
  return Promise.race([readRemote(address), timeout]).finally(() => clearTimeout(timer))
}

export async function writeRemote(address, state) {
  if (!cloudSessionOpen()) return
  const client = getFirebase()
  if (!client) return
  const user = await ensureCloudUser()
  if (!user) return
  const ref = doc(client.db, 'nexoria_users', user.uid, 'wallets', address.toLowerCase())
  try {
    await setDoc(ref, stampedState(state))
  } catch (error) {
    if (isOptionalCloudError(error)) {
      noteCloudUnavailable()
      console.error(error)
      return
    }
    throw error
  }
}

export async function readSavedReceipts(address) {
  const durable = await readDurable(address)
  if (!durable.state) {
    if (durable.localError) throw durable.localError
    return []
  }
  return durable.state.txHistory
}

export async function loadWalletState(address, remote = null) {
  const durable = await readDurable(address)
  const localState = durable.state
  let remoteState = null
  let remoteMigrated = false
  let remoteError = null
  let unavailable = true
  const enabled = remote ? remote.enabled() : cloudEnabled()
  if (enabled) {
    unavailable = false
    try {
      const result = remote ? await remote.read(address) : await readRemoteLimited(address)
      if (!result || result.unavailable) {
        unavailable = true
      } else {
        remoteState = result.state ?? null
        remoteMigrated = Boolean(result.migrated)
      }
    } catch (error) {
      unavailable = true
      if (isOptionalCloudError(error)) {
        noteCloudUnavailable()
        console.error(error)
      } else {
        remoteError = toUserError(error)
      }
    }
  }

  let state = emptyState()
  let migrated = false
  if (localState && remoteState) {
    const localEmpty = localState.txHistory.length === 0 && localState.tasks.length === 0
    const legacyFillsEmptyLocal = remoteMigrated && remoteState.updatedAt === 0 && localEmpty
    if (remoteState.updatedAt > localState.updatedAt || legacyFillsEmptyLocal) {
      state = remoteState
      migrated = remoteMigrated
    } else {
      state = localState
    }
  } else if (remoteState) {
    state = remoteState
    migrated = remoteMigrated
  } else if (localState) {
    state = localState
  }

  return {
    state,
    localError: durable.localError,
    remoteError,
    remoteWritable: enabled && !unavailable && remoteError === null,
    migrated,
  }
}

export async function appendWalletHistory(address, rows, taskPatch) {
  const loaded = await loadWalletState(address)
  const tasks = typeof taskPatch === 'function' ? taskPatch(loaded.state.tasks) : loaded.state.tasks
  const next = mergeReceipts({ ...loaded.state, tasks }, rows)
  return persistWalletState(address, {
    updatedAt: next.updatedAt,
    txHistory: next.txHistory,
    tasks: next.tasks,
  }, loaded.remoteWritable)
}

export async function persistWalletState(address, state, remoteWritable) {
  const stamped = {
    updatedAt: state.updatedAt,
    txHistory: state.txHistory,
    tasks: state.tasks,
  }
  let remoteError = null
  const saved = await writeDurable(address, stamped)
  const localError = saved.localError
  if (remoteWritable) {
    try {
      await writeRemote(address, stamped)
    } catch (error) {
      remoteError = toUserError(error)
    }
  }
  return { localError, remoteError }
}

function legacyKeys(address) {
  const lower = address.toLowerCase()
  const keys = [lower]
  try {
    const checksum = getAddress(lower)
    if (checksum !== lower) keys.push(checksum)
  } catch {
    // The address was already checked by the caller.
  }
  return keys
}

function denied(error) {
  const code = String(error?.code ?? '')
  const message = String(error?.message ?? '')
  return code === 'permission-denied' || code === 'unauthenticated' || /permission|insufficient permissions/i.test(message)
}

async function readLegacyRemote(db, uid, address) {
  const parentRef = doc(db, 'nexoria_users', uid)
  let parent
  try {
    parent = await getDoc(parentRef)
  } catch (error) {
    if (denied(error)) return null
    throw error
  }
  if (!parent.exists()) return null
  const data = parent.data()
  if (!data || typeof data !== 'object') return null
  for (const key of legacyKeys(address)) {
    const txHistory = data[`${key}_txHistory`]
    const tasks = data[`${key}_tasks`]
    if (txHistory == null && tasks == null) continue
    const stamped = data[`${key}_updatedAt`]
    return sanitizeState({
      updatedAt: Number.isSafeInteger(stamped) && stamped > 0 ? stamped : 0,
      txHistory: txHistory ?? [],
      tasks: tasks ?? [],
    })
  }
  return null
}
