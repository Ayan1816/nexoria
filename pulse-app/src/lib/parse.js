import { MAX_BATCH, MAX_DELAY_MINUTES, MAX_MEMO_CHARS } from './constants.js'
import { AppError } from './errors.js'

const ADDRESS = /^0x[a-fA-F0-9]{40}$/i
const ZERO = /^0x0{40}$/i

export function assertAddress(value, label = 'Address') {
  const raw = String(value ?? '').trim()
  if (!ADDRESS.test(raw) || ZERO.test(raw)) {
    throw new AppError(`${label} must be a non-zero 0x address.`)
  }
  return `0x${raw.slice(2).toLowerCase()}`
}

export function parsePayrollList(text, globalAmountText) {
  const lines = String(text ?? '').split(/\r?\n/)
  const transfers = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line) continue
    const match = line.match(/^(0x[a-fA-F0-9]{40})(?:\s+(\d+(?:\.\d+)?))?$/i)
    if (!match) {
      throw new AppError(`Line ${index + 1} must be an address, optionally followed by an amount.`)
    }
    const amountText = match[2] ?? String(globalAmountText ?? '').trim()
    if (!amountText) {
      throw new AppError(`Line ${index + 1} has no amount, and the global amount is empty.`)
    }
    transfers.push({ to: assertAddress(match[1], `Line ${index + 1} recipient`), amountText })
  }
  if (transfers.length === 0) throw new AppError('Enter at least one recipient address.')
  if (transfers.length > MAX_BATCH) {
    throw new AppError(`A payroll batch can include at most ${MAX_BATCH} recipients.`)
  }
  assertUnique(transfers.map((row) => ({ asset: 'payroll', to: row.to })))
  return transfers
}

export function assertDelayMinutes(value) {
  const raw = String(value ?? '').trim()
  if (!/^\d+$/.test(raw)) throw new AppError('Delay must be a whole number of minutes.')
  const minutes = Number(raw)
  if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > MAX_DELAY_MINUTES) {
    throw new AppError('Delay must be between 1 minute and 7 days.')
  }
  return minutes
}

export function assertMemo(value) {
  const message = String(value ?? '').trim()
  if (message.length === 0) throw new AppError('Enter a message.')
  if (message.length > MAX_MEMO_CHARS) throw new AppError(`Message must be ${MAX_MEMO_CHARS} characters or fewer.`)
  if (message.includes('\u0000')) throw new AppError('Message contains a null character.')
  return message
}

function assertUnique(transfers) {
  const seen = new Set()
  for (const transfer of transfers) {
    const key = `${transfer.asset}:${transfer.to}`
    if (seen.has(key)) throw new AppError('The batch pays the same address twice.')
    seen.add(key)
  }
}
