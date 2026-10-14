import assert from 'node:assert/strict'
import test from 'node:test'
import { loadWalletState, persistWalletState, readSavedReceipts, storageKey } from './storage.js'

const ADDRESS = '0x1111111111111111111111111111111111111111'

function receipt(amount, hashByte = 'ab') {
  return {
    id: `receipt-${amount}`,
    hash: `0x${hashByte.repeat(32)}`,
    amount,
    token: 'USDC',
    to: ADDRESS,
    time: '12:00:01',
    status: 'confirmed',
    chainId: 5042002,
  }
}

function installLocal(options = {}) {
  const map = new Map()
  globalThis.localStorage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      if (options.throwOnSet) throw new Error('quota')
      map.set(key, String(value))
    },
    removeItem: (key) => { map.delete(key) },
  }
  return map
}

function installIndexedDb() {
  const databases = new Map()
  globalThis.indexedDB = {
    open(name, version) {
      const request = {}
      let db = databases.get(name)
      if (!db) {
        db = {
          version: 0,
          data: new Map(),
          objectStoreNames: {
            names: new Set(),
            contains(storeName) { return this.names.has(storeName) },
          },
          createObjectStore(storeName) { this.objectStoreNames.names.add(storeName) },
          transaction() {
            return {
              objectStore: () => ({
                get: (key) => {
                  const result = db.data.get(key)
                  const req = {}
                  queueMicrotask(() => {
                    req.result = result
                    req.onsuccess?.()
                  })
                  return req
                },
                put: (value, key) => {
                  db.data.set(key, structuredClone(value))
                  return {}
                },
              }),
              set oncomplete(fn) { queueMicrotask(() => fn()) },
              set onerror(_fn) {},
              set onabort(_fn) {},
            }
          },
        }
        databases.set(name, db)
      }
      queueMicrotask(() => {
        request.result = db
        if (db.version < version) {
          request.onupgradeneeded?.()
          db.version = version
        }
        request.onsuccess?.()
      })
      return request
    },
  }
}

test('browser ledger', { concurrency: 1 }, async (t) => {
await t.test('receipts and tasks survive a reload when cloud sync is unavailable', async () => {
  installLocal()
  installIndexedDb()
  const saved = await persistWalletState(ADDRESS, {
    updatedAt: 40,
    txHistory: [receipt('1.25')],
    tasks: [],
  }, false)
  assert.equal(saved.localError, null)

  const loaded = await loadWalletState(ADDRESS)
  assert.equal(loaded.remoteWritable, false)
  assert.equal(loaded.remoteError, null)
  assert.equal(loaded.localError, null)
  assert.equal(loaded.state.txHistory.length, 1)
  assert.equal(loaded.state.txHistory[0].amount, '1.25')
  assert.equal(loaded.state.txHistory[0].hash, receipt('1.25').hash)
  assert.equal(loaded.state.txHistory[0].chainId, 5042002)
})

await t.test('keeps the ledger in IndexedDB when localStorage rejects the write', async () => {
  const options = { throwOnSet: true }
  installLocal(options)
  installIndexedDb()
  const row = receipt('3.50', 'cd')
  const saved = await persistWalletState(ADDRESS, {
    updatedAt: 80,
    txHistory: [row],
    tasks: [],
  }, false)
  assert.equal(saved.localError, null)
  assert.equal(globalThis.localStorage.getItem(storageKey(ADDRESS)), null)

  const loaded = await loadWalletState(ADDRESS)
  assert.equal(loaded.state.txHistory[0].amount, '3.50')
  assert.equal(loaded.state.txHistory[0].hash, row.hash)
})

await t.test('a newer IndexedDB copy restores a stale localStorage ledger', async () => {
  installLocal()
  installIndexedDb()
  await persistWalletState(ADDRESS, {
    updatedAt: 90,
    txHistory: [receipt('4.00', 'ef')],
    tasks: [],
  }, false)
  globalThis.localStorage.setItem(storageKey(ADDRESS), JSON.stringify({
    updatedAt: 10,
    txHistory: [receipt('0.10', '11')],
    tasks: [],
  }))

  const loaded = await loadWalletState(ADDRESS)
  assert.equal(loaded.state.txHistory[0].amount, '4.00')
  const repaired = JSON.parse(globalThis.localStorage.getItem(storageKey(ADDRESS)))
  assert.equal(repaired.txHistory[0].amount, '4.00')
  assert.equal(repaired.updatedAt, 90)
})

await t.test('cloud sign-in failure leaves the saved ledger in place', async () => {
  installLocal()
  installIndexedDb()
  await persistWalletState(ADDRESS, {
    updatedAt: 100,
    txHistory: [receipt('8.00', '22')],
    tasks: [],
  }, false)

  const loaded = await loadWalletState(ADDRESS, {
    enabled: () => true,
    async read() {
      const error = new Error('auth/operation-not-allowed')
      error.code = 'auth/operation-not-allowed'
      throw error
    },
  })
  assert.equal(loaded.remoteError, null)
  assert.equal(loaded.remoteWritable, false)
  assert.equal(loaded.state.txHistory[0].amount, '8.00')
})

await t.test('reads saved receipts from the newer local copy', async () => {
  installLocal()
  installIndexedDb()
  await persistWalletState(ADDRESS, {
    updatedAt: 120,
    txHistory: [receipt('9.50', '33')],
    tasks: [],
  }, false)
  globalThis.localStorage.setItem(storageKey(ADDRESS), JSON.stringify({
    updatedAt: 20,
    txHistory: [receipt('0.20', '44')],
    tasks: [],
  }))

  const rows = await readSavedReceipts(ADDRESS)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].amount, '9.50')
  assert.equal(rows[0].token, 'USDC')
  assert.equal(rows[0].to, ADDRESS)
})
})
