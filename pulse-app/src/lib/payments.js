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
import { MAX_BATCH, MAX_MEMO_BYTES, NATIVE_PER_ERC20_UNIT, USDC_ERC20_DECIMALS } from './constants.js'
import { AppError } from './errors.js'
import { getArcNetwork, tokenAddress } from './networks.js'
import { assertAddress } from './parse.js'
import artifact from '../contracts/FixedSupplyToken.json' with { type: 'json' }

const erc20Interface = new Interface(ERC20_ABI)
const multicallInterface = new Interface(MULTICALL3_FROM_ABI)
const memoInterface = new Interface(MEMO_ABI)

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

export async function readWalletSnapshot(eip1193) {
  const provider = asProvider(eip1193)
  const signer = await provider.getSigner()
  const account = (await signer.getAddress()).toLowerCase()
  const chainId = Number((await provider.getNetwork()).chainId)
  const arc = getArcNetwork(chainId)
  if (!arc) return { account, chainId, network: null, balances: null, telemetry: null }

  const usdc = new Contract(arc.contracts.usdc, ERC20_ABI, provider)
  const eurc = new Contract(arc.contracts.eurc, ERC20_ABI, provider)
  const [consistent, usdcDecimals, eurcBalance, eurcDecimals, fees] = await Promise.all([
    readConsistentUsdc(provider, account, arc.contracts.usdc),
    usdc.decimals(),
    eurc.balanceOf(account),
    eurc.decimals(),
    readFeeCaps(provider),
  ])
  if (Number(usdcDecimals) !== USDC_ERC20_DECIMALS || Number(eurcDecimals) !== USDC_ERC20_DECIMALS) {
    throw new AppError('USDC or EURC did not report 6 decimals. Balances were not shown, so a payment cannot use the wrong scale.')
  }
  return {
    account,
    chainId,
    network: arc,
    balances: { native: consistent.nativeBalance, usdc: consistent.usdcBalance, eurc: eurcBalance },
    telemetry: {
      blockNumber: fees.blockNumber,
      maxFeePerGas: fees.maxFeePerGas,
      referenceFee: fees.referenceFee,
    },
  }
}

