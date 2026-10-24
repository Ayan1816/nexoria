import { formatToken } from './amounts.js'
import {
  BLOCK_GAS_LIMIT,
  MIN_MAX_FEE_PER_GAS,
  MAX_MAX_FEE_PER_GAS,
  NATIVE_PER_ERC20_UNIT,
  REFERENCE_ERC20_GAS,
  USDC_NATIVE_DECIMALS,
} from './constants.js'
import { AppError } from './errors.js'

export function nativeValueOfErc20Usdc(amount6) {
  if (typeof amount6 !== 'bigint' || amount6 < 0n) {
    throw new AppError('USDC amount is invalid.')
  }
  return amount6 * NATIVE_PER_ERC20_UNIT
}

export function resolveMaxFeePerGas({ baseFeePerGas, gasPrice }) {
  const base = baseFeePerGas == null ? 0n : baseFeePerGas
  const price = gasPrice == null ? 0n : gasPrice
  if (typeof base !== 'bigint' || typeof price !== 'bigint' || base < 0n || price < 0n) {
    throw new AppError('Gas price data is invalid. The payment was not sent.')
  }
  if (base === 0n && price === 0n) {
    throw new AppError('The Arc RPC did not return a gas price. The payment was not sent.')
  }
  if (base > MAX_MAX_FEE_PER_GAS) {
    throw new AppError('The Arc base fee is above the protocol ceiling. The payment was not sent.')
  }
  let maxFee = base > 0n ? base * 2n : price
  if (price > maxFee) maxFee = price
  if (maxFee < MIN_MAX_FEE_PER_GAS) maxFee = MIN_MAX_FEE_PER_GAS
  if (maxFee > MAX_MAX_FEE_PER_GAS) maxFee = MAX_MAX_FEE_PER_GAS
  return maxFee
}

export function bufferedGasLimit(estimated) {
  if (typeof estimated !== 'bigint' || estimated < 21_000n) {
    throw new AppError('Gas estimate is below the minimum transaction cost. The payment was not sent.')
  }
  const buffered = (estimated * 120n) / 100n
  if (buffered > BLOCK_GAS_LIMIT) {
    throw new AppError('This transaction needs more gas than an Arc block allows. Split it into smaller payments.')
  }
  return buffered
}

export function referenceTransferFee(maxFeePerGas) {
  return REFERENCE_ERC20_GAS * maxFeePerGas
}

function tokenScale(asset, decimals) {
  if (Number.isInteger(decimals) && decimals >= 0 && decimals <= 18) return decimals
  if (asset === 'usdc' || asset === 'eurc') return 6
  return null
}

function tokenLabel(asset, symbol) {
  if (typeof symbol === 'string' && symbol.trim()) return symbol.trim()
  if (asset === 'eurc') return 'EURC'
  if (asset === 'usdc') return 'USDC'
  return ''
}

export function assertGasAndValue({
  asset,
  amount,
  tokenBalance,
  nativeBalance,
  feeNative,
  decimals,
  symbol,
  gasToken,
}) {
  const scale = tokenScale(asset, decimals)
  const label = tokenLabel(asset, symbol)
  const paysWithNativeUsdc = gasToken === true || (gasToken == null && asset === 'usdc')
  if (!label || scale == null) throw new AppError('Unsupported asset.')
  if (typeof amount !== 'bigint' || amount < 0n) throw new AppError('Amount is invalid.')
  if (typeof feeNative !== 'bigint' || feeNative <= 0n) {
    throw new AppError('Gas quote is missing. The payment was not sent.')
  }
  if (typeof nativeBalance !== 'bigint' || nativeBalance < 0n) {
    throw new AppError('USDC balance could not be read. The payment was not sent.')
  }

  if (paysWithNativeUsdc) {
    if (scale !== 6) {
      throw new AppError('USDC decimals did not match the Arc token list. The payment was not sent.')
    }
    const need = nativeValueOfErc20Usdc(amount) + feeNative
    if (nativeBalance < need) {
      throw new AppError(
        `Not enough USDC. This needs ${formatToken(need, USDC_NATIVE_DECIMALS, 8)} USDC including gas, and the wallet has ${formatToken(nativeBalance, USDC_NATIVE_DECIMALS, 6)}.`,
      )
    }
    return
  }

  const places = Math.min(scale, 8)
  if (typeof tokenBalance !== 'bigint' || tokenBalance < amount) {
    const have = typeof tokenBalance === 'bigint' ? formatToken(tokenBalance, scale, places) : 'an unknown amount of'
    throw new AppError(`Not enough ${label}. This needs ${formatToken(amount, scale, places)} ${label}, and the wallet has ${have}.`)
  }
  if (nativeBalance < feeNative) {
    throw new AppError(
      `Not enough USDC for gas. This needs ${formatToken(feeNative, USDC_NATIVE_DECIMALS, 8)} USDC for the fee, and the wallet has ${formatToken(nativeBalance, USDC_NATIVE_DECIMALS, 6)}.`,
    )
  }
}
