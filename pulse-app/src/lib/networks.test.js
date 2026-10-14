import assert from 'node:assert/strict'
import test from 'node:test'
import { ARC_MAINNET, ARC_TESTNET, NETWORKS } from './networks.js'

test('uses the published Arc chain ids and precompiles', () => {
  assert.equal(Number(ARC_TESTNET.hexChainId), 5042002)
  assert.equal(Number(ARC_MAINNET.hexChainId), 5042)
  for (const network of NETWORKS) {
    assert.equal(network.nativeCurrency.decimals, 18)
    assert.equal(network.nativeCurrency.symbol, 'USDC')
    assert.equal(network.contracts.usdc, '0x3600000000000000000000000000000000000000')
    assert.equal(network.contracts.memo, '0x5294E9927c3306DcBaDb03fe70b92e01cCede505')
    assert.equal(network.contracts.multicall3From, '0x522fAf9A91c41c443c66765030741e4AaCe147D0')
    assert.equal(network.rpcUrls.some((url) => url.includes('arc.network')), false)
    for (const url of network.rpcUrls) assert.match(url, /^https:\/\/[a-z0-9.-]+\.arc\.io$/)
    assert.match(network.explorer, /^https:\/\//)
  }
  assert.equal(ARC_TESTNET.contracts.eurc, '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a')
  assert.equal(ARC_MAINNET.contracts.eurc, '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1')
})
