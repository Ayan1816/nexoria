import assert from 'node:assert/strict'
import test from 'node:test'
import { ARC_MAINNET, ARC_TESTNET } from './networks.js'
import { switchOrAddChain } from './walletChain.js'

const ARC_TESTNET_PARAMS = {
  chainId: '0x4cef52',
  chainName: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: ['https://rpc.testnet.arc.io'],
  blockExplorerUrls: ['https://explorer.testnet.arc.io'],
}

function wallet(handlers) {
  const calls = []
  return {
    calls,
    async request(payload) {
      calls.push(payload)
      const handler = handlers[payload.method]
      if (!handler) return null
      return handler(payload)
    },
  }
}

test('adds Arc Testnet when switch reports an unrecognized chain id', async () => {
  const provider = wallet({
    wallet_switchEthereumChain(payload) {
      if (provider.calls.filter((call) => call.method === 'wallet_switchEthereumChain').length === 1) {
        const error = new Error('Internal JSON-RPC error.')
        error.code = -32603
        error.data = {
          code: 4902,
          message: 'Unrecognized chain ID "0x4cef52". Try adding the chain using wallet_addEthereumChain first.',
        }
        throw error
      }
      assert.equal(payload.params[0].chainId, '0x4cef52')
      return null
    },
  })

  await switchOrAddChain(provider, ARC_TESTNET)

  assert.deepEqual(provider.calls.map((call) => call.method), [
    'wallet_switchEthereumChain',
    'wallet_addEthereumChain',
    'wallet_switchEthereumChain',
  ])
  assert.deepEqual(provider.calls[1].params[0], ARC_TESTNET_PARAMS)
})

test('adds Arc Testnet when the wallet omits error code 4902', async () => {
  const provider = wallet({
    wallet_switchEthereumChain() {
      if (provider.calls.length === 1) throw new Error('Unrecognized chain ID "0x4cef52".')
      return null
    },
  })

  await switchOrAddChain(provider, ARC_TESTNET)
  assert.equal(provider.calls[1].method, 'wallet_addEthereumChain')
  assert.deepEqual(provider.calls[1].params[0], ARC_TESTNET_PARAMS)
})

test('does not add a chain when the user rejects the switch', async () => {
  const provider = wallet({
    wallet_switchEthereumChain() {
      const error = new Error('User rejected the request.')
      error.code = 4001
      throw error
    },
  })

  await assert.rejects(() => switchOrAddChain(provider, ARC_TESTNET), /User rejected/)
  assert.deepEqual(provider.calls.map((call) => call.method), ['wallet_switchEthereumChain'])
})

test('does not send testnet parameters when switching to Arc mainnet', async () => {
  const provider = wallet({
    wallet_switchEthereumChain() {
      const error = new Error('Unrecognized chain ID "0x13b2".')
      error.code = 4902
      throw error
    },
    wallet_addEthereumChain() {
      return null
    },
  })

  await assert.rejects(() => switchOrAddChain(provider, ARC_MAINNET), /did not switch/)
  assert.equal(provider.calls[1].params[0].chainId, '0x13b2')
  assert.equal(provider.calls[1].params[0].chainName, 'Arc')
  assert.equal(provider.calls[1].params[0].rpcUrls[0], 'https://rpc.mainnet.arc.io')
})
