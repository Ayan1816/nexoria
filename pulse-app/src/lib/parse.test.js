import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePayrollList } from './parse.js'

const ALICE = '0x0000000000000000000000000000000000000001'
const BOB = '0x0000000000000000000000000000000000000002'

test('rejects placeholder payroll lines', () => {
  assert.throws(() => parsePayrollList('0x111a...\n0x2222...', '1'), /Line 1/)
})

test('uses the global payroll amount and rejects a repeated address', () => {
  const rows = parsePayrollList(`${ALICE}\n${BOB} 2.5`, '1.5')
  assert.deepEqual(rows.map((row) => row.amountText), ['1.5', '2.5'])
  assert.throws(() => parsePayrollList(`${ALICE}\n${ALICE.toUpperCase()}`, '1'), /twice/)
})
