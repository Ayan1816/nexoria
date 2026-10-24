import {
  BrowserProvider,
  Contract,
  ContractFactory,
  Interface,
  keccak256,
  toUtf8Bytes,
} from 'ethers'
import { ERC20_ABI, MEMO_ABI, MULTICALL3_FROM_ABI } from './abi.js'
import { assertGasAndValue, bufferedGasLimit, referenceTransferFee, resolveMaxFeePerGas } from './arcGas.js'
import { MAX_BATCH, MAX_MEMO_BYTES, NATIVE_PER_ERC20_UNIT } from './constants.js'
import { sanitizeCustomToken } from './customTokens.js'
import { AppError } from './errors.js'
import { findOfficialToken, getArcNetwork } from './networks.js'
import { assertAddress } from './parse.js'
import artifact from '../contracts/FixedSupplyToken.json' with { type: 'json' }

const erc20Interface = new Interface(ERC20_ABI)
const multicallInterface = new Interface(MULTICALL3_FROM_ABI)
const memoInterface = new Interface(MEMO_ABI)
const SYMBOL = /^[A-Za-z][A-Za-z0-9]{0,31}$/

function asProvider(eip1193) {
  if (!eip1193?.request) throw new AppError('Connect a wallet before continuing.')
  return new BrowserProvider(eip1193)
}

async function requireArc(provider, expectedChainId) {
  const network = await provider.getNetwork()
  const chainId = Number(network.chainId)
  if (!Number.isSafeInteger(chainId)) throw new AppError('The wallet returned an invalid chain id.')
  if (expectedChainId != null && chainId !== expectedChainId) {
    throw new AppError('The wallet network changed. Review the payment and submit it again.')
  }
  const arc = getArcNetwork(chainId)
  if (!arc) throw new AppError('Switch to Arc before sending. Gas on Arc is USDC.')
  return { chainId, arc }
}

export async function readFeeCaps(provider) {
  if (typeof provider?.getFeeData !== 'function') {
    throw new AppError('This wallet cannot quote Arc gas. The payment was not sent.')
  }
  const [block, feeData] = await Promise.all([
    provider.getBlock('latest'),
    provider.getFeeData(),
  ])
  if (!block) throw new AppError('The Arc RPC did not return a block. The payment was not sent.')
  const maxFeePerGas = resolveMaxFeePerGas({
    baseFeePerGas: block.baseFeePerGas ?? null,
    gasPrice: quotedFee(feeData),
  })
  return {
    maxFeePerGas,
    maxPriorityFeePerGas: 0n,
    blockNumber: block.number,
    referenceFee: referenceTransferFee(maxFeePerGas),
  }
}

export async function readWalletSnapshot(eip1193, customTokens = []) {
  const provider = asProvider(eip1193)
  const signer = await provider.getSigner()
  const account = (await signer.getAddress()).toLowerCase()
  const chainId = Number((await provider.getNetwork()).chainId)
  const arc = getArcNetwork(chainId)
  if (!arc) return { account, chainId, network: null, balances: null, telemetry: null }

  const usdcToken = findOfficialToken(arc, 'usdc')
  const extras = extraTokens(arc, customTokens)
  const others = [...arc.tokens.filter((token) => token.id !== 'usdc'), ...extras]
  const usdc = new Contract(usdcToken.address, ERC20_ABI, provider)
  const [consistent, usdcDecimals, otherRows, fees] = await Promise.all([
    readConsistentUsdc(provider, account, usdcToken.address),
    usdc.decimals(),
    Promise.all(others.map((token) => readListedBalance(provider, account, token))),
    readFeeCaps(provider),
  ])
  if (Number(usdcDecimals) !== usdcToken.decimals) {
    throw new AppError('USDC did not report 6 decimals. Balances were not shown, so a payment cannot use the wrong scale.')
  }
  const tokens = [
    { ...usdcToken, balance: consistent.usdcBalance, error: '' },
    ...otherRows,
  ]
  const eurc = tokens.find((token) => token.id === 'eurc')
  return {
    account,
    chainId,
    network: arc,
    balances: {
      native: consistent.nativeBalance,
      usdc: consistent.usdcBalance,
      eurc: eurc?.balance ?? null,
      tokens,
    },
    telemetry: {
      blockNumber: fees.blockNumber,
      maxFeePerGas: fees.maxFeePerGas,
      referenceFee: fees.referenceFee,
    },
  }
}

