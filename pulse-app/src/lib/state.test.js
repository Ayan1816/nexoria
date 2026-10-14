import assert from 'node:assert/strict'
import test from 'node:test'
import { capTasks, mergeReceipts, normalizeTasks, sanitizeState } from './state.js'

const ADDRESS = '0x0000000000000000000000000000000000000001'
const HASH = `0x${'ab'.repeat(32)}`

test('drops invalid history instead of treating it as a receipt', () => {
  const state = sanitizeState({
    updatedAt: 10,
    txHistory: [{ id: '1', hash: 'not-a-hash', amount: '1', token: 'USDC', to: ADDRESS, time: '12:00:00', status: 'confirmed', chainId: 5042 }],
    tasks: [],
  })
  assert.equal(state.txHistory.length, 0)
  assert.equal(state.dropped.history, 1)
})

test('never resumes a task by sending it', () => {
  const now = 5_000
  const tasks = normalizeTasks([
    { id: 'due', address: ADDRESS, amount: '1', asset: 'usdc', delayMinutes: 1, status: 'pending', triggerAt: 1_000, chainId: 5042, error: '' },
    { id: 'later', address: ADDRESS, amount: '1', asset: 'usdc', delayMinutes: 1, status: 'pending', triggerAt: 9_000, chainId: 5042, error: '' },
    { id: 'open', address: ADDRESS, amount: '1', asset: 'usdc', delayMinutes: 1, status: 'submitting', triggerAt: 1_000, chainId: 5042, error: '' },
  ], now)
  assert.equal(tasks[0].status, 'ready')
  assert.equal(tasks[1].status, 'pending')
  assert.equal(tasks[2].status, 'unknown')
  assert.equal(tasks.some((task) => task.status === 'submitting' || task.status === 'completed'), false)
})

test('keeps a well-formed receipt', () => {
  const state = sanitizeState({
    updatedAt: 10,
    txHistory: [{ id: '1', hash: HASH, amount: '1', token: 'USDC', to: ADDRESS, time: '12:00:00', status: 'confirmed', chainId: 5042002 }],
    tasks: [],
  })
  assert.equal(state.txHistory[0].hash, HASH)
})

test('accepts legacy receipts and scheduled tasks', () => {
  const state = sanitizeState({
    txHistory: [
      { hash: HASH, amount: '2', token: 'NATIVE', to: ADDRESS, time: '12:00:00' },
      { id: 'msg', hash: HASH, amount: '0', token: 'MSG', to: ADDRESS, time: '12:00:01', status: 'Success' },
    ],
    tasks: [{ address: ADDRESS, amount: '1.5', token: 'USDC', status: 'Pending', time: 15 }],
  })
  assert.equal(state.dropped.history, 0)
  assert.equal(state.txHistory[0].token, 'USDC')
  assert.equal(state.txHistory[0].status, 'confirmed')
  assert.equal(state.txHistory[0].chainId, 5042002)
  assert.equal(state.txHistory[0].id, HASH)
  assert.equal(state.txHistory[1].token, 'USDC')
  assert.equal(state.tasks[0].asset, 'usdc')
  assert.equal(state.tasks[0].status, 'pending')
  assert.equal(state.tasks[0].delayMinutes, 15)
  assert.equal(state.tasks[0].chainId, 5042002)
  assert.equal(normalizeTasks(state.tasks, 5_000)[0].status, 'ready')
})

test('drops a task whose amount or delay cannot be signed', () => {
  const state = sanitizeState({
    tasks: [
      { id: 'bad-amount', address: ADDRESS, amount: '1e2', asset: 'usdc', delayMinutes: 1, status: 'pending', triggerAt: 1, chainId: 5042 },
      { id: 'bad-delay', address: ADDRESS, amount: '1', asset: 'usdc', delayMinutes: 8 * 24 * 60, status: 'pending', triggerAt: 1, chainId: 5042 },
      { id: 'zero', address: ADDRESS, amount: '0', asset: 'usdc', delayMinutes: 1, status: 'pending', triggerAt: 1, chainId: 5042 },
    ],
  })
  assert.equal(state.tasks.length, 0)
  assert.equal(state.dropped.tasks, 3)
})

test('prepends a real reverted receipt and keeps the newest fifty', () => {
  const older = Array.from({ length: 50 }, (_, index) => ({
    id: `old-${index}`,
    hash: HASH,
    amount: '1',
    token: 'USDC',
    to: ADDRESS,
    time: '12:00:00',
    status: 'confirmed',
    chainId: 5042,
  }))
  const next = mergeReceipts({ updatedAt: 1, txHistory: older, tasks: [] }, [{
    id: 'new',
    hash: HASH,
    amount: '2',
    token: 'USDC',
    to: ADDRESS,
    time: '12:00:01',
    status: 'reverted',
    chainId: 5042,
  }], 99)
  assert.equal(next.txHistory.length, 50)
  assert.equal(next.txHistory[0].id, 'new')
  assert.equal(next.txHistory[0].status, 'reverted')
  assert.equal(next.updatedAt, 99)
  assert.equal(next.txHistory.some((row) => row.id === 'old-49'), false)
})

test('cap keeps a new task by dropping a finished one', () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({ id: `done-${index}`, status: 'completed' }))
  rows.push({ id: 'new', status: 'pending' })
  const capped = capTasks(rows)
  assert.equal(capped.length, 20)
  assert.equal(capped.at(-1).id, 'new')
  assert.equal(capped.some((task) => task.id === 'done-0'), false)
})
