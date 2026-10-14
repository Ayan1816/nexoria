import { AppError } from './errors.js'
import { MAX_WHOLE_SUPPLY, USDC_ERC20_DECIMALS } from './constants.js'

export function parseAmount(value, decimals = USDC_ERC20_DECIMALS) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new AppError('Token decimals are not supported.')
  }
  const raw = String(value ?? '').trim()
  if (raw.length === 0 || raw.length > 40 || !/^\d+(\.\d+)?$/.test(raw)) {
    throw new AppError('Amount must be a plain decimal number.')
  }
  const [whole, frac = ''] = raw.split('.')
  if (frac.length > decimals) {
    throw new AppError(`Amount supports at most ${decimals} decimal places.`)
  }
  const scale = 10n ** BigInt(decimals)
  const wholePart = BigInt(whole) * scale
  const fracPart = frac.length === 0 ? 0n : BigInt(frac.padEnd(decimals, '0'))
  return wholePart + fracPart
}

export function parseWholeSupply(value) {
  const raw = String(value ?? '').trim()
  if (!/^\d+$/.test(raw) || raw.length > 16) {
    throw new AppError('Supply must be a whole number of tokens.')
  }
  const supply = BigInt(raw)
  if (supply <= 0n || supply > MAX_WHOLE_SUPPLY) {
    throw new AppError('Supply must be between 1 and 1,000,000,000,000,000 tokens.')
  }
  return supply
}

export function formatToken(amount, decimals, maxFraction = 6) {
  if (typeof amount !== 'bigint') throw new AppError('Amount is not an integer value.')
  if (!Number.isInteger(decimals) || decimals < 0) throw new AppError('Token decimals are not supported.')
  const negative = amount < 0n
  const value = negative ? -amount : amount
  const scale = 10n ** BigInt(decimals)
  const whole = value / scale
  const fraction = value % scale
  if (maxFraction <= 0 || fraction === 0n) return `${negative ? '-' : ''}${whole}`
  const digits = fraction.toString().padStart(decimals, '0').slice(0, maxFraction).replace(/0+$/, '')
  const body = digits.length === 0 ? `${whole}` : `${whole}.${digits}`
  return negative ? `-${body}` : body
}

export function assertTokenMetadata(name, symbol) {
  const tokenName = String(name ?? '').trim()
  const tokenSymbol = String(symbol ?? '').trim()
  if (tokenName.length === 0 || tokenName.length > 32 || !/^[\x20-\x7E]+$/.test(tokenName)) {
    throw new AppError('Token name must be 1 to 32 printable characters.')
  }
  if (!/^[A-Z0-9]{2,8}$/.test(tokenSymbol)) {
    throw new AppError('Symbol must be 2 to 8 characters, using A-Z and digits.')
  }
  return { name: tokenName, symbol: tokenSymbol }
}