export function encodePaymentCall(network, transfers) {
  const resolved = transfers.map((transfer) => ({
    ...transfer,
    token: paymentToken(network, transfer),
  }))
  if (resolved.length === 0) throw new AppError('No payments to send.')
  const tokenAddress = resolved[0].token.address
  if (resolved.some((transfer) => transfer.token.address.toLowerCase() !== tokenAddress.toLowerCase())) {
    throw new AppError('A batch uses one token.')
  }
  if (resolved.length === 1) {
    const transfer = resolved[0]
    return {
      to: transfer.token.address,
      data: erc20Interface.encodeFunctionData('transfer', [transfer.to, transfer.amount]),
    }
  }
  const calls = resolved.map((transfer) => ({
    target: transfer.token.address,
    allowFailure: false,
    callData: erc20Interface.encodeFunctionData('transfer', [transfer.to, transfer.amount]),
  }))
  return {
    to: network.contracts.multicall3From,
    data: multicallInterface.encodeFunctionData('aggregate3', [calls]),
  }
}

export async function sendTransfers({ eip1193, transfers, expectedChainId }) {
  const provider = asProvider(eip1193)
  const signer = await provider.getSigner()
  const account = (await signer.getAddress()).toLowerCase()
  const { chainId, arc } = await requireArc(provider, expectedChainId)
  const clean = normalizeTransfers(arc, transfers, account)
  await Promise.all([
    assertTokenDecimals(provider, clean),
    assertTransfersAllowed(provider, account, clean),
  ])

  const token = clean[0].token
  const { nativeBalance } = await readConsistentUsdc(provider, account, arc.contracts.usdc)
  const tokenBalance = token.gasToken
    ? 0n
    : await new Contract(token.address, ERC20_ABI, provider).balanceOf(account)

  const fees = await readFeeCaps(provider)
  const call = encodePaymentCall(arc, clean)
  const estimated = await provider.estimateGas({
    from: account,
    to: call.to,
    data: call.data,
    value: 0n,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: 0n,
  })
  const gasLimit = bufferedGasLimit(estimated)
  const feeNative = gasLimit * fees.maxFeePerGas
  assertGasAndValue({
    asset: token.gasToken ? 'usdc' : token.id,
    symbol: token.symbol,
    decimals: token.decimals,
    gasToken: token.gasToken,
    amount: clean.reduce((total, transfer) => total + transfer.amount, 0n),
    tokenBalance,
    nativeBalance,
    feeNative,
  })

  await assertSameAccount(signer, account)
  const response = await signer.sendTransaction({
    to: call.to,
    data: call.data,
    value: 0n,
    gasLimit,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: 0n,
  })
  const receipt = await waitForReceipt(response, chainId)
  return {
    hash: receipt.hash,
    chainId,
    feeNative,
    transfers: clean.map((transfer) => ({
      asset: transfer.asset,
      symbol: transfer.token.symbol,
      decimals: transfer.token.decimals,
      token: transfer.token.address,
      to: transfer.to,
      amount: transfer.amount.toString(),
    })),
  }
}

