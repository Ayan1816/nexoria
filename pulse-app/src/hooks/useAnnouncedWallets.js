import { useEffect, useState } from 'react'

function safeIcon(icon) {
  if (typeof icon !== 'string') return ''
  if (icon.startsWith('data:image/') || icon.startsWith('https://')) return icon
  return ''
}

export function useAnnouncedWallets() {
  const [wallets, setWallets] = useState([])

  useEffect(() => {
    const found = new Map()
    const publish = () => setWallets([...found.values()])
    const onAnnounce = (event) => {
      const detail = event.detail
      if (!detail?.info?.uuid || typeof detail.provider?.request !== 'function') return
      found.set(detail.info.uuid, {
        uuid: detail.info.uuid,
        name: detail.info.name || 'Wallet',
        icon: safeIcon(detail.info.icon),
        provider: detail.provider,
      })
      publish()
    }
    window.addEventListener('eip6963:announceProvider', onAnnounce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    const timer = setTimeout(() => {
      if (found.size > 0 || typeof window.ethereum?.request !== 'function') return
      found.set('injected', {
        uuid: 'injected',
        name: 'Browser wallet',
        icon: '',
        provider: window.ethereum,
      })
      publish()
    }, 300)
    return () => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce)
      clearTimeout(timer)
    }
  }, [])

  return wallets
}
