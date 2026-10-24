import assert from 'node:assert/strict'
import test from 'node:test'
import { assertGasAndValue, bufferedGasLimit, nativeValueOfErc20Usdc, resolveMaxFeePerGas } from './arcGas.js'

const GWEI = 1_000_000_000n

test('keeps the Arc fee floor and ceiling', () => {
  assert.equal(resolveMaxFeePerGas({ baseFeePerGas: 20n * GWEI, gasPrice: 20n * GWEI }), 40n * GWEI)
  assert.equal(resolveMaxFeePerGas({ baseFeePerGas: 1n * GWEI, gasPrice: 1n * GWEI }), 20n * GWEI)
  assert.equal(resolveMaxFeePerGas({ baseFeePerGas: 15n * GWEI, gasPrice: 50n * GWEI }), 50n * GWEI)
  assert.equal(resolveMaxFeePerGas({ baseFeePerGas: 10_000n * GWEI, gasPrice: 10_000n * GWEI }), 20_000n * GWEI)
  assert.equal(resolveMaxFeePerGas({ baseFeePerGas: 15_000n * GWEI, gasPrice: 15_000n * GWEI }), 20_000n * GWEI)
  assert.equal(resolveMaxFeePerGas({ baseFeePerGas: 10_001n * GWEI, gasPrice: 0n }), 20_000n * GWEI)
  assert.throws(() => resolveMaxFeePerGas({ baseFeePerGas: 20_001n * GWEI, gasPrice: 0n }), /ceiling/)
  assert.throws(() => resolveMaxFeePerGas({ baseFeePerGas: 0n, gasPrice: 0n }), /did not return a gas price/)
})

test('converts 6-decimal USDC into 18-decimal native value', () => {
  assert.equal(nativeValueOfErc20Usdc(1_000_000n), 10n ** 18n)
  assert.equal(nativeValueOfErc20Usdc(1n), 10n ** 12n)
})

test('reserves gas from the same USDC balance as a USDC payment', () => {
  const amount = 1_000_000n
  const fee = 1n
  assert.throws(() => assertGasAndValue({
    asset: 'usdc',
    amount,
    tokenBalance: 0n,
    nativeBalance: 10n ** 18n,
    feeNative: fee,
  }), /Not enough USDC/)
  assert.doesNotThrow(() => assertGasAndValue({
    asset: 'usdc',
    amount,
    tokenBalance: 0n,
    nativeBalance: (10n ** 18n) + fee,
    feeNative: fee,
  }))
})

test('keeps EURC value and USDC gas separate', () => {
  assert.throws(() => assertGasAndValue({
    asset: 'eurc',
    amount: 1_000_000n,
    tokenBalance: 0n,
    nativeBalance: 10n ** 18n,
    feeNative: 1n,
  }), /Not enough EURC/)
  assert.throws(() => assertGasAndValue({
    asset: 'eurc',
    amount: 1_000_000n,
    tokenBalance: 1_000_000n,
    nativeBalance: 0n,
    feeNative: 1n,
  }), /gas/)
})

test('uses the token decimals for non-USDC balances and still reserves USDC for gas', () => {
  assert.throws(() => assertGasAndValue({
    asset: 'cirbtc',
    symbol: 'cirBTC',
    decimals: 8,
    gasToken: false,
    amount: 100_000_000n,
    tokenBalance: 50_000_000n,
    nativeBalance: 10n ** 18n,
    feeNative: 1n,
  }), /Not enough cirBTC/)
  assert.throws(() => assertGasAndValue({
    asset: 'weth',
    symbol: 'WETH',
    decimals: 18,
    gasToken: false,
    amount: 10n ** 18n,
    tokenBalance: 10n ** 18n,
    nativeBalance: 0n,
    feeNative: 1n,
  }), /Not enough USDC for gas/)
  assert.doesNotThrow(() => assertGasAndValue({
    asset: 'weth',
    symbol: 'WETH',
    decimals: 18,
    gasToken: false,
    amount: 10n ** 18n,
    tokenBalance: 10n ** 18n,
    nativeBalance: 1n,
    feeNative: 1n,
  }))
})

test('buffers gas without crossing the block limit', () => {
  assert.equal(bufferedGasLimit(21_000n), 25_200n)
  assert.throws(() => bufferedGasLimit(20_999n), /minimum/)
  assert.throws(() => bufferedGasLimit(25_000_001n), /Arc block/)
})
