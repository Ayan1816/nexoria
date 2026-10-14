import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { PAYROLL_SAMPLE_CSV, payrollCsvToText } from './payrollCsv.js'
import { parsePayrollList } from './parse.js'

const ALICE = '0x1111111111111111111111111111111111111111'
const BOB = '0x2222222222222222222222222222222222222222'
const OFFICE = '0x3333333333333333333333333333333333333333'
const contacts = [{ id: 'office', name: 'Office Rent', address: OFFICE }]

test('loads a headerless payroll csv and the sample file', () => {
  const headerless = payrollCsvToText(`${ALICE}, 50\n${BOB},25.5\n`, [])
  assert.deepEqual(headerless.errors, [])
  assert.equal(headerless.count, 2)
  assert.deepEqual(parsePayrollList(headerless.text, '').map((row) => row.amountText), ['50', '25.5'])

  const sample = payrollCsvToText(`\uFEFF${PAYROLL_SAMPLE_CSV}`, [])
  assert.deepEqual(sample.errors, [])
  assert.equal(sample.count, 2)
  assert.match(sample.text, new RegExp(`^${ALICE} 50`))
})

test('resolves an exact contact name and keeps named columns in either order', () => {
  const named = payrollCsvToText('amount,contact name\n50,"Office Rent"\n', contacts)
  assert.deepEqual(named.errors, [])
  assert.equal(named.text, `${OFFICE} 50`)

  const extra = payrollCsvToText('name,note,amount\nOffice Rent,Ops,12.5\n', contacts)
  assert.equal(extra.text, `${OFFICE} 12.5`)
})

test('rejects invalid payroll csv rows and does not return a partial list', () => {
  const broken = payrollCsvToText([
    'address,amount',
    `${ALICE},50`,
    'Freelancer,10',
    '0x123,4',
    `${BOB},0`,
    `${ALICE},2`,
  ].join('\n'), contacts)
  assert.equal(broken.text, '')
  assert.equal(broken.count, 0)
  assert.match(broken.errors.join('\n'), /no saved contact is named "Freelancer"/)
  assert.match(broken.errors.join('\n'), /non-zero 0x address/)
  assert.match(broken.errors.join('\n'), /greater than zero/)
  assert.match(broken.errors.join('\n'), /already listed/)
})

test('rejects a payroll csv that is larger than one batch', () => {
  const lines = ['address,amount']
  for (let index = 1; index <= 26; index += 1) {
    lines.push(`0x${index.toString(16).padStart(40, '0')},1`)
  }
  const result = payrollCsvToText(lines.join('\n'), [])
  assert.equal(result.text, '')
  assert.match(result.errors.join('\n'), /at most 25/)
})

test('the payroll screen can upload a csv', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
  assert.match(app, /Upload CSV/)
  assert.match(app, /Download sample CSV/)
  assert.match(app, /payrollCsvToText\(/)
  assert.match(app, /PAYROLL_SAMPLE_CSV/)
})