export async function sendMemo({ eip1193, recipient, message, expectedChainId }) {
  const provider = asProvider(eip1193)
  const signer = await provider.getSigner()
  const account = (await signer.getAddress()).toLowerCase()
  const { chainId, arc } = await requireArc(provider, expectedChainId)
  const to = assertAddress(recipient, 'Recipient')
  if (to === account) throw new AppError('Recipient is the connected wallet.')
  let memoData
  try {
    memoData = toUtf8Bytes(message)
  } catch (error) {
    throw new AppError('Message is not valid text.', { cause: error })
  }
  if (memoData.length === 0 || memoData.length > MAX_MEMO_BYTES) {
    throw new AppError(`Message must be 1 to ${MAX_MEMO_BYTES} bytes.`)
  }
  const usdc = paymentToken(arc, { asset: 'usdc' })
  await Promise.all([
    assertTokenDecimals(provider, [{ token: usdc }]),
    assertNotBlocked(provider, usdc, account, [to]),
  ])
  const callData = erc20Interface.encodeFunctionData('transfer', [to, 0n])
  const nonce = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${account}`
  const memoId = keccak256(toUtf8Bytes(`${account}:${Date.now()}:${nonce}`))
  const data = memoInterface.encodeFunctionData('memo', [arc.contracts.usdc, callData, memoId, memoData])
  const fees = await readFeeCaps(provider)
  const { nativeBalance } = await readConsistentUsdc(provider, account, arc.contracts.usdc)
  const estimated = await provider.estimateGas({
    from: account,
    to: arc.contracts.memo,
    data,
    value: 0n,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: 0n,
  })
  const gasLimit = bufferedGasLimit(estimated)
  const feeNative = gasLimit * fees.maxFeePerGas
  assertGasAndValue({ asset: 'usdc', amount: 0n, tokenBalance: 0n, nativeBalance, feeNative })
  await assertSameAccount(signer, account)
  const response = await signer.sendTransaction({
    to: arc.contracts.memo,
    data,
    value: 0n,
    gasLimit,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: 0n,
  })
  const receipt = await waitForReceipt(response, chainId)
  return { hash: receipt.hash, chainId, feeNative }
}

export async function readAllowance({ eip1193, asset, token, spender, expectedChainId }) {
  const provider = asProvider(eip1193)
  const account = (await (await provider.getSigner()).getAddress()).toLowerCase()
  const { arc } = await requireArc(provider, expectedChainId)
  const described = paymentToken(arc, { asset, token })
  const spenderAddress = assertAddress(spender, 'Spender')
  const contract = new Contract(described.address, ERC20_ABI, provider)
  const decimals = await contract.decimals()
  if (Number(decimals) !== described.decimals) {
    throw new AppError(`${described.symbol} reported ${Number(decimals)} decimals, not ${described.decimals}. The allowance was not read.`)
  }
  const value = await contract.allowance(account, spenderAddress)
  return { value, spender: spenderAddress, asset: described.id, symbol: described.symbol, decimals: described.decimals }
}

export async function revokeAllowance({ eip1193, asset, token, spender, expectedChainId }) {
  const provider = asProvider(eip1193)
  const signer = await provider.getSigner()
  const account = (await signer.getAddress()).toLowerCase()
  const { chainId, arc } = await requireArc(provider, expectedChainId)
  const described = paymentToken(arc, { asset, token })
  const spenderAddress = assertAddress(spender, 'Spender')
  const contract = new Contract(described.address, ERC20_ABI, signer)
  await assertNotBlocked(provider, described, account, [])
  const current = await contract.allowance(account, spenderAddress)
  if (current === 0n) throw new AppError('Allowance is already zero.')
  const fees = await readFeeCaps(provider)
  const data = erc20Interface.encodeFunctionData('approve', [spenderAddress, 0n])
  const { nativeBalance } = await readConsistentUsdc(provider, account, arc.contracts.usdc)
  const estimated = await provider.estimateGas({
    from: account,
    to: described.address,
    data,
    value: 0n,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: 0n,
  })
  const gasLimit = bufferedGasLimit(estimated)
  assertGasAndValue({
    asset: 'usdc',
    amount: 0n,
    tokenBalance: 0n,
    nativeBalance,
    feeNative: gasLimit * fees.maxFeePerGas,
  })
  await assertSameAccount(signer, account)
  const response = await signer.sendTransaction({
    to: described.address,
    data,
    value: 0n,
    gasLimit,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: 0n,
  })
  const receipt = await waitForReceipt(response, chainId)
  return { hash: receipt.hash, chainId }
}

export function tokenBytecode() {
  const bytecode = artifact.bytecode
  if (typeof bytecode !== 'string' || !bytecode.startsWith('0x') || bytecode.length < 10) {
    throw new AppError('Token bytecode is not in the build artifact. Run node contracts/compile.mjs, then deploy again.')
  }
  return bytecode
}

export function tokenDeployReady() {
  try {
    tokenBytecode()
    return true
  } catch {
    return false
  }
}

export async function deployFixedSupplyToken({ eip1193, name, symbol, wholeSupply, expectedChainId }) {
  const provider = asProvider(eip1193)
  const signer = await provider.getSigner()
  const account = (await signer.getAddress()).toLowerCase()
  const { chainId, arc } = await requireArc(provider, expectedChainId)
  const bytecode = tokenBytecode()
  const factory = new ContractFactory(artifact.abi, bytecode, signer)
  const deployment = await factory.getDeployTransaction(name, symbol, wholeSupply, account)
  if (typeof deployment?.data !== 'string' || !deployment.data.startsWith('0x') || deployment.data.length < 10) {
    throw new AppError('The token deployment transaction could not be built.')
  }
  const fees = await readFeeCaps(provider)
  const { nativeBalance } = await readConsistentUsdc(provider, account, arc.contracts.usdc)
  const estimated = await provider.estimateGas({
    from: account,
    data: deployment.data,
    value: 0n,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: 0n,
  })
  const gasLimit = bufferedGasLimit(estimated)
  assertGasAndValue({
    asset: 'usdc',
    amount: 0n,
    tokenBalance: 0n,
    nativeBalance,
    feeNative: gasLimit * fees.maxFeePerGas,
  })
  await assertSameAccount(signer, account)
  const response = await signer.sendTransaction({
    data: deployment.data,
    value: 0n,
    gasLimit,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: 0n,
  })
  const receipt = await waitForReceipt(response, chainId)
  if (!receipt.contractAddress) {
    throw new AppError(`Token deployment finished without a contract address. Hash ${receipt.hash}.`, {
      hash: receipt.hash,
      chainId,
    })
  }
  const code = await provider.getCode(receipt.contractAddress)
  if (!code || code === '0x') throw new AppError('Deployment finished without contract code.')
  return { hash: receipt.hash, chainId, address: receipt.contractAddress.toLowerCase() }
}

function quotedFee(feeData) {
  const values = [feeData?.gasPrice, feeData?.maxFeePerGas]
  let price = 0n
  for (const value of values) {
    if (typeof value === 'bigint' && value > price) price = value
  }
  return price
}

export function paymentToken(network, transfer) {
  const hinted = transfer?.token
  if (hinted && typeof hinted === 'object' && hinted.address) {
    const official = findOfficialToken(network, hinted.address)
    if (official) {
      if (hinted.decimals != null && Number(hinted.decimals) !== official.decimals) {
        throw new AppError(`${official.symbol} decimals do not match the Arc token list.`)
      }
      return official
    }
    const address = assertAddress(hinted.address, 'Token')
    const decimals = Number(hinted.decimals)
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
      throw new AppError('Token decimals are not supported.')
    }
    const symbol = String(hinted.symbol ?? '').trim()
    if (!SYMBOL.test(symbol)) throw new AppError('Token symbol is missing.')
    const name = String(hinted.name ?? symbol).trim().slice(0, 64) || symbol
    return {
      id: `custom:${address}`,
      symbol,
      name,
      address,
      decimals,
      isOfficial: false,
      gasToken: false,
    }
  }
  const official = findOfficialToken(network, transfer?.asset ?? transfer?.id)
  if (!official) throw new AppError('Unsupported asset.')
  return official
}

function normalizeTransfers(network, transfers, account) {
  if (!Array.isArray(transfers) || transfers.length === 0) throw new AppError('No payments to send.')
  if (transfers.length > MAX_BATCH) throw new AppError(`A batch can include at most ${MAX_BATCH} payments.`)
  const seen = new Set()
  const clean = transfers.map((transfer) => {
    const token = paymentToken(network, transfer)
    if (typeof transfer.amount !== 'bigint' || transfer.amount <= 0n) {
      throw new AppError('Amount must be greater than zero.')
    }
    const to = assertAddress(transfer.to, 'Recipient')
    if (to === account) throw new AppError('Recipient is the connected wallet.')
    const key = `${token.address}:${to}`
    if (seen.has(key)) throw new AppError('The batch pays the same address twice for one asset.')
    seen.add(key)
    return { asset: token.id, to, amount: transfer.amount, token }
  })
  const tokenAddress = clean[0].token.address.toLowerCase()
  if (clean.some((transfer) => transfer.token.address.toLowerCase() !== tokenAddress)) {
    throw new AppError('A batch uses one token.')
  }
  return clean
}

async function waitForReceipt(response, chainId) {
  const hash = typeof response?.hash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(response.hash)
    ? response.hash
    : undefined
  let receipt
  try {
    receipt = await response.wait(1)
  } catch (error) {
    throw new AppError(
      hash
        ? `The transaction was submitted, but the receipt did not confirm. Hash ${hash}.`
        : 'The transaction was submitted, but the receipt did not confirm.',
      { code: 'RECEIPT', hash, chainId, cause: error },
    )
  }
  if (!receipt || Number(receipt.status) !== 1) {
    const settled = hash ?? (typeof receipt?.hash === 'string' ? receipt.hash : undefined)
    throw new AppError(
      settled ? `The transaction reverted. Hash ${settled}.` : 'The transaction reverted.',
      { code: 'REVERTED', hash: settled, chainId },
    )
  }
  return receipt
}

async function assertNotBlocked(provider, token, account, recipients) {
  const contract = new Contract(token.address, ERC20_ABI, provider)
  const targets = [account, ...recipients]
  await Promise.all(targets.map(async (target, index) => {
    let flagged
    try {
      flagged = await contract.isBlacklisted(target)
    } catch {
      // USYC, WETH, and ordinary ERC-20s do not expose this view. A missing view must not block the send.
      return
    }
    if (flagged) {
      const who = index === 0 ? 'The connected wallet' : `Recipient ${target}`
      throw new AppError(`${who} is on the ${token.symbol} blocklist. The payment was not sent.`, { code: 'BLOCKLIST' })
    }
  }))
}

async function assertTransfersAllowed(provider, account, transfers) {
  const token = transfers[0]?.token
  if (!token) return
  await assertNotBlocked(provider, token, account, transfers.map((transfer) => transfer.to))
}

async function assertTokenDecimals(provider, transfers) {
  const tokens = []
  const seen = new Set()
  for (const transfer of transfers) {
    const token = transfer.token
    const key = token.address.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tokens.push(token)
  }
  await Promise.all(tokens.map(async (token) => {
    const decimals = await new Contract(token.address, ERC20_ABI, provider).decimals()
    if (Number(decimals) !== token.decimals) {
      throw new AppError(`${token.symbol} reported ${Number(decimals)} decimals, not ${token.decimals}. The payment was not sent.`)
    }
  }))
}

async function readConsistentUsdc(provider, account, usdcAddress) {
  const usdc = new Contract(usdcAddress, ERC20_ABI, provider)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const nativeBalance = await provider.getBalance(account)
    const usdcBalance = await usdc.balanceOf(account)
    if (typeof nativeBalance !== 'bigint' || typeof usdcBalance !== 'bigint') {
      throw new AppError('USDC balance could not be read. The payment was not sent.')
    }
    if (usdcBalance === nativeBalance / NATIVE_PER_ERC20_UNIT) {
      return { nativeBalance, usdcBalance }
    }
  }
  throw new AppError('The USDC contract balance does not match the native balance. The payment was not sent.')
}

async function readListedBalance(provider, account, token) {
  try {
    const contract = new Contract(token.address, ERC20_ABI, provider)
    const [decimals, balance] = await Promise.all([
      contract.decimals(),
      contract.balanceOf(account),
    ])
    if (Number(decimals) !== token.decimals || typeof balance !== 'bigint') {
      return { ...token, balance: null, error: 'scale' }
    }
    return { ...token, balance, error: '' }
  } catch (error) {
    console.error(error)
    return { ...token, balance: null, error: 'read' }
  }
}

function extraTokens(network, customTokens) {
  const rows = []
  const seen = new Set(network.tokens.map((token) => token.address.toLowerCase()))
  for (const row of Array.isArray(customTokens) ? customTokens : []) {
    const clean = sanitizeCustomToken(row, network)
    if (!clean || seen.has(clean.address)) continue
    seen.add(clean.address)
    rows.push(clean)
  }
  return rows
}

async function assertSameAccount(signer, account) {
  const current = (await signer.getAddress()).toLowerCase()
  if (current !== account) {
    throw new AppError('The wallet account changed. Review the payment and submit it again.')
  }
}
