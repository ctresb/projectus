import { useEffect, useState } from 'react'
import { api, ApiFailure } from '../../lib/api'
import { Button, ErrorState } from '../../components/ui'

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
  const [retry, setRetry] = useState(0)
  const [status, setStatus] = useState('reiniciando o servidor local para aplicar a atualização...')
  const outdatedBackend = (version ?? 0) < REQUIRED_API_VERSION

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
          setStatus('atualizando servidor local legado...')
          try {
            await api.installDaemon()
          } catch {
            // A conexão pode cair quando o serviço antigo se substitui.
          }
        }
      }

      setStatus(legacyRestart ? 'finalizando atualização do servidor...' : 'aguardando servidor atualizado...')
      for (let attempt = 0; attempt < 30 && !cancelled; attempt += 1) {
        await wait(500)
        try {
          const next = await api.bootstrap()
          if (next.capacidades?.api_version === REQUIRED_API_VERSION) {
            if (legacyRestart) {
              legacyRestart = false
              setStatus('reconfigurando serviço para servir a interface web...')
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
      if (!cancelled) setStatus('não foi possível reiniciar automaticamente. tente novamente.')
    }

    void recover()
    return () => {
      cancelled = true
    }
  }, [outdatedBackend, onRecovered, retry])

  if (!outdatedBackend)
    return (
      <ErrorState className="boot boot--error">
        <p>ERR / interface local desatualizada</p>
        <p>recarregue a janela para carregar a versão compatível com o servidor.</p>
        <Button type="button" onClick={() => window.location.reload()}>
          recarregar interface
        </Button>
      </ErrorState>
    )

  return (
    <ErrorState className="boot boot--error">
      <p>UPDATE / versão do servidor incompatível</p>
      <p>{status}</p>
      {status.startsWith('não foi possível') && (
        <Button type="button" onClick={() => setRetry((value) => value + 1)}>
          tentar novamente
        </Button>
      )}
    </ErrorState>
  )
}
