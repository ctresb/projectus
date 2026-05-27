import { useEffect, useState } from 'react'
import { api, ApiFailure } from '../../lib/api'
import { Button, ErrorState } from '../../components/ui'
import { useT } from '../../i18n'

export const REQUIRED_API_VERSION = 5

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
}

export function ServerVersionRecovery({
  version,
  onRecovered,
}: {
  version: number | undefined
  onRecovered: () => Promise<void>
}) {
  const t = useT()
  const [retry, setRetry] = useState(0)
  const [status, setStatus] = useState(() => t('boot.restarting'))
  const outdatedBackend = (version ?? 0) < REQUIRED_API_VERSION

  useEffect(() => {
    setStatus(t('boot.restarting'))
  }, [t])

  useEffect(() => {
    if (!outdatedBackend) return
    let cancelled = false

    async function recover() {
      let legacyRestart = false
      try {
        await api.restartDaemon()
      } catch (error) {
        if (error instanceof ApiFailure && error.status === 404) {
          legacyRestart = true
          setStatus(t('boot.updating_legacy'))
          try {
            await api.installDaemon()
          } catch {
            // A conexão pode cair quando o serviço antigo se substitui.
          }
        }
      }

      setStatus(legacyRestart ? t('boot.finishing_update') : t('boot.waiting_updated'))
      for (let attempt = 0; attempt < 30 && !cancelled; attempt += 1) {
        await wait(500)
        try {
          const next = await api.bootstrap()
          if (next.capacidades?.api_version === REQUIRED_API_VERSION) {
            if (legacyRestart) {
              legacyRestart = false
              setStatus(t('boot.reconfiguring'))
              try {
                await api.installDaemon()
              } catch {
                // A reinstalação encerra a conexão enquanto carrega a definição atualizada.
              }
              continue
            }
            await onRecovered()
            return
          }
        } catch {
          // O processo fica indisponível por instantes durante o reinício.
        }
      }
      if (!cancelled) setStatus(t('boot.restart_failed'))
    }

    void recover()
    return () => {
      cancelled = true
    }
  }, [outdatedBackend, onRecovered, retry, t])

  if (!outdatedBackend)
    return (
      <ErrorState className="boot boot--error">
        <p>ERR / {t('boot.version_outdated')}</p>
        <p>{t('boot.reload_hint')}</p>
        <Button type="button" onClick={() => window.location.reload()}>
          {t('boot.reload_button')}
        </Button>
      </ErrorState>
    )

  return (
    <ErrorState className="boot boot--error">
      <p>{t('boot.version_incompatible')}</p>
      <p>{status}</p>
      {status === t('boot.restart_failed') && (
        <Button type="button" onClick={() => setRetry((value) => value + 1)}>
          {t('boot.retry')}
        </Button>
      )}
    </ErrorState>
  )
}
