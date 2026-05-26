import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Globe, Loader2, RefreshCw, WifiOff } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../lib/api'
import type { LanStatus } from '../lib/types'
import { EASE } from '../lib/motion'

export function HostButton({ porta }: { porta: number }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<LanStatus | null>(null)
  const [pending, setPending] = useState(false)
  const [restartFailed, setRestartFailed] = useState(false)
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

  // Polling após restart automático: espera o servidor voltar e reflete o novo bind.
  useEffect(() => {
    if (!status?.precisa_reiniciar) return
    let cancelled = false
    let attempts = 0
    const tick = async () => {
      if (cancelled) return
      attempts += 1
      try {
        const fresh = await api.lanStatus()
        if (cancelled) return
        setStatus(fresh)
        if (fresh.precisa_reiniciar && attempts < 20) {
          window.setTimeout(tick, 750)
        }
      } catch {
        if (attempts < 20) window.setTimeout(tick, 750)
      }
    }
    const handle = window.setTimeout(tick, 1000)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [status?.precisa_reiniciar])

  const toggle = async (next: boolean) => {
    setPending(true)
    setRestartFailed(false)
    try {
      const result = await api.toggleLan(next)
      setStatus(result)
      // Se nada precisa reiniciar, deu certo. Se precisa, esperamos o restart automático;
      // a próxima atualização vem do polling. Se em 5s nada mudou, marca falha manual.
      if (result.precisa_reiniciar) {
        window.setTimeout(() => {
          setStatus((current) => {
            if (current?.precisa_reiniciar) setRestartFailed(true)
            return current
          })
        }, 5000)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'falha ao alterar LAN'
      setStatus({
        ativo: status?.ativo ?? false,
        porta,
        urls: status?.urls ?? [],
        erro: message,
        precisa_reiniciar: false,
      })
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
  const restarting = status?.precisa_reiniciar ?? false
  const icon = pending || restarting ? (
    <Loader2 size={14} className="host-button__spin" />
  ) : ativo ? (
    <Globe size={14} />
  ) : (
    <WifiOff size={14} />
  )
  const label = pending ? 'aplicando…' : restarting ? 'reiniciando…' : ativo ? 'hospedando' : 'hospedar'

  return (
    <div className="host-button" ref={root}>
      <motion.button
        type="button"
        className={`host-button__trigger ${ativo ? 'host-button__trigger--active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.12, ease: EASE }}
        title={ativo ? 'web exposta na rede local' : 'expor web na rede local'}
      >
        {icon}
        <span>{label}</span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="host-pop"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: EASE }}
          >
            <div className="host-pop__head">
              <strong>hospedar web na rede local</strong>
              <button
                type="button"
                className={`host-pop__switch ${ativo ? 'host-pop__switch--on' : ''}`}
                onClick={() => !pending && !restarting && toggle(!ativo)}
                aria-pressed={ativo}
                aria-label={ativo ? 'desligar exposição LAN' : 'ligar exposição LAN'}
                disabled={pending || restarting}
              >
                <span className="host-pop__switch-knob" />
              </button>
            </div>
            <p className="host-pop__hint">
              quando ligado, qualquer dispositivo na mesma Wi-Fi pode abrir o PROJECTUS no navegador.
            </p>
            {status?.erro && <div className="host-pop__error">{status.erro}</div>}
            {restarting && !restartFailed && (
              <p className="host-pop__hint host-pop__hint--warn">
                <RefreshCw size={11} /> reiniciando o servidor pra aplicar… mantenha aberto.
              </p>
            )}
            {restartFailed && (
              <div className="host-pop__error">
                servidor não reiniciou sozinho. instale o autostart em config / servidor local ou
                reinicie o PROJECTUS manualmente.
              </div>
            )}
            {ativo && !restarting && status && status.urls.length > 0 && (
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
            {ativo && !restarting && status?.urls.length === 0 && (
              <p className="host-pop__hint host-pop__hint--warn">
                nenhum IP local detectado. verifique se você está conectado a uma rede.
              </p>
            )}
            {!ativo && !restarting && (
              <p className="host-pop__hint">porta: {status?.porta ?? porta}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
