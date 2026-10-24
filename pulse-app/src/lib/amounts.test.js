import assert from 'node:assert/strict'
import test from 'node:test'
import { formatToken, parseAmount, parseWholeSupply } from './amounts.js'

test('parses USDC amounts in 6 decimals', () => {
  assert.equal(parseAmount('1', 6), 1_000_000n)
  assert.equal(parseAmount('1.0', 6), 1_000_000n)
  assert.equal(parseAmount('0.000001', 6), 1n)
  assert.equal(parseAmount('1.25', 6), 1_250_000n)
})

test('rejects amounts that would round or use float notation', () => {
  assert.throws(() => parseAmount('0.0000001', 6), /decimal places/)
  assert.throws(() => parseAmount('1e6', 6), /plain decimal/)
  assert.throws(() => parseAmount('1.', 6), /plain decimal/)
  assert.throws(() => parseAmount('.5', 6), /plain decimal/)
  assert.throws(() => parseAmount('-1', 6), /plain decimal/)
  assert.throws(() => parseAmount('1,000', 6), /plain decimal/)
})

test('parses 8-decimal and 18-decimal token amounts', () => {
  assert.equal(parseAmount('1.12345678', 8), 112_345_678n)
  assert.throws(() => parseAmount('1.123456789', 8), /decimal places/)
  assert.equal(parseAmount('1', 18), 10n ** 18n)
  assert.equal(parseAmount('0.000000000000000001', 18), 1n)
  assert.throws(() => parseAmount('1', 19), /not supported/)
})

test('formats native gas wei without floating point', () => {
  assert.equal(formatToken(420_000_000_000_000n, 18, 8), '0.00042')
  assert.equal(formatToken(1_000_000n, 6, 6), '1')
  assert.equal(formatToken(1n, 6, 6), '0.000001')
})

test('bounds whole token supply', () => {
  assert.equal(parseWholeSupply('1'), 1n)
  assert.throws(() => parseWholeSupply('0'), /between 1/)
  assert.throws(() => parseWholeSupply('1.5'), /whole number/)
  assert.throws(() => parseWholeSupply('1000000000000001'), /between 1/)
})
