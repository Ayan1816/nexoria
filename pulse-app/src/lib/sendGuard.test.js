import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ARC_TESTNET } from './networks.js'
import {
  analyzeSendGuard,
  guardAllowsSend,
  isContractCode,
  isKnownRecipient,
  guardLevel,
} from './sendGuard.js'

const WALLET = '0x2222222222222222222222222222222222222222'
const CONTRACT = '0x3333333333333333333333333333333333333333'
const KNOWN = '0x4444444444444444444444444444444444444444'

test('tells an empty account from a contract and a known ledger recipient', () => {
  assert.equal(isContractCode('0x'), false)
  assert.equal(isContractCode('0x0'), false)
  assert.equal(isContractCode('0x60016000'), true)
  assert.equal(isContractCode('nope'), null)
  assert.equal(isKnownRecipient([{ to: KNOWN.toUpperCase() }], KNOWN), true)
  assert.equal(isKnownRecipient([{ to: WALLET }], KNOWN), false)
  assert.equal(guardLevel({ contract: true, known: true }), 'contract')
  assert.equal(guardLevel({ contract: false, known: true }), 'known')
  assert.equal(guardLevel({ contract: false, known: false }), 'new')
})

test('a known wallet can send and a warning needs acknowledgement', () => {
  const known = { address: KNOWN, chainId: ARC_TESTNET.chainId, level: 'known' }
  const fresh = { address: WALLET, chainId: ARC_TESTNET.chainId, level: 'new' }
  const contract = { address: CONTRACT, chainId: ARC_TESTNET.chainId, level: 'contract' }
  assert.equal(guardAllowsSend(known, ''), true)
  assert.equal(guardAllowsSend(fresh, ''), false)
  assert.equal(guardAllowsSend(fresh, `${ARC_TESTNET.chainId}:${WALLET}:new`), true)
  assert.equal(guardAllowsSend(contract, `${ARC_TESTNET.chainId}:${CONTRACT}:new`), false)
  assert.equal(guardAllowsSend(contract, `${ARC_TESTNET.chainId}:${CONTRACT}:contract`), true)
})

test('classifies the recipient from bytecode and ledger history', async () => {
  function provider(codeFor) {
    return {
      async request(payload) {
        if (payload.method === 'eth_chainId') return ARC_TESTNET.hexChainId
        if (payload.method === 'eth_getCode') {
          const who = String(payload.params[0]).toLowerCase()
          return codeFor(who)
        }
        throw new Error(payload.method)
      },
    }
  }
  const history = [{ to: KNOWN }]
  const known = await analyzeSendGuard({
    eip1193: provider(() => '0x'),
    recipient: KNOWN,
    history,
    expectedChainId: ARC_TESTNET.chainId,
  })
  assert.equal(known.level, 'known')
  assert.equal(known.contract, false)

  const fresh = await analyzeSendGuard({
    eip1193: provider(() => '0x'),
    recipient: WALLET,
    history,
    expectedChainId: ARC_TESTNET.chainId,
  })
  assert.equal(fresh.level, 'new')

  const contract = await analyzeSendGuard({
    eip1193: provider((who) => (who === CONTRACT ? '0x60016000' : '0x')),
    recipient: CONTRACT,
    history: [{ to: CONTRACT }],
    expectedChainId: ARC_TESTNET.chainId,
  })
  assert.equal(contract.level, 'contract')
  assert.equal(contract.known, true)
})

test('the batch payment screen shows Send Guard before the transfer', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
  assert.match(app, /Send Guard/)
  assert.match(app, /Acknowledge & Proceed/)
  assert.match(app, /analyzeSendGuard\(/)
  assert.match(app, /guardAllowsSend\(/)
  assert.match(app, /Send USDC/)
  assert.match(app, /Send EURC/)
})
