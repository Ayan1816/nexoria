export class AppError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'AppError'
    this.code = options.code ?? 'APP'
    if (options.hash !== undefined) this.hash = options.hash
    if (options.chainId !== undefined) this.chainId = options.chainId
    if (options.cause !== undefined) this.cause = options.cause
  }
}

function firstLine(value) {
  return String(value ?? '').split('\n')[0].trim().slice(0, 180)
}

export function toUserError(error) {
  if (error instanceof AppError) return error
  const code = error?.code
  const raw = error?.shortMessage || error?.reason || error?.info?.error?.message || error?.message || ''
  const text = firstLine(raw)

  if (code === 4001 || code === 'ACTION_REJECTED' || /user rejected|user denied|rejected the request/i.test(text)) {
    return new AppError('The wallet rejected the request.', { code: 'REJECTED', cause: error })
  }
  if (code === 4902) {
    return new AppError('This network is not in the wallet yet.', { code: 'UNKNOWN_CHAIN', cause: error })
  }
  if (code === -32002) {
    return new AppError('The wallet already has a request open.', { code: 'PENDING', cause: error })
  }
  if (/insufficient funds/i.test(text)) {
    return new AppError('The wallet does not have enough USDC for the amount and the gas fee.', { code: 'FUNDS', cause: error })
  }
  if (/underpriced|fee cap less than block base fee|max fee per gas less than block base fee/i.test(text)) {
    return new AppError('The gas fee is below the Arc minimum. The transaction was not sent.', { code: 'UNDERPRICED', cause: error })
  }
  if (/blocklist|blacklisted|account is blocked/i.test(text)) {
    return new AppError('USDC blocklist rules rejected this address.', { code: 'BLOCKLIST', cause: error })
  }
  if (code === 'CALL_EXCEPTION' || /execution reverted|estimateGas/i.test(text)) {
    const reason = text.replace(/^execution reverted:?\s*/i, '')
    return new AppError(
      reason
        ? `The network would reject this transaction: ${reason}`
        : 'The network would reject this transaction. It was not submitted.',
      { code: 'REVERT', cause: error },
    )
  }
  if (/failed to fetch|timeout|network error|disconnected/i.test(text)) {
    return new AppError('The network request failed. Check the connection and try again.', { code: 'NETWORK', cause: error })
  }
  return new AppError(text || 'Something went wrong.', { code: 'UNKNOWN', cause: error })
}
