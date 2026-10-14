import { BrowserProvider } from 'ethers'
import { AppError } from './errors.js'
import { assertAddress } from './parse.js'

export function isContractCode(code) {
  if (typeof code !== 'string' || !/^0x[0-9a-fA-F]*$/.test(code)) return null
  return code.slice(2).replace(/0/g, '').length > 0
}

export function isKnownRecipient(history, address) {
  let target
  try {
    target = assertAddress(address, 'Recipient')
  } catch {
    return false
  }
  if (!Array.isArray(history)) return false
  return history.some((row) => {
    if (!row || typeof row.to !== 'string') return false
    try {
      return assertAddress(row.to, 'Recipient') === target
    } catch {
      return false
    }
  })
}

export function guardLevel({ contract, known }) {
  if (contract) return 'contract'
  if (known) return 'known'
  return 'new'
}

export function guardAckKey(report) {
  if (!report || typeof report.address !== 'string' || !Number.isSafeInteger(report.chainId)) return ''
  if (report.level !== 'new' && report.level !== 'contract') return ''
  return `${report.chainId}:${report.address}:${report.level}`
}

export function guardAllowsSend(report, acknowledgement) {
  if (!report) return false
  if (report.level === 'known') return true
  const key = guardAckKey(report)
  return key.length > 0 && acknowledgement === key
}

export async function analyzeSendGuard({ eip1193, recipient, history, expectedChainId }) {
  if (!eip1193?.request) throw new AppError('Connect a wallet before continuing.')
  const address = assertAddress(recipient, 'Recipient')
  const provider = new BrowserProvider(eip1193)
  try {
    const chainId = Number((await provider.getNetwork()).chainId)
    if (!Number.isSafeInteger(chainId)) throw new AppError('The wallet returned an invalid chain id.')
    if (expectedChainId != null && chainId !== expectedChainId) {
      throw new AppError('The wallet network changed. Check the recipient again.')
    }
    const code = await provider.getCode(address)
    const contract = isContractCode(code)
    if (contract == null) {
      throw new AppError('The network did not return contract code for this recipient. The payment was not sent.')
    }
    const known = isKnownRecipient(history, address)
    const level = guardLevel({ contract, known })
    return { address, chainId, contract, known, level }
  } finally {
    provider.destroy()
  }
}
