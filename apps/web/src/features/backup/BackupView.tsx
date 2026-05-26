import { useEffect, useState } from 'react'
import { Download, Save } from 'lucide-react'
import { api } from '../../lib/api'
import type { Config, Snapshot } from '../../lib/types'

export function BackupView({
  config,
  onMessage,
}: {
  config: Config
  onMessage: (type: 'ok' | 'erro', text: string) => void
}) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!config.r2.configurado) return
    try {
      setSnapshots((await api.snapshots()).snapshots)
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : 'não foi possível consultar o R2')
    }
  }
  useEffect(() => {
    void load()
  }, [config.r2.configurado])

  return (
    <section className="workspace backups">
      <header className="section-head">
        <div>
          <span className="eyebrow">r2-syncs</span>
          <h1>backups</h1>
        </div>
        <button
          className="btn btn--primary"
          disabled={loading}
          onClick={async () => {
            setLoading(true)
            try {
              await api.saveSnapshot()
              await load()
              onMessage('ok', 'snapshot completo enviado ao R2')
            } catch (error) {
              onMessage('erro', error instanceof Error ? error.message : 'falha no backup')
            } finally {
              setLoading(false)
            }
          }}
          type="button"
        >
          <Save size={15} /> {loading ? 'enviando...' : '[SAVE] agora'}
        </button>
      </header>
      <p className="panel-copy">
        cada snapshot envia a pasta integral <code>~/Documents/PROJECTUS</code>: configurações, kanbans, ideias,
        Arquivo, históricos e anexos.
      </p>
      {!config.r2.configurado ? (
        <div className="empty">
          <p>R2 ainda não configurado.</p>
          <small>informe bucket e credenciais em configurações.</small>
        </div>
      ) : (
        <div className="snapshots panel">
          <header>histórico remoto</header>
          {snapshots.map((snapshot) => (
            <article className="snapshot" key={snapshot.id}>
              <div>
                <strong>{snapshot.id}</strong>
                <span>
                  {snapshot.origem === 'manual' ? 'MANUAL' : 'AUTO'} / {snapshot.arquivos} arquivos /{' '}
                  {(snapshot.bytes / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
              <button
                className="btn btn--quiet"
                type="button"
                onClick={async () => {
                  if (!window.confirm('Restaurar este snapshot? O estado atual será preservado em uma pasta de recuperação.'))
                    return
                  try {
                    await api.restoreSnapshot(snapshot.id)
                    onMessage('ok', 'snapshot restaurado')
                  } catch (error) {
                    onMessage('erro', error instanceof Error ? error.message : 'falha ao restaurar')
                  }
                }}
              >
                <Download size={14} /> restaurar
              </button>
            </article>
          ))}
          {snapshots.length === 0 && <p className="panel-empty">nenhum snapshot enviado.</p>}
        </div>
      )}
    </section>
  )
}
