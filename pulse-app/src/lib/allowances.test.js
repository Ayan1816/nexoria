import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Interface, getAddress } from 'ethers'
import { ERC20_ABI } from './abi.js'
import {
  APPROVAL_TOPIC,
  MAX_APPROVAL_LOGS,
  RPC_LOG_SPAN,
  activeAllowanceRows,
  addressFromTopic,
  approvalLogsUrl,
  discoverApprovalLogs,
  fetchApprovalLogs,
  listActiveAllowances,
  logsFromBlockscoutPayload,
  logsFromExplorerPayload,
  recentLogRange,
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

test('builds the official Arc explorer approval query on mainnet and testnet', () => {
  for (const network of [ARC_MAINNET, ARC_TESTNET]) {
    const url = new URL(approvalLogsUrl(network.explorer, network.contracts.usdc, OWNER))
    assert.equal(url.origin, network.explorer)
    assert.equal(url.pathname, '/api')
    assert.equal(url.searchParams.get('module'), 'logs')
    assert.equal(url.searchParams.get('action'), 'getLogs')
    assert.equal(url.searchParams.get('fromBlock'), '0')
    assert.equal(url.searchParams.get('toBlock'), 'latest')
    assert.equal(url.searchParams.get('address'), getAddress(network.contracts.usdc).toLowerCase())
    assert.equal(url.searchParams.get('topic0'), APPROVAL_TOPIC)
    assert.equal(url.searchParams.get('topic0_1_opr'), 'and')
    assert.equal(url.searchParams.get('topic1'), pad(OWNER))
    assert.equal(url.searchParams.get('page'), '1')
    assert.equal(url.searchParams.get('offset'), String(MAX_APPROVAL_LOGS))
  }
  assert.throws(() => approvalLogsUrl('https://rpc.testnet.arc.network', USDC, OWNER), /official Arc explorer/)
  assert.throws(() => approvalLogsUrl('https://example.invalid', USDC, OWNER), /official Arc explorer/)
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

async function listOn(network) {
  const calls = []
  const fetched = []
  const usdc = network.contracts.usdc
  const eip1193 = {
    async request(payload) {
      calls.push(payload.method)
      if (payload.method === 'eth_chainId') return network.hexChainId
      if (payload.method === 'eth_accounts' || payload.method === 'eth_requestAccounts') return [OWNER]
      if (payload.method === 'eth_call') {
        const tx = payload.params[0]
        const parsed = iface.parseTransaction({ data: tx.data })
        if (parsed.name === 'decimals') {
          const match = network.tokens.find((token) => token.address.toLowerCase() === tx.to.toLowerCase())
          const decimals = match?.decimals ?? 6
          return `0x${decimals.toString(16).padStart(64, '0')}`
        }
        if (parsed.name === 'allowance') {
          const spender = getAddress(parsed.args[1])
          const positive = tx.to.toLowerCase() === usdc.toLowerCase() && spender === getAddress(SPENDER)
          const value = positive ? 1_500_000n : 0n
          return `0x${value.toString(16).padStart(64, '0')}`
        }
      }
      throw new Error(`unexpected ${payload.method}`)
    },
  }
  const rows = await listActiveAllowances({
    eip1193,
    expectedChainId: network.chainId,
    fetchImpl: async (url) => {
      const parsed = new URL(url)
      fetched.push(parsed.origin)
      const token = parsed.searchParams.get('address')
      const result = token === usdc.toLowerCase() ? [approval(OWNER, SPENDER, usdc), approval(OWNER, QUIET, usdc)] : []
      return { ok: true, json: async () => ({ status: '1', message: 'OK', result }) }
    },
  })
  return { rows, calls, fetched }
}

test('lists live allowances from the official explorer on Arc mainnet and Arc Testnet', async () => {
  for (const network of [ARC_MAINNET, ARC_TESTNET]) {
    const { rows, calls, fetched } = await listOn(network)
    assert.equal(rows.partial, false)
    assert.deepEqual(rows.rows, [{
      asset: 'usdc',
      spender: getAddress(SPENDER),
      value: 1_500_000n,
      symbol: 'USDC',
      decimals: 6,
      token: network.contracts.usdc,
    }])
    assert.deepEqual(fetched, Array(network.tokens.length).fill(network.explorer))
    assert.equal(calls.includes('eth_call'), true)
  }
})

test('does not query an explorer when the wallet is not on Arc', async () => {
  let fetches = 0
  await assert.rejects(
    listActiveAllowances({
      eip1193: {
        async request(payload) {
          if (payload.method === 'eth_chainId') return '0x1'
          if (payload.method === 'eth_accounts' || payload.method === 'eth_requestAccounts') return [OWNER]
          throw new Error(`unexpected ${payload.method}`)
        },
      },
      expectedChainId: 1,
      fetchImpl: async () => {
        fetches += 1
        return { ok: true, json: async () => ({ result: [] }) }
      },
    }),
    /Switch to Arc/,
  )
  assert.equal(fetches, 0)
})

test('keeps a 9,999 block eth_getLogs window', () => {
  assert.deepEqual(recentLogRange(20_000n), { fromBlock: 20_000n - RPC_LOG_SPAN + 1n, toBlock: 20_000n })
  assert.equal(recentLogRange(20_000n).toBlock - recentLogRange(20_000n).fromBlock, 9_998n)
  assert.deepEqual(recentLogRange(10n), { fromBlock: 0n, toBlock: 10n })
})

test('reads Blockscout v2 items when the etherscan API is challenged', async () => {
  const calls = []
  const found = await discoverApprovalLogs({
    explorer: ARC_TESTNET.explorer,
    token: USDC,
    owner: OWNER,
    fetchImpl: async (url) => {
      calls.push(url)
      if (url.includes('/api/v2/')) {
        return {
          ok: true,
          json: async () => ({
            items: [{
              address: { hash: USDC },
              topics: [APPROVAL_TOPIC, pad(OWNER), pad(SPENDER)],
              data: '0x',
            }],
            next_page_params: null,
          }),
        }
      }
      return { ok: false, status: 403, json: async () => { throw new Error('cloudflare') } }
    },
  })
  assert.equal(found.source, 'blockscout')
  assert.equal(found.partial, false)
  assert.deepEqual(spendersFromApprovalLogs(found.logs, OWNER, USDC), [getAddress(SPENDER)])
  assert.equal(calls.some((url) => url.includes('/api/v2/addresses/')), true)
})

test('falls back to recent RPC logs when both explorer APIs fail', async () => {
  const found = await discoverApprovalLogs({
    explorer: ARC_MAINNET.explorer,
    token: USDC,
    owner: OWNER,
    fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({}) }),
    provider: {
      async getBlock() { return { number: 50_000 } },
      async getLogs(filter) {
        assert.equal(filter.toBlock - filter.fromBlock, Number(RPC_LOG_SPAN) - 1)
        assert.equal(filter.topics[0], APPROVAL_TOPIC)
        return [approval(OWNER, SPENDER)]
      },
    },
  })
  assert.equal(found.source, 'rpc')
  assert.equal(found.partial, true)
  assert.equal(found.logs.length, 1)
})

test('rejects a Blockscout payload that is not a log page', () => {
  assert.throws(() => logsFromBlockscoutPayload({ message: 'challenge' }), /did not return approval logs/)
  assert.equal(logsFromBlockscoutPayload({ items: [], next_page_params: null }).length, 0)
})

test('the dashboard revokes by approving zero', () => {
  const payments = readFileSync(new URL('./payments.js', import.meta.url), 'utf8')
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
  assert.match(payments, /encodeFunctionData\('approve', \[spenderAddress, 0n\]\)/)
  assert.match(app, /revokeAllowance\(/)
  assert.match(app, /listActiveAllowances\(/)
  assert.equal(app.includes('Read allowance'), false)
})
