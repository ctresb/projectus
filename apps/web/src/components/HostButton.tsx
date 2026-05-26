import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Globe, Loader2, WifiOff } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../lib/api'
import type { LanStatus } from '../lib/types'

export function HostButton({ porta }: { porta: number }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<LanStatus | null>(null)
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void api.lanStatus().then(setStatus).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = async (next: boolean) => {
    setPending(true)
    try {
      const result = await api.toggleLan(next)
      setStatus(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'falha ao alterar LAN'
      setStatus({ ativo: false, porta, urls: [], erro: message })
    } finally {
      setPending(false)
    }
  }

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(url)
      setTimeout(() => setCopied((c) => (c === url ? null : c)), 1500)
    } catch {
      /* ignored */
    }
  }

  const ativo = status?.ativo ?? false
  const icon = pending ? <Loader2 size={14} className="host-button__spin" /> : ativo ? <Globe size={14} /> : <WifiOff size={14} />

  return (
    <div className="host-button" ref={root}>
      <motion.button
        type="button"
        className={`host-button__trigger ${ativo ? 'host-button__trigger--active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.12, ease: [0.2, 0.7, 0.2, 1] }}
        title={ativo ? 'web exposta na rede local' : 'expor web na rede local'}
      >
        {icon}
        <span>{ativo ? 'hospedando' : 'hospedar'}</span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="host-pop"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <div className="host-pop__head">
              <strong>hospedar web na rede local</strong>
              <button
                type="button"
                className={`host-pop__switch ${ativo ? 'host-pop__switch--on' : ''}`}
                onClick={() => !pending && toggle(!ativo)}
                aria-pressed={ativo}
                aria-label={ativo ? 'desligar exposição LAN' : 'ligar exposição LAN'}
                disabled={pending}
              >
                <span className="host-pop__switch-knob" />
              </button>
            </div>
            <p className="host-pop__hint">
              quando ligado, qualquer dispositivo na mesma Wi-Fi pode abrir o PROJECTUS no navegador.
            </p>
            {status?.erro && <div className="host-pop__error">{status.erro}</div>}
            {ativo && status && status.urls.length > 0 && (
              <ul className="host-pop__urls">
                {status.urls.map((url) => (
                  <li key={url}>
                    <code>{url}</code>
                    <button type="button" className="icon-btn" onClick={() => void copy(url)} aria-label={`copiar ${url}`}>
                      {copied === url ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {ativo && status?.urls.length === 0 && (
              <p className="host-pop__hint host-pop__hint--warn">
                nenhum IP local detectado. Verifique se você está conectado a uma rede.
              </p>
            )}
            {!ativo && (
              <p className="host-pop__hint">porta padrão: {status?.porta ?? porta}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
