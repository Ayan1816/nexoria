import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  contactStorageKey,
  filterContacts,
  loadContacts,
  normalizeContactName,
  removeContact,
  saveContacts,
  upsertContact,
} from './contacts.js'

const WALLET = '0x1111111111111111111111111111111111111111'
const OFFICE = '0x2222222222222222222222222222222222222222'
const FREELANCER = '0x3333333333333333333333333333333333333333'

function memoryIo() {
  const local = new Map()
  const indexed = new Map()
  return {
    local,
    indexed,
    readLocal(key) { return local.has(key) ? local.get(key) : null },
    writeLocal(key, value) { local.set(key, JSON.stringify(value)) },
    async readIndexed(key) { return indexed.has(key) ? indexed.get(key) : null },
    async writeIndexed(key, value) {
      indexed.set(key, value)
      return true
    },
  }
}

test('normalizes contact names and keeps addresses unique', () => {
  assert.equal(normalizeContactName('  Office   Rent '), 'Office Rent')
  assert.throws(() => normalizeContactName(''), /Contact name/)
  const added = upsertContact([], { name: 'Office Rent', address: OFFICE.toUpperCase() })
  assert.equal(added.length, 1)
  assert.equal(added[0].address, OFFICE)
  const edited = upsertContact(added, { id: added[0].id, name: 'Rent', address: OFFICE })
  assert.equal(edited[0].name, 'Rent')
  assert.throws(() => upsertContact(edited, { name: 'rent', address: FREELANCER }), /already uses that name/)
  assert.throws(() => upsertContact(edited, { name: 'Freelancer', address: OFFICE }), /already saved as Rent/)
  assert.equal(removeContact(edited, edited[0].id).length, 0)
})

test('filters contacts by name or address', () => {
  const rows = [
    { id: '1', name: 'Office Rent', address: OFFICE },
    { id: '2', name: 'Freelancer', address: FREELANCER },
  ]
  assert.deepEqual(filterContacts(rows, 'rent').map((row) => row.name), ['Office Rent'])
  assert.deepEqual(filterContacts(rows, FREELANCER.slice(0, 8)).map((row) => row.name), ['Freelancer'])
  assert.equal(filterContacts(rows, '').length, 2)
})

test('keeps the newer contact book across local storage and IndexedDB', async () => {
  const io = memoryIo()
  const saved = await saveContacts(WALLET, [{ id: 'office', name: 'Office Rent', address: OFFICE }], io)
  assert.equal(saved[0].name, 'Office Rent')
  const key = contactStorageKey(WALLET)
  io.writeLocal(key, {
    updatedAt: 1,
    contacts: [{ id: 'stale', name: 'Stale', address: FREELANCER }],
  })
  const loaded = await loadContacts(WALLET, io)
  assert.deepEqual(loaded.map((row) => row.name), ['Office Rent'])
  const repaired = JSON.parse(io.local.get(key))
  assert.equal(repaired.contacts[0].name, 'Office Rent')
  assert.equal(io.indexed.get(key).contacts[0].address, OFFICE)
})

test('the utilities tab and payment forms can pick a contact', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
  assert.match(app, /Contacts/)
  assert.match(app, /Save contact/)
  assert.match(app, /No saved contacts\./)
  assert.match(app, /Select contact/)
  assert.match(app, /loadContacts\(/)
  assert.match(app, /saveContacts\(/)
  assert.match(app, /upsertContact\(/)
  assert.match(app, /removeContact\(/)
})
