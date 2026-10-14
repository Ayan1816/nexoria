import { useCallback, useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import {
  Activity, ArrowRight, Clock, Contact, Cpu, Droplet, Globe, History, Layers,
  LogOut, MessageSquare, Moon, Settings, Shield, Sun, Terminal, Users, Zap,
} from 'lucide-react'
import { assertTokenMetadata, formatToken, parseAmount, parseWholeSupply } from './lib/amounts.js'
import { HISTORY_LIMIT, TASK_LIMIT, USDC_NATIVE_DECIMALS } from './lib/constants.js'
import { AppError, toUserError } from './lib/errors.js'
import { listActiveAllowances } from './lib/allowances.js'
import { getArcNetwork, NETWORKS } from './lib/networks.js'
import { switchOrAddChain } from './lib/walletChain.js'
import { assertAddress, assertDelayMinutes, assertMemo, parsePayrollList } from './lib/parse.js'
import {
  deployFixedSupplyToken, readWalletSnapshot, revokeAllowance,
  sendMemo, sendTransfers, tokenDeployReady,
} from './lib/payments.js'
import { capTasks, createId, normalizeTasks } from './lib/state.js'
import { downloadCsv, receiptsToCsv } from './lib/ledgerCsv.js'
import { PAYROLL_SAMPLE_CSV, payrollCsvToText } from './lib/payrollCsv.js'
import {
  filterContacts, loadContacts, removeContact, saveContacts, upsertContact,
} from './lib/contacts.js'
import { analyzeSendGuard, guardAllowsSend, guardAckKey } from './lib/sendGuard.js'
import { appendWalletHistory, loadWalletState, persistWalletState, readSavedReceipts } from './lib/storage.js'
import { useAnnouncedWallets } from './hooks/useAnnouncedWallets.js'

const CAN_DEPLOY_TOKEN = tokenDeployReady()
const MODULES = [
  { id: 'payments', title: 'Batch payments', subtitle: 'USDC AND EURC', icon: ArrowRight },
  { id: 'payroll', title: 'Payroll', subtitle: 'ONE BATCH TRANSFER', icon: Users },
  { id: 'schedule', title: 'Scheduled payments', subtitle: 'SIGN WHEN DUE', icon: Clock },
  { id: 'memo', title: 'On-chain memo', subtitle: 'PUBLIC MESSAGE', icon: MessageSquare },
]

function clock() {
  return new Date().toISOString().slice(11, 19)
}

function receiptStamp() {
  return new Date().toISOString()
}

function formatLedgerWhen(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return value ?? ''
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value
  const date = new Date(parsed)
  const pad = (part) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function shortAddress(value) {
  if (typeof value !== 'string' || value.length < 12) return value || ''
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function assetLabel(asset) {
  return asset === 'eurc' ? 'EURC' : 'USDC'
}

function formatAllowance(value) {
  if (typeof value !== 'bigint') return ''
  if (value >= 2n ** 255n) return 'Unlimited'
  return formatToken(value, 6, 6)
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-mono text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function ContactMenu({ contacts, query, open, onPick, isDark }) {
  if (!open) return null
  const matches = filterContacts(contacts, query, 100)
  return (
    <div className={`max-h-48 space-y-1 overflow-y-auto rounded-xl border p-2 ${isDark ? 'border-white/10 bg-slate-950' : 'border-slate-200 bg-white'}`}>
      {matches.length === 0 && <p className="px-2 py-3 text-center text-xs text-slate-500">No matching contacts.</p>}
      {matches.map((contact) => (
        <button
          key={contact.id}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(contact)}
          className={`flex w-full flex-col rounded-lg border px-3 py-2 text-left ${isDark ? 'border-white/10 hover:border-cyan-500/40' : 'border-slate-200 hover:border-cyan-600/40'}`}
        >
          <span className="text-sm font-bold">{contact.name}</span>
          <span className="break-all font-mono text-[10px] text-slate-500">{contact.address}</span>
        </button>
      ))}
    </div>
  )
}

export default function App() {
  const wallets = useAnnouncedWallets()
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('nexoria.theme') !== 'light' } catch { return true }
  })
  const [activeModule, setActiveModule] = useState(MODULES[0].id)
  const [utilityTab, setUtilityTab] = useState('ledger')
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [eip1193, setEip1193] = useState(null)
  const [walletAddress, setWalletAddress] = useState(null)
  const [chainId, setChainId] = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [balanceError, setBalanceError] = useState('')
  const [readyAddress, setReadyAddress] = useState(null)
  const [logs, setLogs] = useState([])
  const [txHistory, setTxHistory] = useState([])
  const [tasks, setTasks] = useState([])
  const [formError, setFormError] = useState('')
  const [payAddress, setPayAddress] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [isPaying, setIsPaying] = useState(false)
  const [payrollText, setPayrollText] = useState('')
  const [payrollCsvErrors, setPayrollCsvErrors] = useState([])
  const [payrollCsvSummary, setPayrollCsvSummary] = useState('')
  const [payrollAsset, setPayrollAsset] = useState('usdc')
  const [globalAmount, setGlobalAmount] = useState('')
  const [isPayroll, setIsPayroll] = useState(false)
  const [autoAddress, setAutoAddress] = useState('')
  const [autoAmount, setAutoAmount] = useState('')
  const [autoAsset, setAutoAsset] = useState('usdc')
  const [autoTime, setAutoTime] = useState('')
  const [pagerAddress, setPagerAddress] = useState('')
  const [pagerMessage, setPagerMessage] = useState('')
  const [isPaging, setIsPaging] = useState(false)
  const [forgeName, setForgeName] = useState('')
  const [forgeSymbol, setForgeSymbol] = useState('')
  const [forgeSupply, setForgeSupply] = useState('')
  const [isForging, setIsForging] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [contactBook, setContactBook] = useState({ owner: '', contacts: [] })
  const [contactName, setContactName] = useState('')
  const [contactAddress, setContactAddress] = useState('')
  const [editingContactId, setEditingContactId] = useState('')
  const [isSavingContact, setIsSavingContact] = useState(false)
  const [contactError, setContactError] = useState('')
  const [payContactOpen, setPayContactOpen] = useState(false)
  const [payFieldFocus, setPayFieldFocus] = useState(false)
  const [payrollContactOpen, setPayrollContactOpen] = useState(false)
  const [guardResult, setGuardResult] = useState({ key: '', report: null, error: '' })
  const [guardAck, setGuardAck] = useState('')
  const [guardNonce, setGuardNonce] = useState(0)
  const [allowanceResult, setAllowanceResult] = useState({ key: '', rows: null, error: '' })
  const [revokingKey, setRevokingKey] = useState('')
  const [allowanceNonce, setAllowanceNonce] = useState(0)

  const terminalEndRef = useRef(null)
  const addressRef = useRef(null)
  const historyRef = useRef([])
  const tasksRef = useRef([])
  const dataReadyRef = useRef(false)
  const remoteWritableRef = useRef(false)
  const timersRef = useRef(new Map())
  const inFlightRef = useRef(new Set())
  const actionLockRef = useRef(false)
  const saveQueueRef = useRef(Promise.resolve())
  const refreshingRef = useRef(false)
  const refreshAgainRef = useRef(false)
  const providerRef = useRef(null)
  const lastBalanceErrorRef = useRef('')
  const guardGenRef = useRef(0)
  const contactFormOwnerRef = useRef('')
  const contactGenRef = useRef(0)
  const payrollFileRef = useRef(null)
  const MAX_TIMER_MS = 2_147_483_647

  const pushLog = useCallback((message, type = 'info') => {
    setLogs((prev) => [...prev.slice(-199), { time: clock(), message, type }])
  }, [])

  const saveCurrent = useCallback(() => {
    const address = addressRef.current
    if (!address || !dataReadyRef.current) return
    const payload = {
      updatedAt: Date.now(),
      txHistory: historyRef.current.slice(),
      tasks: tasksRef.current.slice(),
    }
    const writable = remoteWritableRef.current
    saveQueueRef.current = saveQueueRef.current
      .then(() => persistWalletState(address, payload, writable))
      .then((result) => {
        if (result.localError) pushLog(result.localError.message, 'error')
        if (result.remoteError) pushLog(result.remoteError.message, 'warning')
      })
      .catch((error) => pushLog(toUserError(error).message, 'error'))
  }, [pushLog])

  const commitHistory = useCallback((rows, address = addressRef.current) => {
    if (addressRef.current !== address || !dataReadyRef.current) return
    historyRef.current = rows.slice(0, HISTORY_LIMIT)
    setTxHistory(historyRef.current)
    saveCurrent()
  }, [saveCurrent])

  const commitTasks = useCallback((rows, address = addressRef.current) => {
    if (addressRef.current !== address || !dataReadyRef.current) return
    tasksRef.current = capTasks(rows)
    setTasks(tasksRef.current)
    saveCurrent()
  }, [saveCurrent])

  const markReady = useCallback((id) => {
    let changed = false
    const next = tasksRef.current.map((task) => {
      if (task.id === id && task.status === 'pending') {
        changed = true
        return { ...task, status: 'ready' }
      }
      return task
    })
    if (changed) commitTasks(next)
  }, [commitTasks])

  const armTimer = useCallback((task) => {
    const existing = timersRef.current.get(task.id)
    if (existing) clearTimeout(existing)
    const delay = task.triggerAt - Date.now()
    if (delay <= 0) {
      markReady(task.id)
      return
    }
    const handle = setTimeout(() => {
      timersRef.current.delete(task.id)
      if (task.triggerAt - Date.now() > 0) armTimer(task)
      else markReady(task.id)
    }, Math.min(delay, MAX_TIMER_MS))
    timersRef.current.set(task.id, handle)
  }, [markReady])

  const releaseWallet = useCallback(() => {
    dataReadyRef.current = false
    setReadyAddress(null)
    for (const handle of timersRef.current.values()) clearTimeout(handle)
    timersRef.current.clear()
    historyRef.current = []
    tasksRef.current = []
    setTxHistory([])
    setTasks([])
  }, [])

  const refresh = useCallback(async () => {
    if (!providerRef.current) return
    if (refreshingRef.current) {
      refreshAgainRef.current = true
      return
    }
    refreshingRef.current = true
    try {
      for (let pass = 0; pass < 3; pass += 1) {
        refreshAgainRef.current = false
        try {
          const next = await readWalletSnapshot(providerRef.current)
          if (addressRef.current && addressRef.current !== next.account) {
            releaseWallet()
            pushLog('Wallet account changed. Payment data was reloaded.', 'warning')
          }
          addressRef.current = next.account
          setWalletAddress(next.account)
          setChainId(next.chainId)
          setSnapshot(next.network ? next : null)
          setBalanceError('')
          lastBalanceErrorRef.current = ''
        } catch (error) {
          const wrapped = toUserError(error)
          console.error(wrapped.message, error)
          setSnapshot(null)
          setBalanceError(wrapped.message)
          if (lastBalanceErrorRef.current !== wrapped.message) {
            lastBalanceErrorRef.current = wrapped.message
            pushLog(wrapped.message, 'error')
          }
        }
        if (!refreshAgainRef.current) break
      }
    } finally {
      refreshingRef.current = false
    }
  }, [pushLog, releaseWallet])

  useEffect(() => {
    try { localStorage.setItem('nexoria.theme', isDark ? 'dark' : 'light') } catch (error) { console.error(error) }
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
    document.body.style.backgroundColor = isDark ? '#020617' : '#f1f5f9'
  }, [isDark])

  useEffect(() => {
    if (terminalEndRef.current) terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  useEffect(() => {
    if (!eip1193?.on) return undefined
    const onAccounts = (accounts) => {
      if (!accounts?.length) {
        disconnect()
        return
      }
      void refresh()
    }
    const onChain = () => { void refresh() }
    eip1193.on('accountsChanged', onAccounts)
    eip1193.on('chainChanged', onChain)
    return () => {
      eip1193.removeListener?.('accountsChanged', onAccounts)
      eip1193.removeListener?.('chainChanged', onChain)
    }
  }, [eip1193, refresh])

  useEffect(() => {
    if (!eip1193 || !walletAddress) return undefined
    const timer = setInterval(() => { void refresh() }, 8000)
    return () => clearInterval(timer)
  }, [eip1193, walletAddress, refresh])

  useEffect(() => {
    if (!walletAddress) return undefined
    let cancelled = false
    const timers = timersRef.current
    dataReadyRef.current = false
    for (const handle of timers.values()) clearTimeout(handle)
    timers.clear()

    ;(async () => {
      const loaded = await loadWalletState(walletAddress)
      if (cancelled) return
      const normalized = normalizeTasks(loaded.state.tasks)
      historyRef.current = loaded.state.txHistory
      tasksRef.current = normalized
      remoteWritableRef.current = loaded.remoteWritable
      setTxHistory(loaded.state.txHistory)
      setTasks(normalized)
      if (loaded.localError) pushLog(loaded.localError.message, 'error')
      if (loaded.remoteError) pushLog(loaded.remoteError.message, 'warning')
      const dropped = loaded.state.dropped
      if (dropped.history || dropped.tasks) {
        pushLog(`Ignored ${dropped.history} history rows and ${dropped.tasks} tasks that failed validation.`, 'warning')
      }
      const changed = normalized.some((task, index) => task.status !== loaded.state.tasks[index]?.status)
      if (changed || loaded.migrated) {
        const result = await persistWalletState(walletAddress, {
          updatedAt: loaded.migrated ? Math.max(loaded.state.updatedAt, 1) : Date.now(),
          txHistory: loaded.state.txHistory,
          tasks: normalized,
        }, loaded.remoteWritable)
        if (cancelled) return
        if (result.localError) pushLog(result.localError.message, 'error')
        if (result.remoteError) pushLog(result.remoteError.message, 'warning')
      }
      if (cancelled) return
      dataReadyRef.current = true
      setReadyAddress(walletAddress)
      for (const task of normalized) {
        if (task.status === 'pending') armTimer(task)
      }
    })().catch((error) => {
      if (!cancelled) pushLog(toUserError(error).message, 'error')
    })

    return () => {
      cancelled = true
      for (const handle of timers.values()) clearTimeout(handle)
      timers.clear()
    }
  }, [walletAddress, armTimer, pushLog])

  function disconnect() {
    for (const handle of timersRef.current.values()) clearTimeout(handle)
    timersRef.current.clear()
    providerRef.current = null
    addressRef.current = null
    historyRef.current = []
    tasksRef.current = []
    dataReadyRef.current = false
    remoteWritableRef.current = false
    setEip1193(null)
    setWalletAddress(null)
    setChainId(null)
    setSnapshot(null)
    setBalanceError('')
    setReadyAddress(null)
    setTxHistory([])
    setTasks([])
    setLogs([])
    setAllowanceResult({ key: '', rows: null, error: '' })
    setRevokingKey('')
    setContactBook({ owner: '', contacts: [] })
    setContactName('')
    setContactAddress('')
    setEditingContactId('')
    setContactError('')
    setPayContactOpen(false)
    setPayrollContactOpen(false)
    contactFormOwnerRef.current = ''
  }

  async function connect(provider) {
    setIsConnecting(true)
    setFormError('')
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' })
      if (!accounts?.length) throw new Error('The wallet did not return an account.')
      providerRef.current = provider
      setEip1193(provider)
      setShowWalletModal(false)
      await refresh()
      pushLog('Wallet connected.', 'success')
    } catch (error) {
      const wrapped = toUserError(error)
      console.error(wrapped.message, error)
      setFormError(wrapped.message)
      pushLog(wrapped.message, 'error')
    } finally {
      setIsConnecting(false)
    }
  }

  async function switchNetwork(hexChainId) {
    const network = NETWORKS.find((item) => item.hexChainId === hexChainId)
    if (!network || !providerRef.current) {
      setFormError('Connect a wallet before switching networks.')
      return
    }
    setFormError('')
    try {
      await switchOrAddChain(providerRef.current, network)
    } catch (error) {
      setFormError(toUserError(error).message)
      return
    }
    await refresh()
  }

  function requireReady() {
    if (!providerRef.current || !addressRef.current) {
      throw toUserError(new Error('Connect a wallet first.'))
    }
    if (!snapshot?.network) throw toUserError(new Error('Switch to Arc before sending. Gas on Arc is USDC.'))
    if (!dataReadyRef.current) throw toUserError(new Error('Wallet data is still loading.'))
    return snapshot
  }

  function transferRows(result, status) {
    return result.transfers.map((transfer) => ({
      id: createId(),
      hash: result.hash,
      amount: formatToken(BigInt(transfer.amount), 6, 6),
      token: assetLabel(transfer.asset),
      to: transfer.to,
      time: receiptStamp(),
      status,
      chainId: result.chainId,
    }))
  }

  async function rememberRows(rows, account, taskPatch) {
    if (!account || (rows.length === 0 && !taskPatch)) return
    const freshAgainst = (existing) => rows.filter((row) => !existing.some((item) => (
      item.hash === row.hash && item.to === row.to && item.status === row.status && item.amount === row.amount
    )))
    if (addressRef.current === account && dataReadyRef.current) {
      const fresh = freshAgainst(historyRef.current)
      if (fresh.length > 0) commitHistory([...fresh, ...historyRef.current], account)
      return
    }
    const pending = saveQueueRef.current.then(() => appendWalletHistory(account, rows, taskPatch))
    saveQueueRef.current = pending.then(() => {}, () => {})
    const saved = await pending
    if (saved.localError) pushLog(saved.localError.message, 'error')
    if (saved.remoteError) pushLog(saved.remoteError.message, 'warning')
    if (addressRef.current === account && dataReadyRef.current) {
      const fresh = freshAgainst(historyRef.current)
      if (fresh.length > 0) commitHistory([...fresh, ...historyRef.current], account)
    }
  }

  async function safeRemember(rows, account) {
    try {
      await rememberRows(rows, account)
    } catch (error) {
      pushLog(toUserError(error).message, 'warning')
    }
  }

  function assertSameWallet(account, hash) {
    if (!accountMoved(account)) return
    throw new AppError(
      `The wallet account changed after the transaction was sent. Hash ${hash}. The receipt was saved to the previous account.`,
      { code: 'ACCOUNT', hash },
    )
  }

  async function noteReverted(error, transfers, account, chainId, taskPatch) {
    const wrapped = toUserError(error)
    if (wrapped.code !== 'REVERTED' || typeof wrapped.hash !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(wrapped.hash)) return
    try {
      await rememberRows(transferRows({
        hash: wrapped.hash,
        chainId: wrapped.chainId ?? chainId,
        transfers,
      }, 'reverted'), account, taskPatch)
    } catch (storeError) {
      pushLog(toUserError(storeError).message, 'warning')
    }
  }

  function accountMoved(account) {
    return addressRef.current !== account
  }

  async function runAction(setBusy, action) {
    if (actionLockRef.current) return
    actionLockRef.current = true
    setFormError('')
    setBusy(true)
    try {
      await action()
    } catch (error) {
      const wrapped = toUserError(error)
      console.error(wrapped.message, error)
      setFormError(wrapped.message)
      pushLog(wrapped.message, wrapped.code === 'REJECTED' || wrapped.code === 'ACCOUNT' ? 'warning' : 'error')
    } finally {
      actionLockRef.current = false
      setBusy(false)
    }
  }

  function celebrate() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.3 } })
  }

  function sendPayment(asset) {
    runAction(setIsPaying, async () => {
      const ready = requireReady()
      const account = addressRef.current
      const recipient = assertAddress(payAddress, 'Recipient')
      const amount = parseAmount(payAmount, 6)
      const gen = guardGenRef.current + 1
      guardGenRef.current = gen
      const report = await analyzeSendGuard({
        eip1193: providerRef.current,
        recipient,
        history: historyRef.current,
        expectedChainId: ready.network.chainId,
      })
      if (guardGenRef.current !== gen || addressRef.current !== account) {
        throw new AppError('The payment details changed. Review Send Guard and submit it again.')
      }
      setGuardResult({
        key: `${account}:${report.chainId}:${report.address}:${guardNonce}`,
        report,
        error: '',
      })
      if (!guardAllowsSend(report, guardAck)) {
        throw new AppError(
          report.level === 'contract'
            ? 'Send Guard: this recipient is a smart contract. Acknowledge the warning before sending.'
            : 'Send Guard: this is a new wallet. Acknowledge the warning before sending.',
        )
      }
      const transfers = [{
        asset,
        to: recipient,
        amount,
      }]
      let result
      try {
        result = await sendTransfers({
          eip1193: providerRef.current,
          transfers,
          expectedChainId: ready.network.chainId,
        })
      } catch (error) {
        await noteReverted(error, transfers, account, ready.network.chainId)
        throw error
      }
      await safeRemember(transferRows(result, 'confirmed'), account)
      setPayAddress('')
      setPayAmount('')
      assertSameWallet(account, result.hash)
      pushLog(`${assetLabel(asset)} payment confirmed. Gas ceiling ${formatToken(result.feeNative, USDC_NATIVE_DECIMALS, 8)} USDC.`, 'success')
      celebrate()
      await refresh()
    })
  }

  function exportLedger() {
    runAction(setIsExporting, async () => {
      if (!addressRef.current || !dataReadyRef.current) {
        throw toUserError(new Error('Connect a wallet first.'))
      }
      const account = addressRef.current
      await saveQueueRef.current
      if (addressRef.current !== account) {
        throw new AppError('The wallet account changed. Export the ledger again.')
      }
      const receipts = await readSavedReceipts(account)
      if (addressRef.current !== account) {
        throw new AppError('The wallet account changed. Export the ledger again.')
      }
      if (receipts.length === 0) throw new AppError('No saved receipts to export.')
      const day = new Date().toISOString().slice(0, 10)
      downloadCsv(`nexoria-ledger-${account.slice(2, 8)}-${day}.csv`, receiptsToCsv(receipts))
      pushLog(`Exported ${receipts.length} saved receipt${receipts.length === 1 ? '' : 's'}.`, 'success')
    })
  }

  function submitContact() {
    runAction(setIsSavingContact, async () => {
      if (!addressRef.current || !dataReadyRef.current) {
        throw toUserError(new Error('Connect a wallet first.'))
      }
      const account = addressRef.current
      const current = contactBook.owner === account ? contactBook.contacts : await loadContacts(account)
      const next = upsertContact(current, {
        id: editingContactId,
        name: contactName,
        address: contactAddress,
      })
      const saved = await saveContacts(account, next)
      if (addressRef.current !== account) {
        throw new AppError('The wallet account changed. Save the contact again.')
      }
      contactGenRef.current += 1
      setContactBook({ owner: account, contacts: saved })
      setContactName('')
      setContactAddress('')
      setEditingContactId('')
      setContactError('')
      pushLog(editingContactId ? 'Contact updated.' : 'Contact saved.', 'success')
    })
  }

  function deleteContact(contact) {
    if (!window.confirm(`Remove ${contact.name} from contacts?`)) return
    runAction(setIsSavingContact, async () => {
      if (!addressRef.current || !dataReadyRef.current) {
        throw toUserError(new Error('Connect a wallet first.'))
      }
      const account = addressRef.current
      const current = contactBook.owner === account ? contactBook.contacts : await loadContacts(account)
      const saved = await saveContacts(account, removeContact(current, contact.id))
      if (addressRef.current !== account) {
        throw new AppError('The wallet account changed. Save the contact again.')
      }
      contactGenRef.current += 1
      setContactBook({ owner: account, contacts: saved })
      if (editingContactId === contact.id) {
        setContactName('')
        setContactAddress('')
        setEditingContactId('')
      }
      pushLog('Contact removed.', 'info')
    })
  }

  function usePayContact(contact) {
    setPayAddress(contact.address)
    setPayContactOpen(false)
    setPayFieldFocus(false)
  }

  function usePayrollContact(contact) {
    setPayrollCsvErrors([])
    setPayrollCsvSummary('')
    setPayrollText((current) => {
      const trimmed = current.replace(/\s+$/, '')
      const lines = trimmed ? trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : []
      if (lines.some((line) => line.toLowerCase().startsWith(contact.address))) return trimmed
      return trimmed ? `${trimmed}\n${contact.address}` : contact.address
    })
    setPayrollContactOpen(false)
  }

  function downloadPayrollSample() {
    try {
      downloadCsv('nexoria-payroll-sample.csv', PAYROLL_SAMPLE_CSV)
    } catch (error) {
      setPayrollCsvSummary('')
      setPayrollCsvErrors([toUserError(error).message])
    }
  }

  function readPayrollCsv(event) {
    const input = event.currentTarget
    const file = input.files && input.files[0]
    input.value = ''
    if (!file) return
    const filename = String(file.name || '')
    const type = String(file.type || '')
    const looksCsv = /\.csv$/i.test(filename) || type === 'text/csv' || type === 'application/vnd.ms-excel'
    if (!looksCsv) {
      setPayrollCsvSummary('')
      setPayrollCsvErrors(['Choose a .csv file.'])
      return
    }
    if (file.size > 64 * 1024) {
      setPayrollCsvSummary('')
      setPayrollCsvErrors(['That CSV is too large. A payroll batch allows 25 recipients.'])
      return
    }
    file.text().then((text) => {
      const result = payrollCsvToText(text, shownContacts)
      if (result.errors.length > 0) {
        setPayrollCsvSummary('')
        setPayrollCsvErrors(result.errors)
        return
      }
      setPayrollText(result.text)
      setPayrollCsvErrors([])
      setPayrollCsvSummary(`${result.count} recipient${result.count === 1 ? '' : 's'} loaded from the CSV. Review the list, then send payroll.`)
      setPayrollContactOpen(false)
      pushLog(`Loaded ${result.count} payroll recipient${result.count === 1 ? '' : 's'} from CSV.`, 'info')
    }).catch((error) => {
      setPayrollCsvSummary('')
      setPayrollCsvErrors([toUserError(error).message])
    })
  }

  function revokeListedAllowance(row) {
    const key = `${row.asset}:${row.spender}`
    runAction((busy) => setRevokingKey(busy ? key : ''), async () => {
      if (!providerRef.current || !addressRef.current) {
        throw toUserError(new Error('Connect a wallet first.'))
      }
      if (!dataReadyRef.current) throw toUserError(new Error('Wallet data is still loading.'))
      const network = getArcNetwork(chainId)
      if (!network?.testnet) throw new AppError('Switch to Arc Testnet before revoking an allowance.')
      const account = addressRef.current
      const result = await revokeAllowance({
        eip1193: providerRef.current,
        asset: row.asset,
        spender: row.spender,
        expectedChainId: network.chainId,
      })
      assertSameWallet(account, result.hash)
      pushLog(`Allowance set to zero. ${result.hash}`, 'success')
      celebrate()
      setAllowanceNonce((value) => value + 1)
    })
  }

  async function executeTask(task) {
    if (inFlightRef.current.has(task.id)) return
    if (task.status === 'completed' || task.status === 'cancelled' || task.status === 'submitting') return
    const ready = requireReady()
    const account = addressRef.current
    if (task.chainId !== ready.network.chainId) {
      throw toUserError(new Error('This task was scheduled on a different Arc network. Switch back before signing it.'))
    }
    inFlightRef.current.add(task.id)
    commitTasks(tasksRef.current.map((item) => (
      item.id === task.id ? { ...item, status: 'submitting', error: '' } : item
    )), account)
    let transfers = []
    const completed = (tasks) => tasks.map((item) => (
      item.id === task.id ? { ...item, status: 'completed', error: '' } : item
    ))
    try {
      const amount = parseAmount(task.amount, 6)
      transfers = [{ asset: task.asset, to: task.address, amount }]
      const result = await sendTransfers({
        eip1193: providerRef.current,
        transfers,
        expectedChainId: task.chainId,
      })
      try {
        await rememberRows(transferRows(result, 'confirmed'), account, completed)
      } catch (storeError) {
        pushLog(toUserError(storeError).message, 'warning')
      }
      if (!accountMoved(account)) commitTasks(completed(tasksRef.current), account)
      assertSameWallet(account, result.hash)
      pushLog(`Scheduled payment confirmed. Gas ceiling ${formatToken(result.feeNative, USDC_NATIVE_DECIMALS, 8)} USDC.`, 'success')
      celebrate()
      await refresh()
    } catch (error) {
      const wrapped = toUserError(error)
      if (wrapped.code !== 'ACCOUNT') {
        const status = wrapped.code === 'REJECTED' ? 'ready' : 'failed'
        const patch = (tasks) => tasks.map((item) => (
          item.id === task.id ? { ...item, status, error: wrapped.message } : item
        ))
        if (wrapped.code === 'REVERTED') await noteReverted(error, transfers, account, task.chainId, patch)
        if (!accountMoved(account)) commitTasks(patch(tasksRef.current), account)
        else if (wrapped.code !== 'REVERTED') {
          try {
            await rememberRows([], account, patch)
          } catch (storeError) {
            pushLog(toUserError(storeError).message, 'warning')
          }
        }
      }
      throw error
    } finally {
      inFlightRef.current.delete(task.id)
    }
  }

  const dataReady = Boolean(walletAddress) && readyAddress === walletAddress
  const arc = getArcNetwork(chainId)
  const allowanceRequestKey = (
    activeModule === 'utilities'
    && utilityTab === 'allowance'
    && eip1193
    && walletAddress
    && dataReady
    && arc?.testnet
  ) ? `${walletAddress}:${arc.chainId}:${allowanceNonce}` : ''
  const allowanceOwnerPrefix = walletAddress && arc ? `${walletAddress}:${arc.chainId}:` : ''
  const allowanceSameOwner = Boolean(
    allowanceOwnerPrefix
    && allowanceResult.key.startsWith(allowanceOwnerPrefix)
    && Array.isArray(allowanceResult.rows)
  )
  let allowancePhase = 'hidden'
  if (activeModule === 'utilities' && utilityTab === 'allowance') {
    if (!eip1193 || !walletAddress) allowancePhase = 'idle'
    else if (!dataReady) allowancePhase = 'waiting'
    else if (!arc?.testnet) allowancePhase = 'wrong-network'
    else if (allowanceResult.key !== allowanceRequestKey) allowancePhase = allowanceSameOwner ? 'refreshing' : 'loading'
    else if (allowanceResult.error) allowancePhase = 'error'
    else allowancePhase = 'ready'
  }
  const shownAllowances = (
    allowancePhase === 'ready' || allowancePhase === 'refreshing' || allowancePhase === 'error'
  ) ? allowanceResult.rows : null

  let paymentDraft = null
  if (payAddress.trim() && payAmount.trim()) {
    try {
      const to = assertAddress(payAddress, 'Recipient')
      const amount = parseAmount(payAmount, 6)
      if (amount > 0n) paymentDraft = { to, amount }
    } catch {
      paymentDraft = null
    }
  }
  const guardRequestKey = (
    activeModule === 'payments'
    && eip1193
    && walletAddress
    && dataReady
    && arc
    && paymentDraft
  ) ? `${walletAddress}:${arc.chainId}:${paymentDraft.to}:${guardNonce}` : ''
  const guardPhase = !paymentDraft
    ? 'idle'
    : !guardRequestKey
      ? 'blocked'
      : guardResult.key !== guardRequestKey
        ? 'checking'
        : guardResult.error
          ? 'error'
          : 'ready'
  const guardReport = guardPhase === 'ready' ? guardResult.report : null
  const guardCleared = guardAllowsSend(guardReport, guardAck)

  useEffect(() => {
    if (!allowanceRequestKey || !arc?.testnet) return undefined
    let cancelled = false
    const key = allowanceRequestKey
    const account = walletAddress
    const expectedChainId = arc.chainId
    ;(async () => {
      try {
        const rows = await listActiveAllowances({
          eip1193: providerRef.current,
          expectedChainId,
        })
        if (cancelled || addressRef.current !== account) return
        setAllowanceResult({ key, rows, error: '' })
      } catch (error) {
        if (cancelled || addressRef.current !== account) return
        console.error(error)
        const message = toUserError(error).message
        setAllowanceResult((current) => ({
          key,
          rows: current.key.startsWith(`${account}:${expectedChainId}:`) && Array.isArray(current.rows) ? current.rows : null,
          error: message,
        }))
      }
    })()
    return () => { cancelled = true }
  }, [allowanceRequestKey, arc, walletAddress])

  useEffect(() => {
    const gen = guardGenRef.current + 1
    guardGenRef.current = gen
    if (!guardRequestKey) return undefined
    const [account, chainText, recipient] = guardRequestKey.split(':')
    const expectedChainId = Number(chainText)
    const key = guardRequestKey
    ;(async () => {
      try {
        const report = await analyzeSendGuard({
          eip1193: providerRef.current,
          recipient,
          history: historyRef.current,
          expectedChainId,
        })
        if (guardGenRef.current !== gen || addressRef.current !== account) return
        setGuardResult({ key, report, error: '' })
      } catch (error) {
        if (guardGenRef.current !== gen || addressRef.current !== account) return
        console.error(error)
        setGuardResult({ key, report: null, error: toUserError(error).message })
      }
    })()
    return undefined
  }, [guardRequestKey])

  const contactOwner = dataReady && walletAddress ? walletAddress : ''
  const shownContacts = contactBook.owner === walletAddress && dataReady ? contactBook.contacts : []
  let matchedPayContact = null
  if (payAddress.trim()) {
    try {
      const exact = assertAddress(payAddress, 'Recipient')
      matchedPayContact = shownContacts.find((row) => row.address === exact) ?? null
    } catch {
      matchedPayContact = null
    }
  }
  const payQueryIsExact = Boolean(matchedPayContact)
  const showPayContacts = shownContacts.length > 0 && (
    payContactOpen || (payFieldFocus && payAddress.trim().length > 0 && !payQueryIsExact)
  )

  useEffect(() => {
    if (!contactOwner) return undefined
    let cancelled = false
    const ownerChanged = contactFormOwnerRef.current !== contactOwner
    const generation = contactGenRef.current
    contactFormOwnerRef.current = contactOwner
    ;(async () => {
      try {
        const rows = await loadContacts(contactOwner)
        if (cancelled || addressRef.current !== contactOwner || contactGenRef.current !== generation) return
        setContactBook({ owner: contactOwner, contacts: rows })
        setContactError('')
        if (ownerChanged) {
          setContactName('')
          setContactAddress('')
          setEditingContactId('')
        }
      } catch (error) {
        if (cancelled || addressRef.current !== contactOwner || contactGenRef.current !== generation) return
        console.error(error)
        setContactBook({ owner: contactOwner, contacts: [] })
        setContactError(toUserError(error).message)
      }
    })()
    return () => { cancelled = true }
  }, [contactOwner])

  const inputClass = `w-full rounded-lg border p-2.5 font-mono text-sm outline-none ${isDark ? 'border-white/10 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-900'}`
  const cardClass = isDark ? 'border-white/5 bg-slate-900' : 'border-slate-300 bg-white shadow-lg'
  const payrollPreview = (() => {
    if (!payrollText.trim()) return ''
    try {
      const rows = parsePayrollList(payrollText, globalAmount)
      const total = rows.reduce((sum, row) => sum + parseAmount(row.amountText, 6), 0n)
      return `${rows.length} recipients, ${formatToken(total, 6, 6)} ${assetLabel(payrollAsset)}`
    } catch (error) {
      return toUserError(error).message
    }
  })()

  return (
    <div className={`min-h-screen font-sans selection:bg-cyan-500/30 ${isDark ? 'bg-slate-950 text-slate-200' : 'bg-slate-100 text-slate-800'}`}>
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-cyan-500/30 bg-slate-900 p-6 text-white shadow-[0_0_30px_rgba(34,211,238,0.2)]">
            <div className="flex items-center justify-between font-bold">
              <span>Select wallet</span>
              <button type="button" onClick={() => setShowWalletModal(false)} className="text-slate-400">✕</button>
            </div>
            {wallets.length === 0 && <p className="font-mono text-xs text-slate-400">No injected wallet announced itself.</p>}
            <div className="space-y-3">
              {wallets.map((wallet) => (
                <button key={wallet.uuid} type="button" onClick={() => connect(wallet.provider)} className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-slate-950 p-4 font-mono text-sm font-bold text-cyan-400">
                  <span className="flex items-center gap-2">
                    {wallet.icon && <img src={wallet.icon} alt="" className="h-5 w-5" />}
                    {wallet.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <header className={`sticky top-0 z-40 border-b backdrop-blur-md ${isDark ? 'border-white/5 bg-slate-950/80' : 'border-slate-300 bg-white/90'}`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Cpu className="h-6 w-6 text-cyan-500" />
            <span className={`text-lg font-bold tracking-widest ${isDark ? 'text-white' : 'text-slate-900'}`}>NEXORIA</span>
            <select
              aria-label="Network"
              value={arc?.hexChainId ?? ''}
              onChange={(event) => switchNetwork(event.target.value)}
              className={`max-w-[9.5rem] rounded-full border px-2 py-1 font-mono text-[10px] font-bold ${isDark ? 'border-white/10 bg-slate-900 text-cyan-400' : 'border-slate-300 bg-slate-100 text-cyan-700'}`}
            >
              {!arc && <option value="">Unsupported network</option>}
              {NETWORKS.map((network) => (
                <option key={network.chainId} value={network.hexChainId}>{network.name}</option>
              ))}
            </select>
            <button type="button" aria-label="Toggle theme" onClick={() => setIsDark((value) => !value)} className={`rounded-full border p-2 ${isDark ? 'border-white/10 bg-slate-900 text-amber-400' : 'border-slate-300 bg-slate-200 text-indigo-600'}`}>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className={`hidden items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[10px] font-bold md:flex ${isDark ? 'border-white/10 bg-slate-900 text-cyan-400' : 'border-slate-300 bg-slate-100 text-cyan-700'}`}>
              <Globe className="h-3 w-3" />
              <span>{arc ? arc.name : 'Not Arc'} | BLK {snapshot?.telemetry?.blockNumber?.toString() ?? '—'}</span>
            </div>
            {walletAddress ? (
              <button type="button" onClick={disconnect} className={`flex items-center gap-2 rounded-lg border px-4 py-2 font-mono text-sm font-bold ${isDark ? 'border-cyan-500/30 bg-slate-900 text-cyan-400' : 'border-cyan-500 bg-white text-cyan-700'}`}>
                {shortAddress(walletAddress)} <LogOut className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={() => setShowWalletModal(true)} disabled={isConnecting} className="rounded-lg bg-cyan-500 px-5 py-2 font-mono text-sm font-bold text-slate-950 disabled:opacity-50">
                {isConnecting ? 'CONNECTING…' : 'CONNECT WALLET'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {walletAddress && !arc && (
          <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 font-mono text-xs text-amber-300">
            This wallet is on chain {chainId}. Nexoria sends only on Arc, where USDC pays the gas.
          </p>
        )}
        {walletAddress && !dataReady && (
          <p role="status" className={`rounded-xl border p-4 font-mono text-xs ${isDark ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200' : 'border-cyan-600/30 bg-white text-cyan-800'}`}>
            Loading saved receipts and scheduled payments.
          </p>
        )}

        <section className={`relative overflow-hidden rounded-2xl border p-6 ${cardClass}`}>
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-500">
                <Zap className="h-3 w-3" /> USDC balance
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Asset telemetry</h1>
                <button type="button" aria-label="Refresh balances" onClick={() => refresh()} className="rounded-lg border border-slate-500/30 p-2 text-slate-400">
                  <Activity className="h-4 w-4" />
                </button>
                {arc?.testnet && (
                  <a href={arc.faucet} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 px-3 py-1.5 font-mono text-xs font-bold text-cyan-400">
                    <Droplet className="h-3.5 w-3.5" /> Testnet faucet
                  </a>
                )}
              </div>
              <p className="max-w-xl text-xs text-slate-500">
                Transfers use the 6-decimal USDC and EURC contracts. Gas is reserved from the same USDC balance in 18-decimal native units, with a 20 gwei fee floor.
              </p>
            </div>
            <div className={`w-full max-w-sm space-y-2 rounded-xl border p-4 font-mono text-xs font-bold ${isDark ? 'border-white/5 bg-slate-950' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex justify-between text-cyan-500">
                <span>USDC</span>
                <span>{snapshot ? formatToken(snapshot.balances.usdc, 6, 6) : '—'}</span>
              </div>
              <div className="flex justify-between text-fuchsia-400">
                <span>EURC</span>
                <span>{snapshot ? formatToken(snapshot.balances.eurc, 6, 6) : '—'}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Fee ceiling, 65,000 gas</span>
                <span>{snapshot ? `${formatToken(snapshot.telemetry.referenceFee, USDC_NATIVE_DECIMALS, 8)} USDC` : '—'}</span>
              </div>
              {balanceError && <p role="alert" className="font-normal text-rose-400">{balanceError}</p>}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <div className="space-y-3 md:col-span-4">
            <div className="font-mono text-[10px] tracking-[0.2em] text-slate-500">COMMAND MODULES</div>
            {MODULES.map((item) => (
              <button key={item.id} type="button" onClick={() => { if (activeModule !== item.id) setFormError(''); setActiveModule(item.id) }} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${activeModule === item.id ? (isDark ? 'border-cyan-500 bg-slate-900' : 'border-cyan-500 bg-white') : (isDark ? 'border-white/5 bg-slate-900/50' : 'border-slate-300 bg-white')}`}>
                <item.icon className={`h-5 w-5 ${activeModule === item.id ? 'text-cyan-500' : 'text-slate-400'}`} />
                <span>
                  <span className={`block text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.title}</span>
                  <span className="font-mono text-[9px] tracking-widest text-slate-500">{item.subtitle}</span>
                </span>
              </button>
            ))}
            <button type="button" onClick={() => { if (activeModule !== 'utilities') setFormError(''); setActiveModule('utilities') }} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${activeModule === 'utilities' ? (isDark ? 'border-purple-500 bg-slate-900' : 'border-purple-500 bg-white') : (isDark ? 'border-white/5 bg-slate-900/50' : 'border-slate-300 bg-white')}`}>
              <Settings className={`h-5 w-5 ${activeModule === 'utilities' ? 'text-purple-500' : 'text-slate-400'}`} />
              <span>
                <span className="block text-sm font-bold">Utilities</span>
                <span className="font-mono text-[9px] tracking-widest text-slate-500">LEDGER, CONTACTS, ALLOWANCE</span>
              </span>
            </button>
          </div>

          <div className="space-y-6 md:col-span-8">
            <section className={`rounded-2xl border p-6 ${cardClass}`}>
              {formError && <p role="alert" className="mb-4 font-mono text-xs text-rose-400">{formError}</p>}

              {activeModule === 'payments' && (
                <div className="space-y-4">
                  <h2 className="flex items-center gap-2 text-xl font-bold"><ArrowRight className="text-cyan-500" /> Batch payments</h2>
                  <p className="text-sm text-slate-500">Enter the recipient and the amount. Send Guard checks the address before the transfer. Gas is paid in USDC.</p>
                  <Field label="Recipient address">
                    <div className="flex gap-2">
                      <input
                        value={payAddress}
                        onChange={(event) => setPayAddress(event.target.value)}
                        onFocus={() => setPayFieldFocus(true)}
                        onBlur={() => setPayFieldFocus(false)}
                        placeholder="0x or a contact name"
                        autoComplete="off"
                        spellCheck={false}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        disabled={shownContacts.length === 0}
                        onClick={() => setPayContactOpen((open) => !open)}
                        className={`shrink-0 rounded-lg border px-3 text-[10px] font-bold disabled:opacity-50 ${isDark ? 'border-purple-500/30 text-purple-300' : 'border-purple-500/40 text-purple-700'}`}
                      >
                        Select contact
                      </button>
                    </div>
                    {matchedPayContact && (
                      <span className="mt-1 block font-mono text-[10px] text-slate-500">{matchedPayContact.name}</span>
                    )}
                  </Field>
                  <ContactMenu
                    contacts={shownContacts}
                    query={payAddress}
                    open={showPayContacts}
                    onPick={usePayContact}
                    isDark={isDark}
                  />
                  <Field label="Amount">
                    <input value={payAmount} onChange={(event) => setPayAmount(event.target.value)} inputMode="decimal" placeholder="0.00" className={inputClass} />
                  </Field>
                  {guardPhase === 'blocked' && (
                    <p role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                      {!walletAddress && 'Connect a wallet on Arc before Send Guard can check this recipient.'}
                      {walletAddress && !dataReady && 'Wallet data is still loading.'}
                      {walletAddress && dataReady && !arc && 'Switch to Arc before Send Guard can check this recipient.'}
                    </p>
                  )}
                  {guardPhase === 'checking' && (
                    <p role="status" className={`rounded-xl border p-3 font-mono text-xs ${isDark ? 'border-cyan-500/30 text-cyan-200' : 'border-cyan-600/30 text-cyan-800'}`}>
                      Checking recipient…
                    </p>
                  )}
                  {guardPhase === 'error' && (
                    <div className="space-y-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3">
                      <p role="alert" className="font-mono text-xs text-rose-300">{guardResult.error}</p>
                      <button type="button" onClick={() => setGuardNonce((value) => value + 1)} className="w-full rounded-lg border border-rose-400/40 py-2 text-xs font-bold text-rose-200">Check again</button>
                    </div>
                  )}
                  {guardReport && (
                    <div
                      role="status"
                      className={`space-y-2 rounded-xl border p-3 ${
                        guardReport.level === 'known'
                          ? (isDark ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-emerald-600/40 bg-emerald-50')
                          : guardReport.level === 'new'
                            ? (isDark ? 'border-amber-500/40 bg-amber-500/10' : 'border-amber-600/40 bg-amber-50')
                            : (isDark ? 'border-rose-500/50 bg-rose-500/10' : 'border-rose-600/40 bg-rose-50')
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          guardReport.level === 'known' ? 'bg-emerald-400' : guardReport.level === 'new' ? 'bg-amber-400' : 'bg-rose-500'
                        }`} />
                        <span className="font-mono text-[10px] tracking-widest text-slate-400">SEND GUARD</span>
                      </div>
                      <div className={`text-sm font-bold ${
                        guardReport.level === 'known'
                          ? (isDark ? 'text-emerald-300' : 'text-emerald-800')
                          : guardReport.level === 'new'
                            ? (isDark ? 'text-amber-200' : 'text-amber-900')
                            : (isDark ? 'text-rose-200' : 'text-rose-800')
                      }`}>
                        {guardReport.level === 'known' && 'Known standard wallet'}
                        {guardReport.level === 'new' && 'New standard wallet'}
                        {guardReport.level === 'contract' && 'Smart contract address'}
                      </div>
                      <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {guardReport.level === 'known' && 'This address is a wallet and it is already in your ledger.'}
                        {guardReport.level === 'new' && 'First-time interaction. This address is a wallet and it is not in your ledger.'}
                        {guardReport.level === 'contract' && 'Sending tokens directly to a contract can lose them if the contract cannot receive that token.'}
                      </p>
                      {guardReport.level !== 'known' && !guardCleared && (
                        <button
                          type="button"
                          disabled={isPaying}
                          onClick={() => setGuardAck(guardAckKey(guardReport))}
                          className={`w-full rounded-lg py-2 text-xs font-bold disabled:opacity-50 ${
                            guardReport.level === 'contract' ? 'bg-rose-500 text-white' : 'bg-amber-400 text-slate-950'
                          }`}
                        >
                          Acknowledge & Proceed
                        </button>
                      )}
                      {guardReport.level !== 'known' && guardCleared && (
                        <p className={`font-mono text-[10px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Acknowledged. Choose Send USDC or Send EURC.</p>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" disabled={isPaying || !guardCleared} onClick={() => sendPayment('usdc')} className="rounded-lg bg-cyan-500 py-3 font-bold text-slate-950 disabled:opacity-50">Send USDC</button>
                    <button type="button" disabled={isPaying || !guardCleared} onClick={() => sendPayment('eurc')} className="rounded-lg bg-indigo-500 py-3 font-bold text-white disabled:opacity-50">Send EURC</button>
                  </div>
                </div>
              )}

              {activeModule === 'payroll' && (
                <div className="space-y-4">
                  <h2 className="flex items-center gap-2 text-xl font-bold"><Users className="text-indigo-400" /> Payroll</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="AMOUNT WHEN A LINE OMITS ONE">
                      <input value={globalAmount} onChange={(event) => setGlobalAmount(event.target.value)} inputMode="decimal" className={inputClass} />
                    </Field>
                    <Field label="ASSET">
                      <select value={payrollAsset} onChange={(event) => setPayrollAsset(event.target.value)} className={inputClass}>
                        <option value="usdc">USDC</option>
                        <option value="eurc">EURC</option>
                      </select>
                    </Field>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-slate-500">RECIPIENTS</span>
                    <button
                      type="button"
                      disabled={shownContacts.length === 0}
                      onClick={() => setPayrollContactOpen((open) => !open)}
                      className={`rounded-lg border px-3 py-1 text-[10px] font-bold disabled:opacity-50 ${isDark ? 'border-purple-500/30 text-purple-300' : 'border-purple-500/40 text-purple-700'}`}
                    >
                      Select contact
                    </button>
                  </div>
                  <ContactMenu contacts={shownContacts} query="" open={payrollContactOpen} onPick={usePayrollContact} isDark={isDark} />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => payrollFileRef.current?.click()}
                      className={`rounded-lg border px-3 py-1 text-[10px] font-bold ${isDark ? 'border-purple-500/30 text-purple-300' : 'border-purple-500/40 text-purple-700'}`}
                    >
                      Upload CSV
                    </button>
                    <button
                      type="button"
                      onClick={downloadPayrollSample}
                      className={`rounded-lg border px-3 py-1 text-[10px] font-bold ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-300 text-slate-700'}`}
                    >
                      Download sample CSV
                    </button>
                    <input
                      ref={payrollFileRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={readPayrollCsv}
                    />
                  </div>
                  <p className="text-xs text-slate-500">Each row needs an address or an exact contact name, then an amount. A header such as address,amount is optional.</p>
                  {payrollCsvSummary && (
                    <p role="status" className={`rounded-xl border p-3 text-xs ${isDark ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-emerald-600/40 bg-emerald-50 text-emerald-900'}`}>
                      {payrollCsvSummary}
                    </p>
                  )}
                  {payrollCsvErrors.length > 0 && (
                    <div role="alert" className={`space-y-1 rounded-xl border p-3 ${isDark ? 'border-rose-500/40 bg-rose-500/10' : 'border-rose-600/40 bg-rose-50'}`}>
                      <p className={`text-xs font-bold ${isDark ? 'text-rose-200' : 'text-rose-800'}`}>The CSV was not applied. Fix these rows and upload it again.</p>
                      {payrollCsvErrors.slice(0, 8).map((message) => (
                        <p key={message} className={`font-mono text-[11px] ${isDark ? 'text-rose-200' : 'text-rose-800'}`}>{message}</p>
                      ))}
                      {payrollCsvErrors.length > 8 && (
                        <p className={`font-mono text-[11px] ${isDark ? 'text-rose-200' : 'text-rose-800'}`}>{payrollCsvErrors.length - 8} more rows need a fix.</p>
                      )}
                    </div>
                  )}
                  <textarea
                    value={payrollText}
                    onChange={(event) => {
                      setPayrollText(event.target.value)
                      setPayrollCsvErrors([])
                      setPayrollCsvSummary('')
                    }}
                    rows={5}
                    placeholder={'0x… 1.5\n0x…'}
                    className={inputClass}
                  />
                  {payrollPreview && <p className="font-mono text-[11px] text-slate-400">{payrollPreview}</p>}
                  <button type="button" disabled={isPayroll || !payrollText.trim()} onClick={() => runAction(setIsPayroll, async () => {
                    const ready = requireReady()
                    const account = addressRef.current
                    const rows = parsePayrollList(payrollText, globalAmount)
                    const transfers = rows.map((row) => ({
                      asset: payrollAsset,
                      to: row.to,
                      amount: parseAmount(row.amountText, 6),
                    }))
                    let result
                    try {
                      result = await sendTransfers({
                        eip1193: providerRef.current,
                        transfers,
                        expectedChainId: ready.network.chainId,
                      })
                    } catch (error) {
                      await noteReverted(error, transfers, account, ready.network.chainId)
                      throw error
                    }
                    await safeRemember(transferRows(result, 'confirmed'), account)
                    setPayrollText('')
                    setPayrollCsvErrors([])
                    setPayrollCsvSummary('')
                    assertSameWallet(account, result.hash)
                    pushLog(`Payroll confirmed. Gas ceiling ${formatToken(result.feeNative, USDC_NATIVE_DECIMALS, 8)} USDC.`, 'success')
                    celebrate()
                    await refresh()
                  })} className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 py-3 font-bold text-white disabled:opacity-50">
                    <Zap className="h-4 w-4" /> Send payroll
                  </button>
                </div>
              )}

              {activeModule === 'schedule' && (
                <div className="space-y-4">
                  <h2 className="flex items-center gap-2 text-xl font-bold"><Clock className="text-orange-400" /> Scheduled payments</h2>
                  <p className="text-sm text-slate-500">The timer only marks a payment ready. Nothing is signed until you press send, including after a reload.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="AMOUNT"><input value={autoAmount} onChange={(event) => setAutoAmount(event.target.value)} inputMode="decimal" className={inputClass} /></Field>
                    <Field label="ASSET">
                      <select value={autoAsset} onChange={(event) => setAutoAsset(event.target.value)} className={inputClass}>
                        <option value="usdc">USDC</option>
                        <option value="eurc">EURC</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="RECIPIENT"><input value={autoAddress} onChange={(event) => setAutoAddress(event.target.value)} className={inputClass} /></Field>
                  <Field label="DELAY IN MINUTES"><input value={autoTime} onChange={(event) => setAutoTime(event.target.value)} inputMode="numeric" className={inputClass} /></Field>
                  <button type="button" onClick={() => runAction(setIsPaying, async () => {
                    const ready = requireReady()
                    let current = tasksRef.current.slice()
                    const open = current.filter((task) => ['pending', 'ready', 'submitting', 'unknown'].includes(task.status))
                    if (open.length >= TASK_LIMIT) throw toUserError(new Error('There are already 20 open tasks.'))
                    while (current.length >= TASK_LIMIT) {
                      const index = current.findIndex((task) => task.status === 'completed' || task.status === 'cancelled')
                      if (index === -1) throw toUserError(new Error('There are already 20 saved tasks. Cancel a finished task before adding another.'))
                      current.splice(index, 1)
                    }
                    const minutes = assertDelayMinutes(autoTime)
                    const amount = parseAmount(autoAmount, 6)
                    if (amount <= 0n) throw toUserError(new Error('Amount must be greater than zero.'))
                    const to = assertAddress(autoAddress, 'Recipient')
                    if (to === addressRef.current) throw toUserError(new Error('Recipient is the connected wallet.'))
                    const task = {
                      id: createId(),
                      address: to,
                      amount: formatToken(amount, 6, 6),
                      asset: autoAsset,
                      delayMinutes: minutes,
                      status: 'pending',
                      triggerAt: Date.now() + minutes * 60_000,
                      chainId: ready.network.chainId,
                      error: '',
                    }
                    commitTasks([...current, task])
                    armTimer(task)
                    setAutoAddress('')
                    setAutoAmount('')
                    pushLog(`Task queued for ${ready.network.name}. It will wait for your signature.`, 'process')
                  })} disabled={isPaying} className="w-full rounded-lg bg-orange-500 py-3 font-bold text-white disabled:opacity-50">
                    Queue payment
                  </button>
                  <div className="space-y-2">
                    {tasks.map((task) => (
                      <div key={task.id} className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 font-mono text-xs text-orange-300">
                        <div className="flex items-center justify-between gap-3">
                          <span>Send {task.amount} {assetLabel(task.asset)} to {shortAddress(task.address)}</span>
                          <span>{task.status}</span>
                        </div>
                        {task.error && <p className="mt-1 text-rose-300">{task.error}</p>}
                        <div className="mt-2 flex gap-2">
                          {['ready', 'unknown', 'failed'].includes(task.status) && (
                            <button type="button" disabled={isPaying} onClick={() => runAction(setIsPaying, () => executeTask(task))} className="rounded bg-orange-500 px-2 py-1 text-white disabled:opacity-50">
                              {task.status === 'unknown' ? 'Send anyway' : 'Sign and send'}
                            </button>
                          )}
                          {['pending', 'ready', 'unknown', 'failed'].includes(task.status) && (
                            <button type="button" disabled={isPaying} onClick={() => {
                              if (actionLockRef.current || inFlightRef.current.has(task.id) || !dataReadyRef.current) return
                              const handle = timersRef.current.get(task.id)
                              if (handle) clearTimeout(handle)
                              timersRef.current.delete(task.id)
                              commitTasks(tasksRef.current.map((item) => item.id === task.id ? { ...item, status: 'cancelled' } : item))
                            }} className="rounded border border-orange-500/40 px-2 py-1 disabled:opacity-50">
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeModule === 'memo' && (
                <div className="space-y-4">
                  <h2 className="flex items-center gap-2 text-xl font-bold"><MessageSquare className="text-fuchsia-400" /> On-chain memo</h2>
                  <p className="text-sm text-slate-500">The text is public. It is attached to a zero-value USDC transfer through Arc’s Memo contract, and the only USDC spent is gas.</p>
                  <Field label="RECIPIENT"><input value={pagerAddress} onChange={(event) => setPagerAddress(event.target.value)} className={inputClass} /></Field>
                  <Field label="MESSAGE"><textarea value={pagerMessage} onChange={(event) => setPagerMessage(event.target.value)} maxLength={256} rows={3} className={inputClass} /></Field>
                  <button type="button" disabled={isPaging || !pagerAddress || !pagerMessage.trim()} onClick={() => runAction(setIsPaging, async () => {
                    const ready = requireReady()
                    const account = addressRef.current
                    const message = assertMemo(pagerMessage)
                    const recipient = assertAddress(pagerAddress, 'Recipient')
                    let result
                    try {
                      result = await sendMemo({
                        eip1193: providerRef.current,
                        recipient,
                        message,
                        expectedChainId: ready.network.chainId,
                      })
                    } catch (error) {
                      const wrapped = toUserError(error)
                      if (wrapped.code === 'REVERTED' && wrapped.hash) {
                        await safeRemember([{
                          id: createId(),
                          hash: wrapped.hash,
                          amount: '0',
                          token: 'USDC',
                          to: recipient,
                          time: receiptStamp(),
                          status: 'reverted',
                          chainId: wrapped.chainId ?? ready.network.chainId,
                        }], account)
                      }
                      throw error
                    }
                    await safeRemember([{
                      id: createId(),
                      hash: result.hash,
                      amount: '0',
                      token: 'USDC',
                      to: recipient,
                      time: receiptStamp(),
                      status: 'confirmed',
                      chainId: result.chainId,
                    }], account)
                    setPagerMessage('')
                    assertSameWallet(account, result.hash)
                    pushLog(`Memo confirmed. Gas ceiling ${formatToken(result.feeNative, USDC_NATIVE_DECIMALS, 8)} USDC.`, 'success')
                    celebrate()
                    await refresh()
                  })} className="w-full rounded-lg bg-fuchsia-500 py-3 font-bold text-white disabled:opacity-50">
                    Publish memo
                  </button>
                </div>
              )}

              {activeModule === 'utilities' && (
                <div className="space-y-4">
                  <h2 className="flex items-center gap-2 text-xl font-bold"><Settings className="text-purple-400" /> Utilities</h2>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <button type="button" onClick={() => { if (utilityTab !== 'ledger') setFormError(''); setUtilityTab('ledger') }} className={`rounded py-2 text-xs font-bold ${utilityTab === 'ledger' ? 'bg-purple-500 text-white' : 'text-slate-500'}`}><History className="mr-1 inline h-4 w-4" />Ledger</button>
                    <button type="button" onClick={() => { if (utilityTab !== 'contacts') setFormError(''); setUtilityTab('contacts') }} className={`rounded py-2 text-xs font-bold ${utilityTab === 'contacts' ? 'bg-purple-500 text-white' : 'text-slate-500'}`}><Contact className="mr-1 inline h-4 w-4" />Contacts</button>
                    <button type="button" onClick={() => { if (utilityTab !== 'allowance') setFormError(''); setUtilityTab('allowance') }} className={`rounded py-2 text-xs font-bold ${utilityTab === 'allowance' ? 'bg-purple-500 text-white' : 'text-slate-500'}`}><Shield className="mr-1 inline h-4 w-4" />Allowance</button>
                    <button type="button" onClick={() => { if (utilityTab !== 'token') setFormError(''); setUtilityTab('token') }} className={`rounded py-2 text-xs font-bold ${utilityTab === 'token' ? 'bg-purple-500 text-white' : 'text-slate-500'}`}><Layers className="mr-1 inline h-4 w-4" />Token</button>
                  </div>

                  {utilityTab === 'ledger' && (
                    <div className="space-y-2">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={!dataReady || isExporting}
                          onClick={exportLedger}
                          className={`rounded border px-2 py-1 text-[10px] font-bold disabled:opacity-50 ${isDark ? 'border-purple-500/30 text-purple-300' : 'border-purple-500/40 text-purple-700'}`}
                        >
                          {isExporting ? 'Exporting…' : 'Export CSV'}
                        </button>
                        {txHistory.length > 0 && (
                          <button type="button" onClick={() => {
                            if (!dataReadyRef.current) return
                            if (!window.confirm('Remove saved receipts from this browser?')) return
                            commitHistory([])
                          }} className="rounded border border-rose-500/30 px-2 py-1 text-[10px] text-rose-400">Clear history</button>
                        )}
                      </div>
                      {txHistory.length === 0 && <p className="py-4 text-center text-xs text-slate-500">No saved receipts.</p>}
                      {txHistory.map((tx) => {
                        const network = getArcNetwork(tx.chainId)
                        return (
                          <div key={tx.id} className="flex items-center justify-between rounded-lg border border-white/10 p-3 font-mono text-xs">
                            <div>
                              <div>{tx.status === 'confirmed' ? 'Sent' : 'Reverted'} {tx.amount} {tx.token}</div>
                              <div className="text-slate-500">{shortAddress(tx.to)} · {formatLedgerWhen(tx.time)}</div>
                            </div>
                            {network && (
                              <a href={`${network.explorer}/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">View</a>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {utilityTab === 'contacts' && (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-500">Save named addresses for this wallet. Batch payments and Payroll can pick them. Names stay in this browser.</p>
                      {!walletAddress && <p className="py-4 text-center text-xs text-slate-500">Connect a wallet to save contacts.</p>}
                      {walletAddress && !dataReady && <p role="status" className="py-4 text-center text-xs text-slate-500">Wallet data is still loading.</p>}
                      {dataReady && (
                        <>
                          {contactError && <p role="alert" className="font-mono text-xs text-rose-400">{contactError}</p>}
                          <Field label="Name">
                            <input
                              value={contactName}
                              onChange={(event) => setContactName(event.target.value)}
                              placeholder="Office Rent"
                              autoComplete="off"
                              className={inputClass}
                            />
                          </Field>
                          <Field label="Address">
                            <input
                              value={contactAddress}
                              onChange={(event) => setContactAddress(event.target.value)}
                              placeholder="0x"
                              autoComplete="off"
                              spellCheck={false}
                              className={inputClass}
                            />
                          </Field>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={isSavingContact || !contactName.trim() || !contactAddress.trim()}
                              onClick={submitContact}
                              className="flex-1 rounded-lg bg-purple-500 py-2 text-xs font-bold text-white disabled:opacity-50"
                            >
                              {isSavingContact ? 'Saving…' : editingContactId ? 'Save changes' : 'Save contact'}
                            </button>
                            {editingContactId && (
                              <button
                                type="button"
                                disabled={isSavingContact}
                                onClick={() => { setEditingContactId(''); setContactName(''); setContactAddress('') }}
                                className={`rounded-lg border px-3 text-xs font-bold disabled:opacity-50 ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-300 text-slate-700'}`}
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                          {shownContacts.length === 0 && <p className="py-4 text-center text-xs text-slate-500">No saved contacts.</p>}
                          {shownContacts.map((contact) => (
                            <div key={contact.id} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                              <div className="min-w-0">
                                <div className="text-sm font-bold">{contact.name}</div>
                                <div className="break-all font-mono text-[10px] text-slate-500">{contact.address}</div>
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <button
                                  type="button"
                                  disabled={isSavingContact}
                                  onClick={() => { setEditingContactId(contact.id); setContactName(contact.name); setContactAddress(contact.address) }}
                                  className={`rounded-lg border px-2 py-1 text-[10px] font-bold disabled:opacity-50 ${isDark ? 'border-purple-500/30 text-purple-300' : 'border-purple-500/40 text-purple-700'}`}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  disabled={isSavingContact}
                                  onClick={() => deleteContact(contact)}
                                  className={`rounded-lg border px-2 py-1 text-[10px] font-bold disabled:opacity-50 ${isDark ? 'border-rose-500/40 text-rose-300' : 'border-rose-500/40 text-rose-700'}`}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}

                  {utilityTab === 'allowance' && (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-500">Active USDC and EURC approvals granted by this wallet on Arc Testnet. Revoke sets that allowance back to zero.</p>
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => setAllowanceNonce((value) => value + 1)}
                          disabled={!allowanceRequestKey || allowancePhase === 'loading' || allowancePhase === 'refreshing' || Boolean(revokingKey)}
                          className={`rounded border px-2 py-1 text-[10px] font-bold disabled:opacity-50 ${isDark ? 'border-purple-500/30 text-purple-300' : 'border-purple-500/40 text-purple-700'}`}
                        >
                          Refresh
                        </button>
                      </div>
                      {allowancePhase === 'idle' && <p className="py-4 text-center text-xs text-slate-500">Connect a wallet to list allowances.</p>}
                      {allowancePhase === 'waiting' && <p role="status" className="py-4 text-center text-xs text-slate-500">Wallet data is still loading.</p>}
                      {allowancePhase === 'wrong-network' && (
                        <p role="status" className="py-4 text-center text-xs text-amber-300">Switch to Arc Testnet to list USDC and EURC allowances.</p>
                      )}
                      {(allowancePhase === 'loading' || allowancePhase === 'refreshing') && (
                        <p role="status" className="py-2 text-center font-mono text-xs text-slate-500">Reading approvals…</p>
                      )}
                      {allowancePhase === 'error' && (
                        <div className="space-y-2">
                          <p role="alert" className="text-center font-mono text-xs text-rose-400">{allowanceResult.error}</p>
                          <button type="button" onClick={() => setAllowanceNonce((value) => value + 1)} className="w-full rounded-lg border border-amber-500/40 py-2 text-xs font-bold text-amber-300">Try again</button>
                        </div>
                      )}
                      {allowancePhase === 'ready' && shownAllowances?.length === 0 && (
                        <p className="py-4 text-center text-xs text-slate-500">No active USDC or EURC approvals.</p>
                      )}
                      {Array.isArray(shownAllowances) && shownAllowances.map((row) => {
                        const key = `${row.asset}:${row.spender}`
                        const busy = Boolean(revokingKey) || allowancePhase === 'loading' || allowancePhase === 'refreshing'
                        return (
                          <div key={key} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                            <div className="min-w-0">
                              <div className="font-mono text-[10px] tracking-widest text-slate-500">{assetLabel(row.asset)} SPENDER</div>
                              <div className="break-all font-mono text-xs">{row.spender}</div>
                              <div className="mt-2 font-mono text-[10px] tracking-widest text-slate-500">APPROVED AMOUNT</div>
                              <div className={`font-mono text-xs ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>{formatAllowance(row.value)} {assetLabel(row.asset)}</div>
                            </div>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => revokeListedAllowance(row)}
                              className="shrink-0 rounded-lg bg-rose-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                            >
                              {revokingKey === key ? 'Revoking…' : 'Revoke'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {utilityTab === 'token' && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-500">Deploys FixedSupplyToken. The whole supply is minted once to this wallet. There is no admin and no second mint.</p>
                      {!CAN_DEPLOY_TOKEN && <p className="font-mono text-xs text-amber-300">Bytecode is not built yet. From pulse-app, install solc@0.8.28 and run node ../contracts/compile.mjs.</p>}
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="NAME"><input value={forgeName} onChange={(event) => setForgeName(event.target.value)} className={inputClass} /></Field>
                        <Field label="SYMBOL"><input value={forgeSymbol} onChange={(event) => setForgeSymbol(event.target.value.toUpperCase())} className={inputClass} /></Field>
                      </div>
                      <Field label="WHOLE TOKEN SUPPLY"><input value={forgeSupply} onChange={(event) => setForgeSupply(event.target.value)} inputMode="numeric" className={inputClass} /></Field>
                      <button type="button" disabled={isForging || !CAN_DEPLOY_TOKEN} onClick={() => runAction(setIsForging, async () => {
                        const ready = requireReady()
                        const account = addressRef.current
                        const metadata = assertTokenMetadata(forgeName, forgeSymbol)
                        const wholeSupply = parseWholeSupply(forgeSupply)
                        const result = await deployFixedSupplyToken({
                          eip1193: providerRef.current,
                          ...metadata,
                          wholeSupply,
                          expectedChainId: ready.network.chainId,
                        })
                        await safeRemember([{
                          id: createId(),
                          hash: result.hash,
                          amount: wholeSupply.toString(),
                          token: 'TOKEN',
                          to: result.address,
                          time: receiptStamp(),
                          status: 'confirmed',
                          chainId: result.chainId,
                        }], account)
                        setForgeName('')
                        setForgeSymbol('')
                        setForgeSupply('')
                        assertSameWallet(account, result.hash)
                        pushLog(`Token deployed at ${result.address}.`, 'success')
                        celebrate()
                        await refresh()
                      })} className="w-full rounded-lg bg-purple-600 py-3 font-bold text-white disabled:opacity-50">Deploy token</button>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-cyan-500/30 bg-black shadow-lg">
              <div className="flex items-center gap-2 border-b border-white/10 bg-slate-900 p-2">
                <Terminal className="h-4 w-4 text-slate-400" />
                <span className="font-mono text-[10px] tracking-widest text-slate-400">SYSTEM TERMINAL</span>
              </div>
              <div aria-live="polite" className="h-40 space-y-2 overflow-y-auto p-4 font-mono text-xs">
                {logs.length === 0 && <div className="text-slate-600">Waiting for a wallet.</div>}
                {logs.map((entry, index) => {
                  const color = entry.type === 'success' ? 'text-emerald-400'
                    : entry.type === 'error' ? 'text-rose-400'
                      : entry.type === 'warning' ? 'text-amber-400'
                        : entry.type === 'process' ? 'text-cyan-400'
                          : 'text-slate-300'
                  return <div key={`${entry.time}-${index}`} className={color}><span className="text-slate-600">[{entry.time}]</span> {entry.message}</div>
                })}
                <div ref={terminalEndRef} />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
