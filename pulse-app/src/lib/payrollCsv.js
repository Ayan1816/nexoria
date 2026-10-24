import { parseAmount } from './amounts.js'
import { MAX_BATCH } from './constants.js'
import { AppError, toUserError } from './errors.js'
import { assertAddress, parsePayrollList } from './parse.js'

const MAX_CSV_CHARS = 64 * 1024
const MAX_SCAN_ROWS = 100
const WHO_HEADER = /^(address|recipient|wallet|contact|contact name|name|recipient address|wallet address)$/i
const AMOUNT_HEADER = /^(amount|value)$/i

export const PAYROLL_SAMPLE_CSV = [
  'address,amount',
  '0x1111111111111111111111111111111111111111,50',
  '0x2222222222222222222222222222222222222222,25.5',
].join('\r\n') + '\r\n'

function parseCsvRecords(text) {
  const src = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (src.length > MAX_CSV_CHARS) {
    throw new AppError('That CSV is too large. A payroll batch allows 25 recipients.')
  }
  const records = []
  let cells = []
  let field = ''
  let quoted = false
  let line = 1
  let recordLine = 1

  const endRecord = () => {
    cells.push(field)
    const blank = cells.every((cell) => cell.trim() === '')
    if (!blank) records.push({ line: recordLine, cells: cells.map((cell) => cell.trim()) })
    cells = []
    field = ''
    recordLine = line
  }

  for (let index = 0; index < src.length; index += 1) {
    const ch = src[index]
    if (quoted) {
      if (ch === '"') {
        if (src[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        if (ch === '\n') line += 1
        field += ch
      }
      continue
    }
    if (ch === '"') {
      quoted = true
      continue
    }
    if (ch === ',') {
      cells.push(field)
      field = ''
      continue
    }
    if (ch === '\n') {
      line += 1
      endRecord()
      continue
    }
    field += ch
  }
  if (quoted) throw new AppError('A quoted field in the CSV is not closed.')
  if (field !== '' || cells.length > 0) endRecord()
  return records
}

function headerIndexes(cells) {
  const who = cells.findIndex((cell) => WHO_HEADER.test(cell))
  const amount = cells.findIndex((cell) => AMOUNT_HEADER.test(cell))
  if (who === -1 || amount === -1 || who === amount) return null
  return { who, amount }
}

function findContact(contacts, name) {
  const key = name.trim().toLowerCase()
  if (!key) return []
  return (Array.isArray(contacts) ? contacts : []).filter((row) => {
    return row && typeof row.name === 'string' && row.name.trim().toLowerCase() === key
  })
}

function rowLabel(value) {
  let text = ''
  for (const ch of String(value ?? '')) {
    if (ch.codePointAt(0) > 31) text += ch
  }
  text = text.trim()
  return text.length > 40 ? `${text.slice(0, 40)}…` : text
}

function resolveRecipient(raw, contacts) {
  if (/^0x/i.test(raw)) return { address: assertAddress(raw, 'Recipient') }
  const matches = findContact(contacts, raw)
  if (matches.length > 1) throw new AppError('that name matches more than one contact.')
  if (matches.length === 0) throw new AppError(`no saved contact is named "${rowLabel(raw)}".`)
  return { address: assertAddress(matches[0].address, 'Contact address') }
}

export function payrollCsvToText(csv, contacts = [], decimals = 6) {
  let records
  try {
    records = parseCsvRecords(csv)
  } catch (error) {
    return { text: '', count: 0, errors: [toUserError(error).message] }
  }
  if (records.length === 0) {
    return { text: '', count: 0, errors: ['The CSV has no recipient rows.'] }
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    return { text: '', count: 0, errors: ['Token decimals are not supported.'] }
  }

  const header = headerIndexes(records[0].cells)
  const data = header ? records.slice(1) : records
  if (data.length === 0) {
    return { text: '', count: 0, errors: ['The CSV has no recipient rows.'] }
  }

  const errors = []
  const rows = []
  const seen = new Set()
  const limited = data.slice(0, MAX_SCAN_ROWS)
  if (data.length > MAX_BATCH) {
    errors.push(`A payroll batch can include at most ${MAX_BATCH} recipients.`)
  }
  if (data.length > MAX_SCAN_ROWS) {
    errors.push(`Only the first ${MAX_SCAN_ROWS} rows were checked.`)
  }

  for (const record of limited) {
    const cells = record.cells
    const who = header ? cells[header.who] ?? '' : cells[0] ?? ''
    const amountText = header ? cells[header.amount] ?? '' : cells[1] ?? ''
    if (!header && cells.length !== 2) {
      errors.push(`Row ${record.line}: use an address or contact name, then an amount, separated by a comma.`)
      continue
    }
    if (!who) {
      errors.push(`Row ${record.line}: enter an address or a contact name.`)
      continue
    }
    let address
    try {
      address = resolveRecipient(who, contacts).address
    } catch (error) {
      errors.push(`Row ${record.line}: ${toUserError(error).message}`)
      continue
    }
    if (!amountText) {
      errors.push(`Row ${record.line}: enter an amount greater than zero.`)
      continue
    }
    try {
      const units = parseAmount(amountText, decimals)
      if (units <= 0n) throw new AppError('Amount must be greater than zero.')
    } catch (error) {
      errors.push(`Row ${record.line}: ${toUserError(error).message}`)
      continue
    }
    if (seen.has(address)) {
      errors.push(`Row ${record.line}: this address is already listed in the CSV.`)
      continue
    }
    seen.add(address)
    rows.push({ to: address, amountText })
  }

  if (errors.length > 0) return { text: '', count: 0, errors }
  const text = rows.map((row) => `${row.to} ${row.amountText}`).join('\n')
  try {
    const parsed = parsePayrollList(text, '')
    if (parsed.length !== rows.length) throw new AppError('The CSV could not be applied.')
  } catch (error) {
    return { text: '', count: 0, errors: [toUserError(error).message] }
  }
  return { text, count: rows.length, errors: [] }
}
