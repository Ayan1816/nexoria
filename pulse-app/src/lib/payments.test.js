import assert from 'node:assert/strict'
import test from 'node:test'
import { readFeeCaps } from './payments.js'

const GWEI = 1_000_000_000n

test('quotes Arc gas from fee data instead of getGasPrice', async () => {
  const provider = {
    async getBlock() {
      return { number: 8, baseFeePerGas: 20n * GWEI }
    },
    async getFeeData() {
      return { gasPrice: 25n * GWEI, maxFeePerGas: 40n * GWEI, maxPriorityFeePerGas: 0n }
    },
  }
  const fees = await readFeeCaps(provider)
  assert.equal(fees.maxFeePerGas, 40n * GWEI)
  assert.equal(fees.maxPriorityFeePerGas, 0n)
  assert.equal(fees.blockNumber, 8)
  assert.equal(fees.referenceFee, 65_000n * 40n * GWEI)
})

test('keeps the 20 gwei floor when fee data is below it', async () => {
  const provider = {
    async getBlock() {
      return { number: 9, baseFeePerGas: 1n * GWEI }
    },
    async getFeeData() {
      return { gasPrice: 1n * GWEI, maxFeePerGas: 2n * GWEI, maxPriorityFeePerGas: 0n }
    },
  }
  const fees = await readFeeCaps(provider)
  assert.equal(fees.maxFeePerGas, 20n * GWEI)
})

test('uses maxFeePerGas when the legacy gasPrice field is null', async () => {
  const provider = {
    async getBlock() {
      return { number: 10, baseFeePerGas: 15n * GWEI }
    },
    async getFeeData() {
      return { gasPrice: null, maxFeePerGas: 30n * GWEI, maxPriorityFeePerGas: 0n }
    },
  }
  const fees = await readFeeCaps(provider)
  assert.equal(fees.maxFeePerGas, 30n * GWEI)
  assert.equal(fees.maxPriorityFeePerGas, 0n)
})

test('refuses a provider that only exposes getGasPrice', async () => {
  const provider = {
    async getBlock() {
      return { number: 11, baseFeePerGas: 20n * GWEI }
    },
    async getGasPrice() {
      return 25n * GWEI
    },
  }
  await assert.rejects(() => readFeeCaps(provider), /cannot quote Arc gas/)
})
