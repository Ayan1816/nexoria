import { AppError } from './errors.js'

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/

function csvCell(value) {
  let text = String(value ?? '')
  if (/^[=+@\t\r]/.test(text)) text = `'${text}`
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function receiptDate(time) {
  const text = String(time ?? '')
  if (!ISO_TIME.test(text)) return text
  const parsed = Date.parse(text)
  if (!Number.isFinite(parsed)) return text
  return new Date(parsed).toISOString()
}

export function receiptsToCsv(rows) {
  const lines = ['Date,Amount,Token,Recipient Address']
  const list = Array.isArray(rows) ? rows : []
  for (const row of list) {
    lines.push([
      csvCell(receiptDate(row?.time)),
      csvCell(row?.amount),
      csvCell(row?.token),
      csvCell(row?.to),
    ].join(','))
  }
  return `\uFEFF${lines.join('\r\n')}\n`
}

export function downloadCsv(filename, csv) {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
    throw new AppError('This browser cannot download a file.')
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
