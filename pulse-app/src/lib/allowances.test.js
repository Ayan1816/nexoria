import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Interface, getAddress } from 'ethers'
import { ERC20_ABI } from './abi.js'
import {
  APPROVAL_TOPIC,
  MAX_APPROVAL_LOGS,
  activeAllowanceRows,
  addressFromTopic,
  approvalLogsUrl,
  fetchApprovalLogs,
  listActiveAllowances,
  logsFromExplorerPayload,
  spendersFromApprovalLogs,
} from './allowances.js'
import { ARC_MAINNET, ARC_TESTNET } from './networks.js'

const OWNER = '0x1111111111111111111111111111111111111111'
const SPENDER = '0x2222222222222222222222222222222222222222'
const QUIET = '0x3333333333333333333333333333333333333333'
const USDC = ARC_TESTNET.contracts.usdc
const iface = new Interface(ERC20_ABI)

function pad(address) {
  return `0x${address.slice(2).toLowerCase().padStart(64, '0')}`
}

function approval(owner, spender, token = USDC) {
  return {
    address: token,
    topics: [APPROVAL_TOPIC, pad(owner), pad(spender)],
  }
}

test('reads a padded spender out of an Approval topic', () => {
  assert.equal(addressFromTopic(pad(SPENDER)), getAddress(SPENDER))
  assert.equal(addressFromTopic(`0x${'11'.repeat(32)}`), null)
  assert.equal(addressFromTopic(pad('0x0000000000000000000000000000000000000000')), null)
  assert.equal(addressFromTopic('0x1234'), null)
})

test('keeps unique spenders from this owner and this token', () => {
  const logs = [
    approval(OWNER, SPENDER),
    approval(OWNER, SPENDER),
    approval(OWNER, QUIET),
    approval(OWNER, OWNER),
    approval(OWNER, '0x0000000000000000000000000000000000000000'),
    approval('0x4444444444444444444444444444444444444444', SPENDER),
    approval(OWNER, SPENDER, ARC_TESTNET.contracts.eurc),
    { address: USDC, topics: ['0x' + 'ab'.repeat(32), pad(OWNER), pad(SPENDER)] },
    { address: USDC, topics: [APPROVAL_TOPIC, pad(OWNER)] },
    { topics: 'nope' },
  ]
  assert.deepEqual(spendersFromApprovalLogs(logs, OWNER, USDC), [getAddress(SPENDER), getAddress(QUIET)])
})

test('builds the Arc Testnet explorer approval query', () => {
  const url = new URL(approvalLogsUrl(ARC_TESTNET.explorer, USDC, OWNER))
  assert.equal(url.origin, 'https://explorer.testnet.arc.io')
  assert.equal(url.pathname, '/api')
  assert.equal(url.searchParams.get('module'), 'logs')
  assert.equal(url.searchParams.get('action'), 'getLogs')
  assert.equal(url.searchParams.get('fromBlock'), '0')
  assert.equal(url.searchParams.get('toBlock'), 'latest')
  assert.equal(url.searchParams.get('address'), getAddress(USDC).toLowerCase())
  assert.equal(url.searchParams.get('topic0'), APPROVAL_TOPIC)
  assert.equal(url.searchParams.get('topic0_1_opr'), 'and')
  assert.equal(url.searchParams.get('topic1'), pad(OWNER))
  assert.throws(() => approvalLogsUrl(ARC_MAINNET.explorer, USDC, OWNER), /Arc Testnet/)
})

test('accepts an empty explorer log page and rejects an error payload', () => {
  assert.deepEqual(logsFromExplorerPayload({ status: '0', message: 'No records found', result: [] }), [])
  assert.deepEqual(logsFromExplorerPayload({ status: '0', message: 'No records found', result: null }), [])
  assert.throws(
    () => logsFromExplorerPayload({ status: '0', message: 'NOTOK', result: 'Error! Missing or invalid parameter' }),
    /did not return approval logs/,
  )
})

test('drops spent allowances and keeps a still-positive approval', () => {
  const rows = activeAllowanceRows('usdc', [getAddress(SPENDER), getAddress(QUIET)], [1_500_000n, 0n])
  assert.deepEqual(rows, [{ asset: 'usdc', spender: getAddress(SPENDER), value: 1_500_000n }])
  assert.equal(activeAllowanceRows('eurc', [getAddress(SPENDER)], [2n ** 256n - 1n])[0].value, 2n ** 256n - 1n)
})

test('stops when the explorer result is too large to treat as complete', async () => {
  const logs = Array.from({ length: MAX_APPROVAL_LOGS }, () => approval(OWNER, SPENDER))
  await assert.rejects(
    fetchApprovalLogs({
      explorer: ARC_TESTNET.explorer,
      token: USDC,
      owner: OWNER,
      fetchImpl: async () => ({ ok: true, json: async () => ({ status: '1', message: 'OK', result: logs }) }),
    }),
    /too many approval events/,
  )
})

test('lists only live testnet allowances and does not query another chain', async () => {
  const calls = []
  const eip1193 = {
    async request(payload) {
      calls.push(payload.method)
      if (payload.method === 'eth_chainId') return '0x4cef52'
      if (payload.method === 'eth_accounts' || payload.method === 'eth_requestAccounts') return [OWNER]
      if (payload.method === 'eth_call') {
        const tx = payload.params[0]
        const parsed = iface.parseTransaction({ data: tx.data })
        if (parsed.name === 'decimals') return `0x${(6).toString(16).padStart(64, '0')}`
        if (parsed.name === 'allowance') {
          const spender = getAddress(parsed.args[1])
          const positive = tx.to.toLowerCase() === USDC.toLowerCase() && spender === getAddress(SPENDER)
          const value = positive ? 1_500_000n : 0n
          return `0x${value.toString(16).padStart(64, '0')}`
        }
      }
      throw new Error(`unexpected ${payload.method}`)
    },
  }
  let fetched = 0
  const rows = await listActiveAllowances({
    eip1193,
    expectedChainId: ARC_TESTNET.chainId,
    fetchImpl: async (url) => {
      fetched += 1
      const token = new URL(url).searchParams.get('address')
      const result = token === USDC.toLowerCase() ? [approval(OWNER, SPENDER), approval(OWNER, QUIET)] : []
      return { ok: true, json: async () => ({ status: '1', message: 'OK', result }) }
    },
  })
  assert.deepEqual(rows, [{ asset: 'usdc', spender: getAddress(SPENDER), value: 1_500_000n }])
  assert.equal(fetched, 2)
  assert.equal(calls.includes('eth_call'), true)

  let mainnetFetches = 0
  await assert.rejects(
    listActiveAllowances({
      eip1193: {
        async request(payload) {
          if (payload.method === 'eth_chainId') return '0x13b2'
          if (payload.method === 'eth_accounts' || payload.method === 'eth_requestAccounts') return [OWNER]
          throw new Error(`unexpected ${payload.method}`)
        },
      },
      expectedChainId: ARC_MAINNET.chainId,
      fetchImpl: async () => {
        mainnetFetches += 1
        return { ok: true, json: async () => ({ result: [] }) }
      },
    }),
    /Arc Testnet/,
  )
  assert.equal(mainnetFetches, 0)
})

test('the dashboard revokes by approving zero', () => {
  const payments = readFileSync(new URL('./payments.js', import.meta.url), 'utf8')
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
  assert.match(payments, /encodeFunctionData\('approve', \[spenderAddress, 0n\]\)/)
  assert.match(app, /revokeAllowance\(/)
  assert.match(app, /listActiveAllowances\(/)
  assert.equal(app.includes('Read allowance'), false)
})