export function encodePaymentCall(network, transfers) {
  if (transfers.length === 1) {
    const transfer = transfers[0]
    return {
      to: tokenAddress(network, transfer.asset),
      data: erc20Interface.encodeFunctionData('transfer', [transfer.to, transfer.amount]),
    }
  }
  const calls = transfers.map((transfer) => ({
    target: tokenAddress(network, transfer.asset),
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
  const clean = normalizeTransfers(transfers, account)
  await Promise.all([
    assertTokenDecimals(provider, arc, clean),
    assertTransfersAllowed(provider, arc, account, clean),
  ])

  const { nativeBalance } = await readConsistentUsdc(provider, account, arc.contracts.usdc)
  const eurcNeeded = clean.some((transfer) => transfer.asset === 'eurc')
  const eurcBalance = eurcNeeded
    ? await new Contract(arc.contracts.eurc, ERC20_ABI, provider).balanceOf(account)
    : 0n

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
  const usdcAmount = sumAsset(clean, 'usdc')
  const eurcAmount = sumAsset(clean, 'eurc')
  assertGasAndValue({
    asset: 'usdc',
    amount: usdcAmount,
    tokenBalance: 0n,
    nativeBalance,
    feeNative,
  })
  if (eurcAmount > 0n) {
    assertGasAndValue({
      asset: 'eurc',
      amount: eurcAmount,
      tokenBalance: eurcBalance,
      nativeBalance,
      feeNative,
    })
  }

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
  await Promise.all([
    assertTokenDecimals(provider, arc, [{ asset: 'usdc' }]),
    assertNotBlocked(provider, arc, account, 'usdc', [to]),
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

export async function readAllowance({ eip1193, asset, spender, expectedChainId }) {
  const provider = asProvider(eip1193)
  const account = (await (await provider.getSigner()).getAddress()).toLowerCase()
  const { arc } = await requireArc(provider, expectedChainId)
  if (asset !== 'usdc' && asset !== 'eurc') throw new AppError('Unsupported asset.')
  const spenderAddress = assertAddress(spender, 'Spender')
  const token = new Contract(tokenAddress(arc, asset), ERC20_ABI, provider)
  const decimals = await token.decimals()
  if (Number(decimals) !== USDC_ERC20_DECIMALS) {
    throw new AppError('Token decimals are not 6. The allowance was not read.')
  }
  const value = await token.allowance(account, spenderAddress)
  return { value, spender: spenderAddress }
}

export async function revokeAllowance({ eip1193, asset, spender, expectedChainId }) {
  const provider = asProvider(eip1193)
  const signer = await provider.getSigner()
  const account = (await signer.getAddress()).toLowerCase()
  const { chainId, arc } = await requireArc(provider, expectedChainId)
  if (asset !== 'usdc' && asset !== 'eurc') throw new AppError('Unsupported asset.')
  const spenderAddress = assertAddress(spender, 'Spender')
  const token = new Contract(tokenAddress(arc, asset), ERC20_ABI, signer)
  await assertNotBlocked(provider, arc, account, asset, [])
  const current = await token.allowance(account, spenderAddress)
  if (current === 0n) throw new AppError('Allowance is already zero.')
  const fees = await readFeeCaps(provider)
  const data = erc20Interface.encodeFunctionData('approve', [spenderAddress, 0n])
  const { nativeBalance } = await readConsistentUsdc(provider, account, arc.contracts.usdc)
  const estimated = await provider.estimateGas({
    from: account,
    to: tokenAddress(arc, asset),
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
    to: tokenAddress(arc, asset),
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

function normalizeTransfers(transfers, account) {
  if (!Array.isArray(transfers) || transfers.length === 0) throw new AppError('No payments to send.')
  if (transfers.length > MAX_BATCH) throw new AppError(`A batch can include at most ${MAX_BATCH} payments.`)
  const seen = new Set()
  return transfers.map((transfer) => {
    if (transfer.asset !== 'usdc' && transfer.asset !== 'eurc') throw new AppError('Unsupported asset.')
    if (typeof transfer.amount !== 'bigint' || transfer.amount <= 0n) {
      throw new AppError('Amount must be greater than zero.')
    }
    const to = assertAddress(transfer.to, 'Recipient')
    if (to === account) throw new AppError('Recipient is the connected wallet.')
    const key = `${transfer.asset}:${to}`
    if (seen.has(key)) throw new AppError('The batch pays the same address twice for one asset.')
    seen.add(key)
    return { asset: transfer.asset, to, amount: transfer.amount }
  })
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

async function assertNotBlocked(provider, network, account, asset, recipients) {
  const token = new Contract(tokenAddress(network, asset), ERC20_ABI, provider)
  const targets = [account, ...recipients]
  await Promise.all(targets.map(async (target, index) => {
    let flagged
    try {
      flagged = await token.isBlacklisted(target)
    } catch {
      // A token that does not expose this view still reverts inside estimateGas.
      return
    }
    if (flagged) {
      const who = index === 0 ? 'The connected wallet' : `Recipient ${target}`
      throw new AppError(`${who} is on the ${asset.toUpperCase()} blocklist. The payment was not sent.`, { code: 'BLOCKLIST' })
    }
  }))
}

async function assertTransfersAllowed(provider, network, account, transfers) {
  const byAsset = new Map()
  for (const transfer of transfers) {
    const list = byAsset.get(transfer.asset) ?? []
    list.push(transfer.to)
    byAsset.set(transfer.asset, list)
  }
  await Promise.all([...byAsset].map(([asset, recipients]) => (
    assertNotBlocked(provider, network, account, asset, recipients)
  )))
}

async function assertTokenDecimals(provider, network, transfers) {
  const assets = [...new Set(transfers.map((transfer) => transfer.asset))]
  await Promise.all(assets.map(async (asset) => {
    const decimals = await new Contract(tokenAddress(network, asset), ERC20_ABI, provider).decimals()
    if (Number(decimals) !== USDC_ERC20_DECIMALS) {
      throw new AppError(`${asset.toUpperCase()} did not report 6 decimals. The payment was not sent.`)
    }
  }))
}

function sumAsset(transfers, asset) {
  return transfers.reduce((total, transfer) => (transfer.asset === asset ? total + transfer.amount : total), 0n)
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

async function assertSameAccount(signer, account) {
  const current = (await signer.getAddress()).toLowerCase()
  if (current !== account) {
    throw new AppError('The wallet account changed. Review the payment and submit it again.')
  }
}
