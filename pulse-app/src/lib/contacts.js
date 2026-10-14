import { AppError } from './errors.js'
import { assertAddress } from './parse.js'
import { chooseLedger } from './storage.js'
import { createId } from './state.js'

export const MAX_CONTACTS = 100

const DB_NAME = 'nexoria.ledger'
const DB_STORE = 'wallets'

export function contactStorageKey(address) {
  return `nexoria.contacts.v1.${assertAddress(address, 'Wallet')}`
}

export function normalizeContactName(value) {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (!/^[\x20-\x7E]{1,40}$/.test(name)) {
    throw new AppError('Contact name must be 1 to 40 letters, numbers, or symbols.')
  }
  return name
}

function sanitizeContact(row) {
  if (!row || typeof row !== 'object') return null
  let name
  let address
  try {
    name = normalizeContactName(row.name)
    address = assertAddress(row.address, 'Contact address')
  } catch {
    return null
  }
  const id = String(row.id ?? '').trim()
  if (!id || id.length > 80) return null
  return { id, name, address }
}

export function sanitizeContactBook(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Array.isArray(input.contacts)) {
    throw new AppError('Saved contacts have the wrong shape.')
  }
  const contacts = []
  const seenAddress = new Set()
  const seenName = new Set()
  for (const row of input.contacts) {
    const clean = sanitizeContact(row)
    if (!clean) continue
    const nameKey = clean.name.toLowerCase()
    if (seenAddress.has(clean.address) || seenName.has(nameKey)) continue
    seenAddress.add(clean.address)
    seenName.add(nameKey)
    contacts.push(clean)
    if (contacts.length >= MAX_CONTACTS) break
  }
  contacts.sort((a, b) => a.name.localeCompare(b.name))
  const updatedAt = Number.isSafeInteger(input.updatedAt) && input.updatedAt > 0 ? input.updatedAt : 0
  return { updatedAt, contacts }
}

export function upsertContact(contacts, input) {
  const name = normalizeContactName(input?.name)
  const address = assertAddress(input?.address, 'Contact address')
  const id = String(input?.id ?? '').trim()
  const rows = Array.isArray(contacts) ? contacts.map((row) => ({ ...row })) : []
  const nameKey = name.toLowerCase()
  if (rows.some((row) => row.name.toLowerCase() === nameKey && row.id !== id)) {
    throw new AppError('A contact already uses that name.')
  }
  const existingAddress = rows.find((row) => row.address === address && row.id !== id)
  if (existingAddress) throw new AppError(`That address is already saved as ${existingAddress.name}.`)
  if (id) {
    const index = rows.findIndex((row) => row.id === id)
    if (index === -1) throw new AppError('That contact is no longer saved.')
    rows[index] = { ...rows[index], name, address }
  } else {
    if (rows.length >= MAX_CONTACTS) throw new AppError('The address book already has 100 contacts.')
    rows.push({ id: createId(), name, address })
  }
  rows.sort((a, b) => a.name.localeCompare(b.name))
  return rows
}

export function removeContact(contacts, id) {
  const rows = Array.isArray(contacts) ? contacts : []
  const next = rows.filter((row) => row.id !== id)
  if (next.length === rows.length) throw new AppError('That contact is no longer saved.')
  return next
}

export function filterContacts(contacts, query, limit = 8) {
  const q = String(query ?? '').trim().toLowerCase()
  const rows = Array.isArray(contacts) ? contacts : []
  const matched = q
    ? rows.filter((row) => row.name.toLowerCase().includes(q) || row.address.includes(q))
    : rows
  const cap = Number.isInteger(limit) && limit > 0 ? limit : rows.length
  return matched.slice(0, cap)
}

function openContactDb() {
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
      const db = await openContactDb()
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
      const db = await openContactDb()
      if (!db) return false
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(DB_STORE, 'readwrite')
          tx.objectStore(DB_STORE).put(value, key)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
          tx.onabort = () => reject(tx.error ?? new Error('IndexedDB aborted the contact write.'))
        })
        return true
      } finally {
        db.close()
      }
    },
  }
}

async function readBook(read) {
  try {
    const raw = await read()
    if (raw == null || raw === '') return { book: null, failed: false }
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    return { book: sanitizeContactBook(value), failed: false }
  } catch (error) {
    console.error(error)
    return { book: null, failed: true }
  }
}

export async function loadContacts(address, io = browserIo()) {
  const key = contactStorageKey(address)
  const local = await readBook(() => io.readLocal(key))
  const indexed = await readBook(() => io.readIndexed(key))
  const book = chooseLedger(local.book, indexed.book)
  if (book && (!local.book || local.book.updatedAt !== book.updatedAt)) {
    try { io.writeLocal(key, book) } catch (error) { console.error(error) }
  }
  if (book && (!indexed.book || indexed.book.updatedAt !== book.updatedAt)) {
    try { await io.writeIndexed(key, book) } catch (error) { console.error(error) }
  }
  if (!book && local.failed && indexed.failed) {
    throw new AppError('Saved contacts in this browser are unreadable.')
  }
  return book?.contacts ?? []
}

export async function saveContacts(address, contacts, io = browserIo()) {
  const clean = sanitizeContactBook({ updatedAt: 1, contacts }).contacts
  if (clean.length !== (Array.isArray(contacts) ? contacts.length : 0)) {
    throw new AppError('A contact could not be saved.')
  }
  const book = { updatedAt: Date.now(), contacts: clean }
  const key = contactStorageKey(address)
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
