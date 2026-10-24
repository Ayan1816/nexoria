import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ledgerAmount, receiptDate, receiptsToCsv } from './ledgerCsv.js'

const OWNER = '0x1111111111111111111111111111111111111111'
const RECIPIENT = '0x2222222222222222222222222222222222222222'

test('formats saved receipts as an accounting csv', () => {
  const csv = receiptsToCsv([
    {
      time: '2026-10-13T15:04:05.000Z',
      amount: '1.25',
      token: 'USDC',
      to: RECIPIENT,
    },
    {
      time: '12:00:01',
      amount: '4',
      token: 'EURC',
      to: OWNER,
    },
  ])
  assert.equal(csv.charCodeAt(0), 0xfeff)
  const lines = csv.slice(1).trim().split('\r\n')
  assert.deepEqual(lines, [
    'Date,Amount,Token,Recipient Address',
    `2026-10-13T15:04:05.000Z,1.25,USDC,${RECIPIENT}`,
    `12:00:01,4,EURC,${OWNER}`,
  ])
})

test('quotes unusual receipt fields and keeps a clock-only date as stored', () => {
  assert.equal(receiptDate('09:15:02'), '09:15:02')
  assert.equal(receiptDate('not-a-date'), 'not-a-date')
  const csv = receiptsToCsv([{
    time: '09:15:02',
    amount: '=1,25',
    token: 'USD"C',
    to: RECIPIENT,
  }])
  assert.match(csv, /"'=1,25","USD""C"/)
  assert.match(csv, new RegExp(RECIPIENT))
})

test('formats an 8-decimal token amount before it is written to the ledger', () => {
  assert.equal(ledgerAmount({ amount: 1n, decimals: 8 }), '0.00000001')
  assert.equal(ledgerAmount({ amount: 10n ** 18n, decimals: 18 }), '1')
  const csv = receiptsToCsv([{ time: '12:00:00', amount: 12_345_678n, decimals: 8, token: 'cirBTC', to: RECIPIENT }])
  assert.match(csv, /0\.12345678,cirBTC,/)
})

test('the ledger tab exports saved receipts', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
  assert.match(app, /Export CSV/)
  assert.match(app, /readSavedReceipts\(/)
  assert.match(app, /receiptsToCsv\(/)
  assert.match(app, /downloadCsv\(/)
})
