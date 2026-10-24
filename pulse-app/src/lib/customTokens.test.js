import assert from 'node:assert/strict'
import test from 'node:test'
import { AbiCoder, Interface } from 'ethers'
import { ERC20_ABI } from './abi.js'
import {
  addCustomToken,
  customTokenStorageKey,
  readCustomTokenMetadata,
  removeCustomToken,
  sanitizeCustomToken,
} from './customTokens.js'
import { ARC_MAINNET } from './networks.js'

const WALLET = '0x1111111111111111111111111111111111111111'
const TOKEN = '0x4444444444444444444444444444444444444444'
const coder = AbiCoder.defaultAbiCoder()
const iface = new Interface(ERC20_ABI)

test('stores custom tokens per wallet and chain', () => {
  assert.equal(customTokenStorageKey(WALLET, 5042), `nexoria.tokens.v1.${WALLET}.5042`)
  assert.equal(customTokenStorageKey(WALLET, 5042002).endsWith('.5042002'), true)
  assert.throws(() => customTokenStorageKey(WALLET, 0), /chain id/)
})

test('rejects an official Arc token and a token with bad metadata', () => {
  assert.equal(sanitizeCustomToken({
    address: ARC_MAINNET.contracts.usdc,
    symbol: 'USDC',
    name: 'USDC',
    decimals: 6,
  }, ARC_MAINNET), null)
  assert.throws(
    () => addCustomToken([], {
      address: ARC_MAINNET.contracts.eurc,
      symbol: 'EURC',
      name: 'EURC',
      decimals: 6,
    }, ARC_MAINNET),
    /official Arc token/,
  )
  assert.equal(sanitizeCustomToken({ address: TOKEN, symbol: '1BAD', name: 'Nope', decimals: 18 }, ARC_MAINNET), null)
  assert.equal(sanitizeCustomToken({ address: TOKEN, symbol: 'POINTS', name: 'Points', decimals: 19 }, ARC_MAINNET), null)
  const clean = sanitizeCustomToken({ address: TOKEN, symbol: 'Points', name: 'Points', decimals: 18 }, ARC_MAINNET)
  assert.equal(clean.symbol, 'Points')
  assert.equal(clean.decimals, 18)
  assert.equal(clean.isOfficial, false)
  assert.equal(clean.gasToken, false)
  const saved = addCustomToken([], clean, ARC_MAINNET)
  assert.equal(removeCustomToken(saved, clean.id).length, 0)
})

test('reads name, symbol, and decimals from a contract before it can be saved', async () => {
  const eip1193 = {
    async request(payload) {
      if (payload.method === 'eth_chainId') return ARC_MAINNET.hexChainId
      if (payload.method === 'eth_getCode') return '0x60016000'
      if (payload.method === 'eth_call') {
        const parsed = iface.parseTransaction({ data: payload.params[0].data })
        if (parsed.name === 'name') return coder.encode(['string'], ['Points'])
        if (parsed.name === 'symbol') return coder.encode(['string'], ['POINTS'])
        if (parsed.name === 'decimals') return coder.encode(['uint8'], [18])
      }
      throw new Error(`unexpected ${payload.method}`)
    },
  }
  const meta = await readCustomTokenMetadata(eip1193, TOKEN, ARC_MAINNET)
  assert.equal(meta.symbol, 'POINTS')
  assert.equal(meta.name, 'Points')
  assert.equal(meta.decimals, 18)
  assert.equal(meta.address, TOKEN)
  await assert.rejects(
    readCustomTokenMetadata({
      async request(payload) {
        if (payload.method === 'eth_chainId') return ARC_MAINNET.hexChainId
        if (payload.method === 'eth_getCode') return '0x'
        throw new Error(`unexpected ${payload.method}`)
      },
    }, TOKEN, ARC_MAINNET),
    /no contract code/,
  )
  await assert.rejects(
    readCustomTokenMetadata(eip1193, ARC_MAINNET.contracts.usdc, ARC_MAINNET),
    /official Arc token/,
  )
})
